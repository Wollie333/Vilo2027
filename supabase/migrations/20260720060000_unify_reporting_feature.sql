-- Migration: H3 — unify the reporting permission into a single `reporting` key.
--
-- There were two feature keys: `analytics_basic` (the ONLY live gate — on
-- /dashboard/reports) and `analytics_advanced` (gated nothing anywhere — dead).
-- Collapse to one `reporting` key. Pre-MVP (no real users) → a destructive reshape
-- is fine. Idempotent + UNIQUE-constraint-safe: uniques are (plan|product_id|host_id,
-- feature_key), so we drop any pre-existing `reporting` row that would collide with
-- the rename before updating.

-- 1) Drop the dead advanced key entirely.
DELETE FROM public.plan_features          WHERE feature_key = 'analytics_advanced';
DELETE FROM public.product_features       WHERE feature_key = 'analytics_advanced';
DELETE FROM public.host_feature_overrides WHERE feature_key = 'analytics_advanced';

-- 2) Rename analytics_basic → reporting (remove colliding reporting rows first).
DELETE FROM public.plan_features pf
  WHERE pf.feature_key = 'reporting'
    AND EXISTS (SELECT 1 FROM public.plan_features x
                WHERE x.plan = pf.plan AND x.feature_key = 'analytics_basic');
UPDATE public.plan_features SET feature_key = 'reporting'
  WHERE feature_key = 'analytics_basic';

DELETE FROM public.product_features pf
  WHERE pf.feature_key = 'reporting'
    AND EXISTS (SELECT 1 FROM public.product_features x
                WHERE x.product_id = pf.product_id AND x.feature_key = 'analytics_basic');
UPDATE public.product_features SET feature_key = 'reporting'
  WHERE feature_key = 'analytics_basic';

DELETE FROM public.host_feature_overrides hf
  WHERE hf.feature_key = 'reporting'
    AND EXISTS (SELECT 1 FROM public.host_feature_overrides x
                WHERE x.host_id = hf.host_id AND x.feature_key = 'analytics_basic');
UPDATE public.host_feature_overrides SET feature_key = 'reporting'
  WHERE feature_key = 'analytics_basic';
