-- The remote runs with sql_safe_updates ON, which rejects the unqualified
-- DELETEs in clear_all()'s activity scrub ("DELETE requires a WHERE clause").
-- Disable it for the function's own transaction with SET LOCAL. Full function
-- re-stated (CREATE OR REPLACE). TEST-ONLY — drop before launch.

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
  -- Allow the full-table scrubs below (this session/txn only).
  SET LOCAL sql_safe_updates = off;

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

  -- Sweep: any auth user with no surviving super_admin profile.
  DELETE FROM auth.users u
   WHERE NOT EXISTS (
     SELECT 1 FROM user_profiles p
      WHERE p.id = u.id AND p.role = 'super_admin'
   );

  -- Final scrub: empty residual activity / notification artifacts (incl. the
  -- super_admin's own). Child→parent order. Per-user SETTINGS/PREFERENCES are
  -- intentionally KEPT (they're config, not records).
  DELETE FROM notification_delivery_log;
  DELETE FROM pending_push_queue;
  DELETE FROM pending_digest_items;
  DELETE FROM notification_queue;
  DELETE FROM notification_events;
  DELETE FROM broadcast_acknowledgements;
  DELETE FROM in_app_notifications;
  DELETE FROM push_tokens;

  RETURN format(
    'clear_all complete — removed %s user(s); %s super_admin account(s) kept. Clean slate.',
    v_users, v_keep
  );
END;
$$;

REVOKE ALL ON FUNCTION public.clear_all() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_all() TO service_role;
