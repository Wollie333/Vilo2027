-- Migration: booking-safety hardening — policy_snapshots immutability (G3) +
-- bookings.payment_status on refund completion (G4).
--
-- Depends on 20260712140000 (the P0 snapshot fix). Two independent hardening
-- steps bundled as "Phase 1" of the policy/refund plan.

-- ─── G3: policy_snapshots is immutable ───────────────────────────
-- policy_snapshots is INSERT-only by design (the frozen policy a booking was
-- made under). RLS grants participants read-only, but the service-role client
-- used by server code bypasses RLS entirely — so nothing at the DB level stops
-- a stray UPDATE (silently changing a refund entitlement after the fact) or
-- DELETE (erasing the frozen policy → refund engine falls back to 0%). Add a
-- row trigger that forbids both.
--
-- The ONE legitimate delete is the GDPR account purge (app_purge_user_account),
-- which removes a user's snapshots along with their bookings. It signals intent
-- with a transaction-local GUC the trigger honours. TRUNCATE (the "clean wipe")
-- does not fire row-level DELETE triggers, so it is unaffected.

CREATE OR REPLACE FUNCTION forbid_policy_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'policy_snapshots is immutable: the frozen policy of booking % cannot be altered.',
      OLD.booking_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- DELETE: allowed only inside the GDPR purge, which sets the flag below.
  IF current_setting('app.allow_policy_snapshot_purge', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION
      'policy_snapshots rows cannot be deleted outside the GDPR account purge (booking %).',
      OLD.booking_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_policy_snapshots_immutable ON policy_snapshots;
CREATE TRIGGER trg_policy_snapshots_immutable
  BEFORE UPDATE OR DELETE ON policy_snapshots
  FOR EACH ROW EXECUTE FUNCTION forbid_policy_snapshot_mutation();

COMMENT ON FUNCTION forbid_policy_snapshot_mutation IS
  'Enforces policy_snapshots immutability: blocks UPDATE always and DELETE unless the GDPR purge set app.allow_policy_snapshot_purge=on for the transaction.';

-- Re-state the GDPR purge to set the exemption flag before deleting snapshots.
-- (Latest prior def: 20260617000200_rename_r2_core_tables.sql.) Only the one
-- added set_config line changes; the delete order is otherwise identical.
CREATE OR REPLACE FUNCTION public.app_purge_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid;
BEGIN
  -- Allow this transaction to delete frozen policy snapshots (GDPR erasure).
  PERFORM set_config('app.allow_policy_snapshot_purge', 'on', true);

  SELECT id INTO v_host_id FROM hosts WHERE user_id = p_user_id;

  DELETE FROM refund_status_history rsh
   WHERE rsh.refund_request_id IN (
     SELECT id FROM refund_requests
      WHERE host_id = v_host_id
         OR guest_id = p_user_id
         OR booking_id IN (
              SELECT id FROM bookings
               WHERE guest_id = p_user_id OR host_id = v_host_id
            )
   );

  DELETE FROM refunds r
   WHERE r.booking_id IN (
     SELECT id FROM bookings
      WHERE guest_id = p_user_id OR host_id = v_host_id
   );

  DELETE FROM refund_requests rr
   WHERE rr.host_id = v_host_id
      OR rr.guest_id = p_user_id
      OR rr.booking_id IN (
        SELECT id FROM bookings
         WHERE guest_id = p_user_id OR host_id = v_host_id
      );

  DELETE FROM payments pm
   WHERE pm.booking_id IN (
     SELECT id FROM bookings
      WHERE guest_id = p_user_id OR host_id = v_host_id
   );

  DELETE FROM policy_snapshots ps
   WHERE ps.booking_id IN (
     SELECT id FROM bookings
      WHERE guest_id = p_user_id OR host_id = v_host_id
   );

  DELETE FROM reviews rv
   WHERE rv.guest_id = p_user_id
      OR rv.booking_id IN (
        SELECT id FROM bookings
         WHERE guest_id = p_user_id OR host_id = v_host_id
      );

  DELETE FROM invoices inv
   WHERE inv.host_id = v_host_id
      OR inv.booking_id IN (
        SELECT id FROM bookings
         WHERE guest_id = p_user_id OR host_id = v_host_id
      );

  DELETE FROM bookings
   WHERE guest_id = p_user_id OR host_id = v_host_id;

  IF v_host_id IS NOT NULL THEN
    DELETE FROM quotes WHERE host_id = v_host_id;
    DELETE FROM properties WHERE host_id = v_host_id;
    DELETE FROM host_feature_overrides WHERE host_id = v_host_id;
    DELETE FROM hosts WHERE id = v_host_id;
  END IF;

  DELETE FROM host_feature_overrides  WHERE overridden_by = p_user_id;
  DELETE FROM featured_listings       WHERE featured_by   = p_user_id;
  DELETE FROM broadcast_announcements WHERE created_by    = p_user_id;
  DELETE FROM admin_message_batches   WHERE created_by    = p_user_id;
  DELETE FROM impersonation_sessions  WHERE admin_id = p_user_id OR target_user_id = p_user_id;
  DELETE FROM admin_audit_log         WHERE admin_id = p_user_id OR impersonating  = p_user_id;
  DELETE FROM data_requests           WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.app_purge_user_account(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_purge_user_account(uuid) TO service_role;

-- ─── G4: reflect refunds on bookings.payment_status ──────────────
-- Today only payments.status flips to refunded/partially_refunded when a refund
-- completes; bookings.payment_status stays 'completed'. That misleads the host
-- board pill, the guest trip view, and reviews-eligibility. Extend the existing
-- completion trigger to also set the booking's payment_status from the aggregate
-- refunded-vs-captured across all its payments.

CREATE OR REPLACE FUNCTION update_payment_refunded_amount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking_id uuid;
  v_captured   numeric;
  v_refunded   numeric;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE payments
    SET refunded_amount = COALESCE(refunded_amount, 0) + COALESCE(NEW.approved_amount, 0)
    WHERE id = NEW.payment_id;

    UPDATE payments
    SET status = CASE
      WHEN refunded_amount >= amount THEN 'refunded'
      ELSE 'partially_refunded'
    END
    WHERE id = NEW.payment_id;

    -- Roll the booking's payment_status up from ALL its payments so a booking
    -- with several payments reads refunded only when everything captured is back.
    SELECT booking_id INTO v_booking_id FROM payments WHERE id = NEW.payment_id;
    IF v_booking_id IS NOT NULL THEN
      SELECT
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(refunded_amount), 0)
      INTO v_captured, v_refunded
      FROM payments
      WHERE booking_id = v_booking_id
        AND voided_at IS NULL
        AND kind IN ('deposit','balance','addon','payment','credit')
        AND status IN ('completed','partially_refunded','refunded');

      IF v_refunded > 0 THEN
        UPDATE bookings
        SET payment_status = CASE
          WHEN v_refunded >= v_captured THEN 'refunded'
          ELSE 'partially_refunded'
        END
        WHERE id = v_booking_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
