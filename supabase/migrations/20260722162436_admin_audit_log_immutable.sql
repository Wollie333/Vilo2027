-- admin_audit_log: enforce the immutability CLAUDE.md has always claimed.
--
-- The rule "admin_audit_log is INSERT-only — no UPDATE or DELETE" was documented
-- but never enforced: there was no trigger, and deletes simply succeeded. A
-- guarantee nothing checks is not a guarantee.
--
-- WHY THIS SAT OPEN
--   A blanket trigger would have broken GDPR erasure, because app_purge_user_account
--   DELETEs from this table. That delete is also wrong on its own terms: it erases
--   the record of what a STAFF MEMBER DID — including actions taken against OTHER
--   users' accounts — so erasing one person's data destroyed accountability records
--   belonging to everyone else.
--
-- FOUNDER RULING: anonymise, don't delete.
--   Erasure rights are not absolute; records kept for accountability are a
--   recognised basis for retention. So the row survives with the person removed:
--   admin_id becomes NULL (the column drops NOT NULL for exactly this), and the
--   trigger can then ban DELETE outright with no exemption at all.
--
-- WHY THE ANONYMISING UPDATE IS NOT FLAG-GATED
--   The sibling tables (policy_snapshots, forfeit_statements) gate their exemption
--   on a transaction-local set_config that the purge sets. That would be fragile
--   here: `impersonating` is ON DELETE SET NULL, so POSTGRES ITSELF issues an
--   update on this table while cascading the user_profiles delete — and that
--   cascade fires after this function returns, where a transaction-local flag may
--   no longer be set. The purge would then fail on its very last step.
--   Nulling those two columns is the anonymisation we want, and is not a threat to
--   the audit trail, so it is always permitted. Everything else is refused.

ALTER TABLE admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION forbid_admin_audit_log_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'admin_audit_log is append-only: entry % cannot be deleted. To erase a person, NULL admin_id/impersonating instead.',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- UPDATE: the only permitted change is removing the person (anonymisation).
  IF NEW.admin_id IS DISTINCT FROM OLD.admin_id AND NEW.admin_id IS NOT NULL THEN
    RAISE EXCEPTION
      'admin_audit_log.admin_id may only be cleared, never reassigned (entry %).',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.impersonating IS DISTINCT FROM OLD.impersonating AND NEW.impersonating IS NOT NULL THEN
    RAISE EXCEPTION
      'admin_audit_log.impersonating may only be cleared, never reassigned (entry %).',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Compare every OTHER column generically, so a column added later is covered
  -- by this guard without anyone remembering to come back and update it.
  IF (to_jsonb(NEW) - 'admin_id' - 'impersonating')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'admin_id' - 'impersonating') THEN
    RAISE EXCEPTION
      'admin_audit_log is append-only: entry % cannot be altered.',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_audit_log_immutable ON admin_audit_log;
CREATE TRIGGER trg_admin_audit_log_immutable
  BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_admin_audit_log_mutation();

COMMENT ON FUNCTION forbid_admin_audit_log_mutation IS
  'Enforces admin_audit_log append-only: DELETE is always refused; UPDATE is refused except clearing admin_id/impersonating to NULL (GDPR anonymisation).';

