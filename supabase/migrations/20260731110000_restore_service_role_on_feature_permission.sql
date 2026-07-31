-- Restore the service_role allowance on check_feature_permission's IDOR guard.
--
-- ROOT CAUSE (regression): 20260719190000_guard_allow_service_role.sql added a
-- third allowed-caller branch so trusted server-side (service_role) calls, where
-- auth.uid() is NULL, are not treated as an IDOR attempt. 20260720070000_feature_
-- permission_deterministic.sql then rewrote this function to make steps 2/3
-- deterministic (ORDER BY most-permissive-first) — but it copied an OLDER guard
-- body that only checks (owning host OR super_admin) and SILENTLY dropped the
-- service_role clause.
--
-- IMPACT (proven live, service-role admin client → NOT_AUTHORIZED 42501): every
-- service-role caller has failed since 2026-07-20:
--   * grantSubscriptionCredits (lib/credits/wallet.ts) — resolveFeatureLimit
--     swallows the raise, returns limit 0, so a paid subscription grants ZERO
--     monthly Wielo (quote) credits. The dominant "silent no-op" bug class, on a
--     money path: paying hosts get no credits at activation OR renewal.
--   * leadAccess.ts unlockLeadForHost — same swallow → lead-access limit reads 0.
-- Host-session (own JWT) callers were unaffected, so the UI gates looked fine and
-- this stayed hidden.
--
-- FIX: re-add the exact service_role branch. Body is otherwise byte-for-byte the
-- live 20260720070000 definition (deterministic ORDER BY preserved). Additive,
-- idempotent CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.check_feature_permission(p_host_id uuid, p_feature_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_result jsonb;
BEGIN
  -- IDOR guard: caller must own this host, be platform staff, or be a trusted
  -- service_role server call (auth.uid() is NULL there — detect it from the JWT
  -- role claim, since inside SECURITY DEFINER current_user is the owner).
  IF NOT EXISTS (
       SELECT 1 FROM hosts
       WHERE id = p_host_id AND user_id = auth.uid() AND deleted_at IS NULL
     )
     AND NOT public.is_super_admin()
     AND coalesce((current_setting('request.jwt.claims', true))::jsonb ->> 'role', '') <> 'service_role'
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
