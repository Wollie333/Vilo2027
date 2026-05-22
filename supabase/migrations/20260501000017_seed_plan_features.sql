-- Migration: Seed plan_features for all 4 tiers
-- Per supabase_database.md §21

-- ─── FREE ─────────────────────────────────────────────────────
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
('free','directory_listing',   true,  null,'Appear in Vilo Directory'),
('free','directory_priority',  false, null,'Boosted directory placement'),
('free','direct_booking',      false, null,'Full booking flow'),
('free','enquiry_only',        true,  null,'Enquiry flow only'),
('free','inbox_messages',      true,  null,'Access to inbox'),
('free','inbox_limit',         true,  10,  'Max 10 active conversations'),
('free','payment_paystack',    false, null,'Paystack payments'),
('free','payment_paypal',      false, null,'PayPal payments'),
('free','payment_eft',         false, null,'Manual EFT'),
('free','listings_limit',      true,  1,   'Max 1 listing'),
('free','staff_seats',         true,  0,   'No staff seats'),
('free','reviews_respond',     false, null,'Respond to reviews'),
('free','calendar_management', false, null,'Block dates'),
('free','instant_booking',     false, null,'Instant booking'),
('free','analytics_basic',     false, null,'Basic stats'),
('free','analytics_advanced',  false, null,'Full analytics'),
('free','custom_profile_url',  false, null,'Custom handle'),
('free','export_bookings',     false, null,'CSV export'),
('free','canned_replies',      false, null,'Message templates')
ON CONFLICT (plan, feature_key) DO NOTHING;

-- ─── BASIC ────────────────────────────────────────────────────
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
('basic','directory_listing',   true,  null,'Appear in Vilo Directory'),
('basic','directory_priority',  false, null,'Boosted directory placement'),
('basic','direct_booking',      true,  null,'Full booking flow'),
('basic','enquiry_only',        true,  null,'Enquiry flow'),
('basic','inbox_messages',      true,  null,'Full inbox'),
('basic','inbox_limit',         false, null,'Unlimited conversations'),
('basic','payment_paystack',    true,  null,'Paystack payments'),
('basic','payment_paypal',      true,  null,'PayPal payments'),
('basic','payment_eft',         true,  null,'Manual EFT'),
('basic','listings_limit',      true,  1,   'Max 1 listing'),
('basic','staff_seats',         true,  1,   'Max 1 staff seat'),
('basic','reviews_respond',     true,  null,'Respond to reviews'),
('basic','calendar_management', true,  null,'Block dates'),
('basic','instant_booking',     true,  null,'Instant booking'),
('basic','analytics_basic',     true,  null,'Basic stats'),
('basic','analytics_advanced',  false, null,'Full analytics'),
('basic','custom_profile_url',  true,  null,'Custom handle'),
('basic','export_bookings',     false, null,'CSV export'),
('basic','canned_replies',      false, null,'Message templates')
ON CONFLICT (plan, feature_key) DO NOTHING;

-- ─── PRO ──────────────────────────────────────────────────────
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
('pro','directory_listing',   true,  null,'Appear in Vilo Directory'),
('pro','directory_priority',  true,  null,'Priority directory placement'),
('pro','direct_booking',      true,  null,'Full booking flow'),
('pro','enquiry_only',        true,  null,'Enquiry flow'),
('pro','inbox_messages',      true,  null,'Full inbox'),
('pro','inbox_limit',         false, null,'Unlimited conversations'),
('pro','payment_paystack',    true,  null,'Paystack payments'),
('pro','payment_paypal',      true,  null,'PayPal payments'),
('pro','payment_eft',         true,  null,'Manual EFT'),
('pro','listings_limit',      true,  5,   'Max 5 listings'),
('pro','staff_seats',         true,  3,   'Max 3 staff seats'),
('pro','reviews_respond',     true,  null,'Respond to reviews'),
('pro','calendar_management', true,  null,'Block dates'),
('pro','instant_booking',     true,  null,'Instant booking'),
('pro','analytics_basic',     true,  null,'Basic stats'),
('pro','analytics_advanced',  true,  null,'Full analytics'),
('pro','custom_profile_url',  true,  null,'Custom handle'),
('pro','export_bookings',     true,  null,'CSV export'),
('pro','canned_replies',      true,  null,'Message templates')
ON CONFLICT (plan, feature_key) DO NOTHING;

-- ─── BUSINESS ─────────────────────────────────────────────────
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
('business','directory_listing',   true,  null,'Appear in Vilo Directory'),
('business','directory_priority',  true,  null,'Top directory placement'),
('business','direct_booking',      true,  null,'Full booking flow'),
('business','enquiry_only',        true,  null,'Enquiry flow'),
('business','inbox_messages',      true,  null,'Full inbox'),
('business','inbox_limit',         false, null,'Unlimited conversations'),
('business','payment_paystack',    true,  null,'Paystack payments'),
('business','payment_paypal',      true,  null,'PayPal payments'),
('business','payment_eft',         true,  null,'Manual EFT'),
('business','listings_limit',      false, null,'Unlimited listings'),
('business','staff_seats',         true,  10,  'Max 10 staff seats'),
('business','reviews_respond',     true,  null,'Respond to reviews'),
('business','calendar_management', true,  null,'Block dates'),
('business','instant_booking',     true,  null,'Instant booking'),
('business','analytics_basic',     true,  null,'Basic stats'),
('business','analytics_advanced',  true,  null,'Full analytics'),
('business','custom_profile_url',  true,  null,'Custom handle'),
('business','export_bookings',     true,  null,'CSV export'),
('business','canned_replies',      true,  null,'Message templates')
ON CONFLICT (plan, feature_key) DO NOTHING;
