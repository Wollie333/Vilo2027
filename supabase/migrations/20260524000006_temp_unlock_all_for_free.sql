-- Migration: TEMPORARY — unlock every feature for the 'free' plan
--
-- Goal: let the founder smoke-test every gated feature without juggling
-- subscription state. Permissions / role gating come back later.
--
-- This sets is_enabled = true and clears every limit_value (NULL = no cap)
-- for every plan_features row where plan = 'free'. The 'basic' / 'pro' /
-- 'business' tiers are untouched.
--
-- Reverse with a follow-up migration that re-runs the FREE block from
-- 20260501000017_seed_plan_features.sql (or just `supabase db reset` if
-- pre-MVP policy still applies).

UPDATE plan_features
   SET is_enabled  = true,
       limit_value = NULL
 WHERE plan = 'free';

-- Belt + braces: insert the 'addons' row in case the gate seeding ran
-- before 20260524000005 (no-op on conflict).
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description)
VALUES ('free', 'addons', true, NULL, 'Booking add-ons catalog (TEMP unlocked)')
ON CONFLICT (plan, feature_key) DO UPDATE
  SET is_enabled  = true,
      limit_value = NULL;
