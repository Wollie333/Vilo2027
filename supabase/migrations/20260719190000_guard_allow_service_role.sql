-- Fix the ownership guards added in 20260719180000 to also allow trusted
-- server-side service_role calls. check_feature_permission is invoked with the
-- admin (service_role) client in at least one place (lib/looking-for/leadAccess
-- lead-access limit check), where auth.uid() is null. Inside a SECURITY DEFINER
-- function current_user is the owner, so detect service_role from the request
-- JWT claims instead. Allowed callers: the owning host, platform staff, or a
-- service_role server call. Everyone else (an authenticated user passing another
-- host's / user's id) is denied.

CREATE OR REPLACE FUNCTION public.check_feature_permission(p_host_id uuid, p_feature_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (
       SELECT 1 FROM hosts
       WHERE id = p_host_id AND user_id = auth.uid() AND deleted_at IS NULL
     )
     AND NOT public.is_super_admin()
     AND coalesce((current_setting('request.jwt.claims', true))::jsonb ->> 'role', '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'is_enabled', hfo.is_enabled, 'limit_value', hfo.limit_value, 'source', 'override'
  ) INTO v_result
  FROM host_feature_overrides hfo
  WHERE hfo.host_id = p_host_id AND hfo.feature_key = p_feature_key
    AND (hfo.expires_at IS NULL OR hfo.expires_at > now())
  LIMIT 1;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  SELECT jsonb_build_object(
    'is_enabled', prf.is_enabled, 'limit_value', prf.limit_value, 'source', 'product'
  ) INTO v_result
  FROM product_features prf
  JOIN subscriptions s ON s.product_id = prf.product_id
  WHERE s.host_id = p_host_id AND s.status IN ('trialing','active')
    AND prf.feature_key = p_feature_key
  LIMIT 1;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  SELECT jsonb_build_object(
    'is_enabled', pf.is_enabled, 'limit_value', pf.limit_value, 'source', 'plan'
  ) INTO v_result
  FROM plan_features pf
  JOIN subscriptions s ON s.plan = pf.plan
  WHERE s.host_id = p_host_id AND s.status IN ('trialing','active')
    AND pf.feature_key = p_feature_key
  LIMIT 1;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  SELECT jsonb_build_object(
    'is_enabled', pf.is_enabled, 'limit_value', pf.limit_value, 'source', 'plan_free'
  ) INTO v_result
  FROM plan_features pf
  WHERE pf.plan = 'free' AND pf.feature_key = p_feature_key
  LIMIT 1;

  RETURN COALESCE(v_result,
    jsonb_build_object('is_enabled', false, 'limit_value', null, 'source', 'default'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_guest_post(p_user_id uuid, p_post_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_super_admin()
     AND coalesce((current_setting('request.jwt.claims', true))::jsonb ->> 'role', '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.looking_for_usage (user_id, action, post_id)
  VALUES (p_user_id, 'guest_post', p_post_id);
END;
$function$;
