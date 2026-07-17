-- Audit target for Wielo promo codes.
--
-- admin_audit_log.target_type is CHECK-constrained to a fixed list that is kept
-- a SUPERSET of AUDIT_TARGET_TYPES in lib/admin/withAdminAudit.ts (see
-- 20260710130000). The promo-code admin actions audit as 'platform_coupon', so
-- the constraint has to learn the value first — otherwise every create/toggle/
-- delete would succeed at the mutation and then throw on the audit insert.

ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type = ANY (ARRAY[
    'host', 'guest', 'user', 'booking', 'listing', 'business', 'addon',
    'policy', 'review', 'subscription', 'plan', 'plan_feature',
    'platform_service', 'product', 'product_feature', 'platform_ledger',
    'platform_coupon',
    'feature_override', 'platform_setting', 'platform_staff', 'staff_member',
    'impersonation', 'permission_denied', 'help_article', 'help_video',
    'help_faq', 'help_category', 'help_status', 'help_settings',
    'help_article_suggestion', 'broadcast', 'notification_send',
    'listing_category', 'amenity_group', 'amenity_catalog', 'special_category',
    'affiliate', 'affiliate_payout', 'affiliate_settings', 'marketing_asset',
    'looking_for_requirement_group', 'looking_for_requirement_option'
  ]));
