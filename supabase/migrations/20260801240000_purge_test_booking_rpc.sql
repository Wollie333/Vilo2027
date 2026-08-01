-- Service-role-only hard-delete for a booking + all its children.
--
-- WHY: policy_snapshots is INSERT-only (20260712150000) — a BEFORE DELETE trigger
-- refuses any delete unless the GDPR-purge GUC `app.allow_policy_snapshot_purge`
-- is set for the transaction. The REST/service-role client can't set a
-- transaction-local GUC across its stateless calls, so a booking that ever got a
-- policy snapshot became UNDELETABLE via the API — which silently leaked test
-- bookings out of the flow harness's cleanup() (they piled up because the booking
-- DELETE failed on the policy_snapshots FK) and would equally block a pre-MVP wipe.
--
-- This function sets the exemption GUC LOCALLY and deletes the booking's children
-- in FK-safe order, then the booking. SECURITY DEFINER so the GUC + deletes run as
-- the owner; EXECUTE is locked to service_role (which already bypasses RLS, so this
-- grants no new reach — it only unblocks the immutable-snapshot delete). Pre-MVP
-- utility: the harness calls it per created booking; the wipe can call it too.

CREATE OR REPLACE FUNCTION public.purge_test_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Honoured by forbid_policy_snapshot_mutation() for THIS transaction only.
  PERFORM set_config('app.allow_policy_snapshot_purge', 'on', true);

  -- Children first, in an order that respects the RESTRICT FKs:
  -- refund_requests → payments; credit_notes → invoices; everything → bookings.
  DELETE FROM blocked_dates    WHERE booking_id = p_booking_id;
  DELETE FROM credit_notes     WHERE booking_id = p_booking_id;
  DELETE FROM invoices         WHERE booking_id = p_booking_id;
  DELETE FROM refund_requests  WHERE booking_id = p_booking_id;
  DELETE FROM payments         WHERE booking_id = p_booking_id;
  DELETE FROM booking_addons   WHERE booking_id = p_booking_id;
  DELETE FROM booking_rooms    WHERE booking_id = p_booking_id;
  DELETE FROM policy_snapshots WHERE booking_id = p_booking_id;
  DELETE FROM bookings         WHERE id = p_booking_id;
END;
$$;

COMMENT ON FUNCTION public.purge_test_booking IS
  'Service-role hard-delete of a booking + children (sets app.allow_policy_snapshot_purge so the immutable policy_snapshots can go). Pre-MVP test/wipe utility — used by the flow harness cleanup so bookings that snapshotted a policy no longer leak.';

REVOKE ALL ON FUNCTION public.purge_test_booking(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_test_booking(uuid) TO service_role;
