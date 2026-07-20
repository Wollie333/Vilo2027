-- Audit target for Build Board moderation (WS-3a).
--
-- admin_audit_log.target_type is CHECK-constrained to a fixed list kept a
-- SUPERSET of AUDIT_TARGET_TYPES in lib/admin/withAdminAudit.ts. The Build Board
-- moderation actions (approve, status, merge, delete) audit as 'feature_request',
-- so the constraint has to learn the value first — else the mutation succeeds and
-- the audit insert throws.

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
    'looking_for_requirement_group', 'looking_for_requirement_option',
    'feature_request'
  ]));
