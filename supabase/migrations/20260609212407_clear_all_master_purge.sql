-- ════════════════════════════════════════════════════════════════════════
--  clear_all() — MASTER TEST-ONLY SYSTEM RESET
-- ════════════════════════════════════════════════════════════════════════
-- Call once to return the platform to a clean slate, KEEPING ONLY super_admin
-- account(s). Every other user (hosts + guests) and ALL of their records
-- (listings, bookings, payments, quotes, invoices, refunds, conversations,
-- messages, reviews, leads, marketing, notes, notifications, push tokens,
-- subscriptions …) are hard-deleted. Platform CONFIG/REFERENCE data (plans,
-- listing_categories, help content, platform_settings, amenity catalog, admin
-- roles, fx_rates) is preserved.
--
-- Mechanism: for each non-super-admin user we run the tested
-- app_purge_user_account() teardown (clears every RESTRICT dependent in
-- child→parent FK order, as guest AND as host), then DELETE the auth.users row
-- — which cascades user_profiles + the CASCADE graph (in_app_notifications,
-- push_tokens, user_notification_*, broadcast_acks) and the auth-schema
-- identities/sessions. A trailing sweep removes any profile-less auth users.
--
--   SELECT public.clear_all();           -- via SQL editor / psql
--   admin.rpc('clear_all')               -- via a service_role client
--
-- ⚠ TEST-ONLY. Hard-deletes real rows with no recovery. REMOVE THIS FUNCTION
--   (DROP FUNCTION public.clear_all) before the first public launch.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.clear_all()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid;
  v_users  integer := 0;
  v_keep   integer;
BEGIN
  SELECT count(*) INTO v_keep
    FROM user_profiles WHERE role = 'super_admin';

  IF v_keep = 0 THEN
    RAISE EXCEPTION
      'clear_all aborted: no super_admin exists — refusing to delete every user. Set a user_profiles.role = ''super_admin'' first.';
  END IF;

  -- Purge + delete every non-super-admin user.
  FOR v_uid IN
    SELECT id FROM user_profiles WHERE role IS DISTINCT FROM 'super_admin'
  LOOP
    PERFORM public.app_purge_user_account(v_uid);
    DELETE FROM auth.users WHERE id = v_uid;   -- cascades profile + auth schema
    v_users := v_users + 1;
  END LOOP;

  -- Sweep: any auth user with no surviving super_admin profile (e.g. an auth
  -- row that never had a user_profiles record).
  DELETE FROM auth.users u
   WHERE NOT EXISTS (
     SELECT 1 FROM user_profiles p
      WHERE p.id = u.id AND p.role = 'super_admin'
   );

  RETURN format(
    'clear_all complete — removed %s user(s); %s super_admin account(s) kept. Clean slate.',
    v_users, v_keep
  );
END;
$$;

COMMENT ON FUNCTION public.clear_all() IS
  'TEST-ONLY master reset: hard-deletes all non-super_admin users and every record they own, preserving platform config. DROP before launch.';

-- service_role only (Edge Functions / service-role clients). Never callable by
-- anon or signed-in users.
REVOKE ALL ON FUNCTION public.clear_all() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_all() TO service_role;
