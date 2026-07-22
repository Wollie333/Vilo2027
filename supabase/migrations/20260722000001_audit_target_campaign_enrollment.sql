-- Allow 'affiliate_campaign_enrollment' as an admin_audit_log target.
--
-- The TypeScript union in lib/admin/withAdminAudit.ts and this CHECK constraint
-- are two halves of the same list and drift silently: adding the type in TS
-- compiles clean, then the audit INSERT fails at runtime and takes the whole
-- admin action down with it. If you add a target type, add it in BOTH places.

alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_target_type_check;

alter table public.admin_audit_log
  add constraint admin_audit_log_target_type_check
  check (target_type = any (array[
    'host', 'guest', 'user', 'booking', 'listing', 'business', 'addon',
    'policy', 'review', 'subscription', 'plan', 'plan_feature',
    'platform_service', 'product', 'product_feature', 'platform_ledger',
    'platform_coupon', 'feature_override', 'platform_setting',
    'platform_staff', 'staff_member', 'impersonation', 'permission_denied',
    'help_article', 'help_video', 'help_faq', 'help_category', 'help_status',
    'help_settings', 'help_article_suggestion', 'broadcast',
    'notification_send', 'listing_category', 'amenity_group',
    'amenity_catalog', 'special_category', 'affiliate', 'affiliate_payout',
    'affiliate_settings', 'affiliate_campaign',
    'affiliate_campaign_enrollment',
    'marketing_asset', 'looking_for_requirement_group',
    'looking_for_requirement_option', 'feature_request', 'changelog_entry'
  ]));