-- Re-state the GDPR purge so it ANONYMISES instead of deleting.
-- (Latest prior def: 20260716230000_fix_gdpr_purge_restrict_edges.sql. Only the
-- admin_audit_log line changes; the delete order is otherwise byte-identical.)
CREATE OR REPLACE FUNCTION public.app_purge_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_host_id uuid;
BEGIN
  -- Immutable-table exemptions for this transaction (GDPR erasure only).
  PERFORM set_config('app.allow_policy_snapshot_purge', 'on', true);
  PERFORM set_config('app.allow_forfeit_statement_purge', 'on', true);

  SELECT id INTO v_host_id FROM hosts WHERE user_id = p_user_id;

  -- ── Third-party rows: sever, never delete ───────────────────────────────
  -- Another guest's Looking-For post may point at a booking we are about to
  -- remove (fulfilled_booking_id, NO ACTION). Their post is not ours to erase.
  UPDATE looking_for_posts lfp
     SET fulfilled_booking_id = NULL
   WHERE lfp.fulfilled_booking_id IN (
     SELECT id FROM bookings
      WHERE guest_id = p_user_id OR host_id = v_host_id
   );

  -- ── Money documents that RESTRICT bookings/invoices/hosts ───────────────
  DELETE FROM forfeit_statements fs
   WHERE fs.host_id = v_host_id
      OR fs.booking_id IN (
        SELECT id FROM bookings
         WHERE guest_id = p_user_id OR host_id = v_host_id
      );

  -- Before invoices: credit_notes.invoice_id is NOT NULL RESTRICT.
  DELETE FROM credit_notes cn
   WHERE cn.host_id = v_host_id
      OR cn.booking_id IN (
        SELECT id FROM bookings
         WHERE guest_id = p_user_id OR host_id = v_host_id
      )
      OR cn.invoice_id IN (
        SELECT id FROM invoices
         WHERE host_id = v_host_id
            OR booking_id IN (
              SELECT id FROM bookings
               WHERE guest_id = p_user_id OR host_id = v_host_id
            )
      );

  -- ── Refund graph (refund_requests.payment_id -> payments RESTRICT) ───────
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

  -- ── Booking children ────────────────────────────────────────────────────
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

  -- ── Looking-For graph: responses -> quotes -> posts ─────────────────────
  -- All three must precede bookings (posts reference bookings) and properties
  -- (quotes.property_id is RESTRICT).
  DELETE FROM looking_for_responses lr
   WHERE lr.host_id = v_host_id
      OR lr.post_id IN (SELECT id FROM looking_for_posts WHERE guest_id = p_user_id)
      OR lr.quote_id IN (
        SELECT id FROM quotes
         WHERE host_id = v_host_id
            OR looking_for_post_id IN (
              SELECT id FROM looking_for_posts WHERE guest_id = p_user_id
            )
      );

  DELETE FROM quotes q
   WHERE q.host_id = v_host_id
      OR q.looking_for_post_id IN (
        SELECT id FROM looking_for_posts WHERE guest_id = p_user_id
      );

  -- Explicit rather than relying on the user_profiles CASCADE: the cascade fires
  -- after this function, by which point nothing can clear the quotes blocking it.
  DELETE FROM looking_for_posts WHERE guest_id = p_user_id;

  -- ── Core ────────────────────────────────────────────────────────────────
  DELETE FROM bookings
   WHERE guest_id = p_user_id OR host_id = v_host_id;

  IF v_host_id IS NOT NULL THEN
    DELETE FROM properties WHERE host_id = v_host_id;
    DELETE FROM host_feature_overrides WHERE host_id = v_host_id;
    DELETE FROM hosts WHERE id = v_host_id;
  END IF;

  -- Direct user_profiles RESTRICT references (admin/staff hat or target).
  DELETE FROM host_feature_overrides  WHERE overridden_by = p_user_id;
  DELETE FROM featured_listings       WHERE featured_by   = p_user_id;
  DELETE FROM broadcast_announcements WHERE created_by    = p_user_id;
  DELETE FROM admin_message_batches   WHERE created_by    = p_user_id;
  DELETE FROM impersonation_sessions  WHERE admin_id = p_user_id OR target_user_id = p_user_id;

  -- ANONYMISE, never delete: the record of what this person DID as staff — often
  -- actions against OTHER users' accounts — has to outlive their own erasure.
  -- Clearing admin_id also releases the ON DELETE RESTRICT that would otherwise
  -- block the user_profiles row from going.
  UPDATE admin_audit_log SET admin_id     = NULL WHERE admin_id     = p_user_id;
  UPDATE admin_audit_log SET impersonating = NULL WHERE impersonating = p_user_id;

  DELETE FROM data_requests           WHERE user_id = p_user_id;
END;
$function$;
