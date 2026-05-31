-- Migration: app_purge_user_account(p_user_id) — robust self-service / test
-- account teardown.
--
-- WHY: deleteAccountAction used a hand-written list of `.delete()` calls that
-- (a) ignored the returned PostgREST error and (b) missed most of the RESTRICT
-- chain a host accumulates (bookings on their listings, payments, refunds,
-- invoices, reviews, policy_snapshots, refund_requests …). Any one un-cleared
-- RESTRICT row silently stayed, then `auth.admin.deleteUser` failed because
-- `user_profiles` could not cascade — surfacing as
-- "Could not finalise account deletion."
--
-- This function purges every public-schema row that would block the
-- `auth.users → user_profiles` cascade, in child→parent FK order, inside a
-- single transaction. The caller (Server Action, service_role) then calls
-- `auth.admin.deleteUser`, which now cascades cleanly.
--
-- Pre-MVP policy (CLAUDE.md): hard-delete is acceptable; historical rows
-- (bookings, payments, invoices, audit entries) for the purged user are
-- removed alongside them. Switch to anonymise-then-soft-delete before launch.

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

  -- A "owned booking" = one where the user is the guest OR the host. We clear
  -- its RESTRICT children before the booking itself.
  --   refunds → (payments, bookings)   [delete refunds first]
  --   payments, policy_snapshots, reviews, invoices, refund_requests → bookings

  DELETE FROM refunds r
   WHERE r.booking_id IN (
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

  -- reviews: as guest, plus any on the user's own bookings. review_flags
  -- cascade from reviews.
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

  DELETE FROM refund_requests rr
   WHERE rr.host_id = v_host_id
      OR rr.guest_id = p_user_id
      OR rr.booking_id IN (
        SELECT id FROM bookings
         WHERE guest_id = p_user_id OR host_id = v_host_id
      );

  -- Bookings themselves. Cascades booking_addons, booking_rooms,
  -- booking_status_history, review_request_queue; nulls blocked_dates.booking_id
  -- and quotes.converted_booking_id.
  DELETE FROM bookings
   WHERE guest_id = p_user_id OR host_id = v_host_id;

  IF v_host_id IS NOT NULL THEN
    -- quotes RESTRICT-reference listings, so clear before listings.
    -- (quote_rooms / quote_addons cascade; blocked_dates.quote_id cascades.)
    DELETE FROM quotes WHERE host_id = v_host_id;

    -- listings cascade rooms, amenities, policy assignments, featured_listings
    -- (by listing_id), ical_feeds, etc. Their RESTRICT parents (bookings,
    -- invoices, quotes) are already gone above.
    DELETE FROM listings WHERE host_id = v_host_id;

    -- host-scoped admin overrides.
    DELETE FROM host_feature_overrides WHERE host_id = v_host_id;

    -- hosts cascades subscriptions, subscription_history, host_counters,
    -- eft_banking_details, addons, conversations, policies, business details.
    DELETE FROM hosts WHERE id = v_host_id;
  END IF;

  -- Direct user_profiles RESTRICT references made by this user wearing an
  -- admin/staff hat (or as a target of admin actions).
  DELETE FROM host_feature_overrides WHERE overridden_by = p_user_id;
  DELETE FROM featured_listings      WHERE featured_by   = p_user_id;
  DELETE FROM broadcast_announcements WHERE created_by   = p_user_id;
  DELETE FROM admin_message_batches  WHERE created_by    = p_user_id;
  DELETE FROM impersonation_sessions WHERE admin_id = p_user_id OR impersonating = p_user_id;
  DELETE FROM admin_audit_log        WHERE admin_id = p_user_id OR target_user_id = p_user_id;

  -- data_requests cascade on the user delete, but clear explicitly so the
  -- function is self-contained.
  DELETE FROM data_requests WHERE user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.app_purge_user_account(uuid) IS
  'Hard-deletes every public-schema RESTRICT dependent of a user (as guest and as host) so auth.users→user_profiles can cascade. Pre-MVP teardown helper; called by deleteAccountAction before auth.admin.deleteUser.';

REVOKE ALL ON FUNCTION public.app_purge_user_account(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_purge_user_account(uuid) TO service_role;
