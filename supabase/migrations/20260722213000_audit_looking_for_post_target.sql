-- Allow `looking_for_post` as an admin_audit_log target_type.
--
-- The six moderation actions in /admin/looking-for/posts (flag, unflag, remove,
-- suspend, resume, reinstate) change the status of a GUEST's post — taking their
-- content offline — and wrote no audit row at all. RULES.md §5 and
-- AGENT_RULES.md §6.1 require every admin action to be logged; the CHECK
-- constraint had no value that fitted, so the wrapper could not be applied.
--
-- The DB constraint is deliberately kept a SUPERSET of AUDIT_TARGET_TYPES in
-- apps/web/lib/admin/withAdminAudit.ts (see migration 20260710130000).

ALTER TABLE admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;

ALTER TABLE admin_audit_log
  ADD CONSTRAINT admin_audit_log_target_type_check CHECK (
    target_type = ANY (ARRAY[
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
      'affiliate_campaign_enrollment', 'marketing_asset',
      'looking_for_requirement_group', 'looking_for_requirement_option',
      'looking_for_post',
      'feature_request', 'changelog_entry'
    ])
  );
