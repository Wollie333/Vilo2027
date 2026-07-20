-- Migration: MB audit fix #1 — make check_feature_permission deterministic when a
-- multi-business/multi-product host holds SEVERAL active subscriptions that declare
-- the SAME feature_key (e.g. a membership + an add-on service both setting a limit).
--
-- Steps 2 (product) and 3 (plan) previously did `LIMIT 1` with no ORDER BY, so the
-- resolved entitlement was an arbitrary winner that could flip between requests.
-- Order most-permissive-first (enabled beats disabled; higher/unlimited limit wins)
-- so the host consistently gets the best entitlement any of their subs grants.
-- Everything else (IDOR guard, override/free-baseline tiers) is unchanged.

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
  ORDER BY hfo.is_enabled DESC, hfo.limit_value DESC NULLS FIRST
  LIMIT 1;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  -- 2. Product-level feature (authoritative — the product the host actually has).
  --    Most-permissive-first so overlapping subs resolve deterministically.
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
  ORDER BY prf.is_enabled DESC, prf.limit_value DESC NULLS FIRST
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
  ORDER BY pf.is_enabled DESC, pf.limit_value DESC NULLS FIRST
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
