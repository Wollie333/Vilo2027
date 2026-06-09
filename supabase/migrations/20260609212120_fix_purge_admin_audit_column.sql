-- Follow-up drift fix: admin_audit_log has no target_user_id column. Its only
-- user FKs are admin_id and impersonating (impersonation_sessions still uses
-- admin_id + target_user_id). Correct the admin-hat cleanup line so the purge
-- doesn't fail planning. Full function re-stated (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.app_purge_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid;
BEGIN
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
    DELETE FROM listings WHERE host_id = v_host_id;
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
