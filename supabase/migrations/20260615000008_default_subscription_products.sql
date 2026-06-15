-- Migration: seed 3 default subscription products (Free / Pro / Business)
--
-- These are starting-point defaults the super-admin can edit, duplicate, or
-- remove in the Products hub. Pricing is ZAR, VAT-inclusive, monthly.
--
-- Feature permissions follow real app usage (see lib/products/features.ts):
--   - "total" caps (businesses, listings, staff, conversations) are absolute.
--   - "per_business" caps (payment gateways / EFT) are stored as 1 PER business
--     and multiply by the business count at enforcement (entitlements.ts).
--   - toggles are on/off (limit_value NULL).
-- An enabled qty feature with limit_value NULL means unlimited.
--
-- Idempotent: re-running upserts the products and rewrites their features.

-- Stable IDs so feature rows can reference them.
-- free     a0000000-0000-4000-8000-000000000001
-- pro      a0000000-0000-4000-8000-000000000002
-- business a0000000-0000-4000-8000-000000000003

INSERT INTO public.products
  (id, name, description, type, price, currency, billing_cycle,
   is_active, is_recommended, is_visible, sort_order, trial_days,
   affiliate_type, affiliate_value, payment_methods, slug, bullets)
VALUES
  ('a0000000-0000-4000-8000-000000000001',
   'Free', 'Get listed and take enquiries — no card required.',
   'subscription', 0, 'ZAR', 'monthly',
   true, false, true, 0, 0, 'none', 0, '{paystack}', 'free',
   '["Appear in the Vilo Directory","1 business, 1 listing","Up to 10 active conversations","Enquiry-only — no in-platform payments"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000002',
   'Pro', 'For growing hosts who take real bookings.',
   'subscription', 599, 'ZAR', 'monthly',
   true, true, true, 1, 14, 'none', 0, '{paystack,eft}', 'pro',
   '["Up to 5 listings, 2 staff seats","Direct & instant booking + calendar","Paystack, PayPal & EFT payments","Basic analytics, custom page URL & templates"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000003',
   'Business', 'Multi-property operators who want everything.',
   'subscription', 1199, 'ZAR', 'monthly',
   true, false, true, 2, 14, 'none', 0, '{paystack,eft}', 'business',
   '["Up to 3 businesses, unlimited listings, 10 staff seats","Everything in Pro","Top directory placement","Advanced analytics & CSV export"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  billing_cycle = EXCLUDED.billing_cycle,
  is_active = EXCLUDED.is_active,
  is_recommended = EXCLUDED.is_recommended,
  is_visible = EXCLUDED.is_visible,
  sort_order = EXCLUDED.sort_order,
  trial_days = EXCLUDED.trial_days,
  payment_methods = EXCLUDED.payment_methods,
  slug = EXCLUDED.slug,
  bullets = EXCLUDED.bullets,
  updated_at = now();

-- Rewrite feature permissions for these three products.
DELETE FROM public.product_features
WHERE product_id IN (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003'
);

-- (product_id, feature_key, is_enabled, limit_value). NULL limit = unlimited.
INSERT INTO public.product_features (product_id, feature_key, is_enabled, limit_value)
VALUES
  -- ── Free ─────────────────────────────────────────────────────────────
  ('a0000000-0000-4000-8000-000000000001', 'businesses_limit',  true, 1),
  ('a0000000-0000-4000-8000-000000000001', 'listings_limit',    true, 1),
  ('a0000000-0000-4000-8000-000000000001', 'inbox_limit',       true, 10),
  ('a0000000-0000-4000-8000-000000000001', 'enquiry_only',      true, NULL),
  ('a0000000-0000-4000-8000-000000000001', 'directory_listing', true, NULL),
  ('a0000000-0000-4000-8000-000000000001', 'inbox_messages',    true, NULL),
  ('a0000000-0000-4000-8000-000000000001', 'reviews_respond',   true, NULL),

  -- ── Pro ──────────────────────────────────────────────────────────────
  ('a0000000-0000-4000-8000-000000000002', 'businesses_limit',    true, 1),
  ('a0000000-0000-4000-8000-000000000002', 'listings_limit',      true, 5),
  ('a0000000-0000-4000-8000-000000000002', 'staff_seats',         true, 2),
  ('a0000000-0000-4000-8000-000000000002', 'inbox_limit',         true, NULL),
  ('a0000000-0000-4000-8000-000000000002', 'payment_paystack',    true, 1),
  ('a0000000-0000-4000-8000-000000000002', 'payment_paypal',      true, 1),
  ('a0000000-0000-4000-8000-000000000002', 'payment_eft',         true, 1),
  ('a0000000-0000-4000-8000-000000000002', 'direct_booking',      true, NULL),
  ('a0000000-0000-4000-8000-000000000002', 'instant_booking',     true, NULL),
  ('a0000000-0000-4000-8000-000000000002', 'calendar_management', true, NULL),
  ('a0000000-0000-4000-8000-000000000002', 'directory_listing',   true, NULL),
  ('a0000000-0000-4000-8000-000000000002', 'inbox_messages',      true, NULL),
  ('a0000000-0000-4000-8000-000000000002', 'reviews_respond',     true, NULL),
  ('a0000000-0000-4000-8000-000000000002', 'analytics_basic',     true, NULL),
  ('a0000000-0000-4000-8000-000000000002', 'custom_profile_url',  true, NULL),
  ('a0000000-0000-4000-8000-000000000002', 'canned_replies',      true, NULL),

  -- ── Business ─────────────────────────────────────────────────────────
  ('a0000000-0000-4000-8000-000000000003', 'businesses_limit',    true, 3),
  ('a0000000-0000-4000-8000-000000000003', 'listings_limit',      true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'staff_seats',         true, 10),
  ('a0000000-0000-4000-8000-000000000003', 'inbox_limit',         true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'payment_paystack',    true, 1),
  ('a0000000-0000-4000-8000-000000000003', 'payment_paypal',      true, 1),
  ('a0000000-0000-4000-8000-000000000003', 'payment_eft',         true, 1),
  ('a0000000-0000-4000-8000-000000000003', 'direct_booking',      true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'instant_booking',     true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'calendar_management', true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'directory_listing',   true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'directory_priority',  true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'inbox_messages',      true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'reviews_respond',     true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'analytics_basic',     true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'analytics_advanced',  true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'custom_profile_url',  true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'canned_replies',      true, NULL),
  ('a0000000-0000-4000-8000-000000000003', 'export_bookings',     true, NULL);
