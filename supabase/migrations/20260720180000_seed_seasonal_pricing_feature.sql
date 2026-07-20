-- Enable the seasonal_pricing feature so hosts can add seasonal rates.
--
-- check_feature_permission resolves product_features (via the host's subscribed
-- product) → plan_features → free baseline → default DISABLED. seasonal_pricing
-- had NO rows anywhere, so a paying host (e.g. the Starter product) hit the
-- default and the onboarding "seasonal pricing" step / the /dashboard/seasonal-
-- pricing manager blocked with "Seasonal pricing isn't available on your plan."
--
-- Seed it enabled on EVERY product + plan (pre-MVP: open so the founder can
-- smoke-test). limit_value = max seasonal rules the account may create; the
-- founder can adjust it per product in Admin → Products (the feature is now in
-- the canonical catalog as a "total"/quantity feature) or leave it. Chosen a
-- generous default; NULL would mean unlimited.

INSERT INTO public.product_features (product_id, feature_key, is_enabled, limit_value)
SELECT id, 'seasonal_pricing', true, 50 FROM public.products
ON CONFLICT (product_id, feature_key)
  DO UPDATE SET is_enabled = EXCLUDED.is_enabled, limit_value = EXCLUDED.limit_value;

INSERT INTO public.plan_features (plan, feature_key, is_enabled, limit_value)
VALUES
  ('free', 'seasonal_pricing', true, 50),
  ('pro', 'seasonal_pricing', true, 50),
  ('business', 'seasonal_pricing', true, 50)
ON CONFLICT (plan, feature_key)
  DO UPDATE SET is_enabled = EXCLUDED.is_enabled, limit_value = EXCLUDED.limit_value;
