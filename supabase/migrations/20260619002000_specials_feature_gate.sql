-- ============================================================
-- Specials S7a — feature gate seed
-- ============================================================
-- Pre-MVP policy (CLAUDE.md / AGENT_RULES §3.4): every new gated feature is OPEN
-- on every plan so the founder can smoke-test end-to-end. The product editor
-- unions this key from CANONICAL_PRODUCT_FEATURES (lib/products/features.ts), and
-- the action + UI gate (lib/specials/gate.ts -> canUseSpecials) short-circuits to
-- true pre-MVP. This seed keeps the plan_features fallback consistent so that
-- when the pre-MVP short-circuit is removed at launch, check_feature_permission
-- already returns the right answer per plan (flip these rows then).
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
('free',     'specials', true, null, 'Create pre-packaged accommodation deals'),
('basic',    'specials', true, null, 'Create pre-packaged accommodation deals'),
('pro',      'specials', true, null, 'Create pre-packaged accommodation deals'),
('business', 'specials', true, null, 'Create pre-packaged accommodation deals')
ON CONFLICT (plan, feature_key) DO NOTHING;
