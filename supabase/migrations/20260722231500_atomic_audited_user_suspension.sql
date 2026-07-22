-- AGENT_RULES.md §6.8 — finance and moderation actions must be atomic.
--
-- The rule said "route the mutation through a Supabase Edge Function that wraps
-- BEGIN ... INSERT INTO admin_audit_log ... COMMIT in a single transaction".
-- An Edge Function on its own does NOT deliver that: it talks to the database
-- over PostgREST, and every PostgREST request is its own transaction, so a
-- mutation call and an audit call from the same function are still two separate
-- commits. Moving the code to Deno changes where it runs, not how it commits.
--
-- The only thing that makes them atomic is putting BOTH statements inside ONE
-- Postgres transaction. A plpgsql function body IS one transaction, so that is
-- what this is: suspend/reinstate mutates `user_profiles` AND writes the
-- `admin_audit_log` row together. Either both land or neither does.
--
-- Callers keep doing permission checks in the app (requirePermission →
-- has_admin_permission); this function is the atomic tail, not the gate.

CREATE OR REPLACE FUNCTION public.admin_set_user_active(
  p_user_id       uuid,
  p_is_active     boolean,
  p_admin_id      uuid,
  p_reason        text,
  p_impersonating uuid DEFAULT NULL,
  p_ip            inet DEFAULT NULL,
  p_user_agent    text DEFAULT NULL
)
RETURNS TABLE (id uuid, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before boolean;
BEGIN
  -- Fail closed. SECURITY DEFINER runs as the owner, so without this any role
  -- that can reach the function could suspend anyone. Only the service-role
  -- client (server actions, after requirePermission) may call it; `auth.uid()
  -- IS NULL` additionally covers internal/superuser callers with no JWT.
  IF NOT (
    coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '')
      = 'service_role'
    OR auth.uid() IS NULL
  ) THEN
    RAISE EXCEPTION 'admin_set_user_active: not authorised'
      USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'admin_set_user_active: reason is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT up.is_active INTO v_before
  FROM user_profiles up WHERE up.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_set_user_active: no such user'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE user_profiles up
     SET is_active = p_is_active
   WHERE up.id = p_user_id;

  -- Same transaction as the UPDATE above. If this insert fails — a bad
  -- admin_id, a CHECK violation, anything — the suspension is rolled back with
  -- it, which is the entire point of §6.8.
  INSERT INTO admin_audit_log (
    admin_id, impersonating, action, target_type, target_id,
    payload, ip_address, user_agent
  )
  VALUES (
    p_admin_id,
    p_impersonating,
    CASE WHEN p_is_active THEN 'user.reinstate' ELSE 'user.suspend' END,
    'user',
    p_user_id,
    jsonb_build_object(
      'before', jsonb_build_object('is_active', v_before),
      'after',  jsonb_build_object('is_active', p_is_active),
      'reason', p_reason,
      'atomic', true,
      'owner_user_id', p_user_id
    ),
    p_ip,
    p_user_agent
  );

  RETURN QUERY
    SELECT up.id, up.is_active FROM user_profiles up WHERE up.id = p_user_id;
END;
$$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, which makes a
-- "REVOKE ... FROM anon" a no-op. Revoke from PUBLIC, then grant narrowly.
REVOKE ALL ON FUNCTION public.admin_set_user_active(
  uuid, boolean, uuid, text, uuid, inet, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_active(
  uuid, boolean, uuid, text, uuid, inet, text
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_active(
  uuid, boolean, uuid, text, uuid, inet, text
) TO service_role;

COMMENT ON FUNCTION public.admin_set_user_active(
  uuid, boolean, uuid, text, uuid, inet, text
) IS
  'Atomically suspends/reinstates a user AND writes its admin_audit_log row in '
  'one transaction (AGENT_RULES.md §6.8). Service-role only; the app does the '
  'permission check before calling.';
