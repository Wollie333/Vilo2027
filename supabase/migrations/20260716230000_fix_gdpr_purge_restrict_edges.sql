-- Fix app_purge_user_account: the GDPR/POPIA erasure path could not erase any
-- account that held a forfeit statement, a credit note, a Looking-For post or a
-- Looking-For response. The request simply errored, so the legal obligation went
-- unmet. Derived from the live FK graph rather than by inspection: every
-- RESTRICT/NO ACTION edge reachable from user_profiles/hosts is now cleared, in
-- an order that respects the graph.
--
-- What was missing (4 tables, not the 3 previously recorded):
--   1. forfeit_statements -> bookings AND hosts (both RESTRICT). Its immutability
--      trigger also blocks the delete unless app.allow_forfeit_statement_purge is
--      set -- a GUC nothing in the codebase set, so even clearing it would fail.
--   2. credit_notes -> invoices AND bookings AND hosts (all RESTRICT).
--   3. looking_for_responses -> quotes (NO ACTION).
--   4. looking_for_posts -> bookings via fulfilled_booking_id (NO ACTION).
--
-- Two ordering traps the graph exposes:
--   * quotes must die BETWEEN looking_for_responses and looking_for_posts
--     (responses -> quotes -> posts), and now also BEFORE bookings, because
--     looking_for_posts.fulfilled_booking_id references bookings.
--   * credit_notes must die BEFORE invoices (invoice_id is NOT NULL RESTRICT).
--
-- Also fixes a second, separate defect nothing had noticed: purging a GUEST.
-- looking_for_posts.guest_id CASCADEs from user_profiles, but quotes.looking_for_post_id
-- is NO ACTION -- so deleting a guest who had received quotes would fail on the
-- cascade, outside this function, with no way to succeed. Their posts (and the
-- quotes on them) are now cleared here, before auth.users is deleted.
--
-- A booking belonging to the purged account may be referenced by ANOTHER guest's
-- looking_for_post.fulfilled_booking_id. That row is a third party's data, so the
-- reference is severed (SET NULL) rather than deleting their post.
--
-- Previous definition: 20260712150000_policy_snapshot_immutability_and_refund_status.sql

CREATE OR REPLACE FUNCTION public.app_purge_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  DELETE FROM admin_audit_log         WHERE admin_id = p_user_id OR impersonating  = p_user_id;
  DELETE FROM data_requests           WHERE user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.app_purge_user_account IS
  'GDPR/POPIA account erasure. Clears every RESTRICT/NO ACTION dependent of a user (as guest and as host) so auth.users -> user_profiles can cascade. Severs third-party looking_for_posts.fulfilled_booking_id rather than deleting other users rows. Sets the policy_snapshot + forfeit_statement immutability exemptions for its own transaction only.';

REVOKE ALL ON FUNCTION public.app_purge_user_account(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_purge_user_account(uuid) TO service_role;
