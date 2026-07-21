-- WS-1i — admin campaign builder.
--
-- Campaigns were seeded by migration and had no admin UI ("config-in-code for
-- the first run"), so the Founding Race has been sitting at status='draft' with
-- no way to see or launch it. The builder writes through withAdminAudit, which
-- needs its target_type in BOTH the DB CHECK and AUDIT_TARGET_TYPES.
--
-- Campaign edits move real money (commission_structure is read by the accrual
-- resolver), so every change is audited with a before/after snapshot.

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
    'affiliate', 'affiliate_payout', 'affiliate_settings', 'affiliate_campaign',
    'marketing_asset',
    'looking_for_requirement_group', 'looking_for_requirement_option',
    'feature_request', 'changelog_entry'
  ]));
