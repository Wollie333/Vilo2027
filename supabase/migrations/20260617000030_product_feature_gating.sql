-- Migration: product-driven feature gating
--
-- Vilo's catalog moved to admin-created `products` (+ `product_features`). A
-- host's active product is recorded on `subscriptions.product_id`. Gating,
-- scopes and limits must therefore resolve from the PRODUCT the host actually
-- bought — not from a hardcoded plan tier.
--
-- This rewires check_feature_permission so the resolution order is:
--   1. host_feature_overrides   (per-host, most specific — unchanged)
--   2. product_features         (via subscriptions.product_id — NEW, authoritative)
--   3. plan_features            (via subscriptions.plan — legacy fallback)
--   4. default disabled
--
-- It is purely additive: when product_id is null, or the active product does not
-- define a given feature_key, resolution falls through to plan_features exactly
-- as before. A product_features row is authoritative whether it enables OR
-- disables the feature — only a missing row falls through. Accounting already
-- keys off products (platform_ledger.product_id); this closes the gating gap so
-- the whole system is product-driven end to end.

CREATE OR REPLACE FUNCTION check_feature_permission(
  p_host_id     uuid,
  p_feature_key text
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  -- 1. Per-host override (most specific, checked first)
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

  -- 3. Plan-level feature (legacy fallback — pre-product subscriptions / free)
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

  -- 4. Default: disabled
  RETURN COALESCE(v_result,
    jsonb_build_object('is_enabled', false, 'limit_value', null, 'source', 'default'));
END;
$$;
