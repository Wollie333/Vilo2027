-- One-off data wipe: remove ALL host + guest accounts and every row that hangs
-- off them, returning the app to a fresh "no users" state for testing.
--
-- SAFETY: TRUNCATE ... CASCADE only follows foreign keys that POINT AT the two
-- root tables below (i.e. their child/dependent rows). Reference / config tables
-- are PARENTS of those children, never children, so they are left fully intact:
--   site_themes, plans, plan_prices, plan_features, products, product_features,
--   amenity_catalog, amenity_groups, listing_categories, special_categories,
--   help_* (help center), notification_categories, notification_events,
--   admin_roles, admin_permissions, admin_role_permissions, platform_settings,
--   platform_integrations/services/payment_settings, fx_rates.
--
-- This is data-only (no schema change). On a fresh environment it is a no-op
-- because the seed migrations never create host/user rows.

BEGIN;

TRUNCATE public.hosts, public.user_profiles RESTART IDENTITY CASCADE;

-- Clear Supabase auth (users cascades to sessions, identities, refresh tokens).
DELETE FROM auth.users;

COMMIT;
