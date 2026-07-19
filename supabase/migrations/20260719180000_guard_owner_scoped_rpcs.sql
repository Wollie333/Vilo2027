-- Cross-tenant hardening, pass 2: add an ownership guard to the SECURITY DEFINER
-- functions that ARE legitimately called from the authenticated client, and lock
-- the two policy seeders (now called via the admin client) to service_role.
--
-- Guard pattern mirrors the already-hardened reporting functions (e.g.
-- fetch_host_savings): security definer bypasses RLS, so verify the caller owns
-- the target (auth.uid() maps to the host / is the user), or is platform staff.

-- 1. check_feature_permission — a host's feature entitlements. Only ever called
--    from the host's own dashboard (authenticated) with their own host id. Guard
--    it so an authenticated user can't probe another host's entitlements.
CREATE OR REPLACE FUNCTION public.check_feature_permission(p_host_id uuid, p_feature_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_result jsonb;
BEGIN
  -- IDOR guard: caller must own this host (or be platform staff).
  IF NOT EXISTS (
       SELECT 1 FROM hosts
       WHERE id = p_host_id AND user_id = auth.uid() AND deleted_at IS NULL
     )
     AND NOT public.is_super_admin()
  THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;

  -- 1. Per-host override (most specific)
  SELECT jsonb_build_object(
    'is_enabled', hfo.is_enabled,
    'limit_value', hfo.limit_value,
    'source', 'override'
  ) INTO v_result
  FROM host_feature_overrides hfo
  WHERE hfo.host_id = p_host_id
    AND hfo.feature_key = p_feature_key
    AND (hfo.expires_at IS NULL OR hfo.expires_at > now())
  LIMIT 1;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  -- 2. Product-level feature (authoritative — the product the host actually has)
  SELECT jsonb_build_object(
    'is_enabled', prf.is_enabled,
    'limit_value', prf.limit_value,
    'source', 'product'
  ) INTO v_result
  FROM product_features prf
  JOIN subscriptions s ON s.product_id = prf.product_id
  WHERE s.host_id = p_host_id
    AND s.status IN ('trialing','active')
    AND prf.feature_key = p_feature_key
  LIMIT 1;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  -- 3. Plan-level feature for the host's ACTIVE membership plan (legacy fallback)
  SELECT jsonb_build_object(
    'is_enabled', pf.is_enabled,
    'limit_value', pf.limit_value,
    'source', 'plan'
  ) INTO v_result
  FROM plan_features pf
  JOIN subscriptions s ON s.plan = pf.plan
  WHERE s.host_id = p_host_id
    AND s.status IN ('trialing','active')
    AND pf.feature_key = p_feature_key
  LIMIT 1;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  -- 3b. FREE baseline floor.
  SELECT jsonb_build_object(
    'is_enabled', pf.is_enabled,
    'limit_value', pf.limit_value,
    'source', 'plan_free'
  ) INTO v_result
  FROM plan_features pf
  WHERE pf.plan = 'free'
    AND pf.feature_key = p_feature_key
  LIMIT 1;

  -- 4. Default: disabled
  RETURN COALESCE(v_result,
    jsonb_build_object('is_enabled', false, 'limit_value', null, 'source', 'default'));
END;
$function$;

-- 2. record_guest_post — logs a guest's own Looking-For post. Guard so a caller
--    can only record usage for themselves. (Converted from SQL to plpgsql.)
CREATE OR REPLACE FUNCTION public.record_guest_post(p_user_id uuid, p_post_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_super_admin()
  THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.looking_for_usage (user_id, action, post_id)
  VALUES (p_user_id, 'guest_post', p_post_id);
END;
$function$;

-- 3. Policy seeders — now called via the admin client (see policies/page.tsx +
--    policies/actions.ts). Lock to service_role.
REVOKE EXECUTE ON FUNCTION public.ensure_host_booking_terms(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_host_booking_terms(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_host_policy_presets(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_host_policy_presets(uuid) TO service_role;
