-- Reconcile admin_audit_log_target_type_check with the code's AuditTargetType
-- union (lib/admin/withAdminAudit.ts). The constraint had drifted far behind the
-- type: actions using target_type IN ('plan','plan_feature','platform_service',
-- 'product','product_feature','platform_ledger','affiliate_payout',
-- 'affiliate_settings','marketing_asset','special_category') all violated the
-- CHECK, so their audit inserts threw and were silently swallowed by
-- withAdminAudit — i.e. Products, Plans, Services, Ledger, Affiliates, Marketing
-- and Deal-category admin actions were never audited. (20260710120000 already
-- added addon/policy/business/affiliate; this makes the constraint a full
-- superset of the TS union so no admin action can silently fail to audit again.)
ALTER TABLE admin_audit_log DROP CONSTRAINT admin_audit_log_target_type_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type IN (
    -- Core domain
    'host','guest','user','booking','listing','business','addon','policy',
    'review','subscription',
    -- Catalog / billing
    'plan','plan_feature','platform_service','product','product_feature',
    'platform_ledger',
    -- Platform / access
    'feature_override','platform_setting','platform_staff','staff_member',
    'impersonation','permission_denied',
    -- Help centre
    'help_article','help_video','help_faq','help_category','help_status',
    'help_settings','help_article_suggestion',
    -- Comms
    'broadcast','notification_send',
    -- Taxonomy
    'listing_category','amenity_group','amenity_catalog','special_category',
    -- Affiliate
    'affiliate','affiliate_payout','affiliate_settings','marketing_asset'
  ));
