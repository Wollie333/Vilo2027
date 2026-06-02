-- Migration: Host RLS policies for refund_requests (root-cause fix)
--
-- Bug: "new row violates row-level security policy for table refund_requests"
-- when a host issues a refund. The v1.1 RLS migration created a guest INSERT
-- policy (guest_create_refund) and a narrow host UPDATE policy (pending/failed
-- only), but NO host INSERT policy and no coverage for the host-initiated
-- approved→completed transition. So host refunds could never be written through
-- the user-scoped client.
--
-- Add a host INSERT policy and broaden the host UPDATE to the host-managed
-- lifecycle statuses (still excluding escalated/disputed/completed, which are
-- admin/terminal). Takes effect immediately on the DB — no app redeploy needed.

-- Hosts can create refunds for their own bookings (host-initiated refunds).
DROP POLICY IF EXISTS "host_create_refund" ON refund_requests;
CREATE POLICY "host_create_refund" ON refund_requests
  FOR INSERT WITH CHECK (host_id = get_my_host_id());

-- Hosts can advance their own refunds through the lifecycle they control:
-- approve (pending→approved), process/complete (approved→processing/completed),
-- and retry failed ones. The USING clause guards the *current* row status.
DROP POLICY IF EXISTS "host_action_refunds" ON refund_requests;
CREATE POLICY "host_action_refunds" ON refund_requests
  FOR UPDATE
  USING (
    host_id = get_my_host_id()
    AND status IN ('pending', 'approved', 'processing', 'failed')
  )
  WITH CHECK (host_id = get_my_host_id());

-- Same for staff acting on behalf of the host.
DROP POLICY IF EXISTS "staff_action_refunds" ON refund_requests;
CREATE POLICY "staff_action_refunds" ON refund_requests
  FOR UPDATE
  USING (
    host_id = get_my_host_id_as_staff()
    AND status IN ('pending', 'approved', 'processing', 'failed')
  )
  WITH CHECK (host_id = get_my_host_id_as_staff());

DROP POLICY IF EXISTS "staff_create_refund" ON refund_requests;
CREATE POLICY "staff_create_refund" ON refund_requests
  FOR INSERT WITH CHECK (host_id = get_my_host_id_as_staff());
