-- Floor every host to the FREE plan baseline when they hold no ACTIVE/TRIALING
-- membership.
--
-- Bug this fixes: pausing or cancelling a membership sets subscriptions.status
-- to 'paused' (self-serve pause + cancellation request). check_feature_permission
-- only consults product_features / plan_features for status IN ('trialing','active'),
-- so a paused/cancelled/past_due host resolved the 'default' object (everything
-- disabled) — strictly WORSE than a free-plan host. Per the platform model
-- ("no active upgrade → free guest tier"), such a host must drop to the free
-- baseline, not below it.
--
-- The new step 3b only changes outcomes for feature_keys that plan_features
-- DEFINES for plan='free' (the deliberately-minimal guest baseline); every other
-- key still falls through to default-disabled. It is also a harmless floor for
-- active hosts (they resolve product/plan first; 3b only supplies a free-baseline
-- value they'd otherwise miss). search_path pinned to preserve the §6.4 hardening
-- that CREATE OR REPLACE would otherwise reset.

CREATE OR REPLACE FUNCTION check_feature_permission(
  p_host_id     uuid,
  p_feature_key text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
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

  -- 3b. FREE baseline floor — no active/trialing membership resolved anything, so
  --     fall back to the free plan (guest tier). Keeps a paused/cancelled/past_due
  --     host at free-guest access rather than below it.
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
$$;
