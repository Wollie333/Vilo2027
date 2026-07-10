-- Admin audit log: allow the target_type values used by host-scoped user-record
-- actions. Before this, add-on / policy / business / affiliate admin actions
-- wrote an audit row with target_type IN ('addon','policy','business','affiliate'),
-- which violated admin_audit_log_target_type_check — so the insert failed and was
-- silently swallowed by withAdminAudit's error fallback. Result: those actions
-- were absent from BOTH the audit log and the per-user History tab.
--
-- Additive, superset of the previous list (20260528000001). Existing rows already
-- use allowed values, so the re-ADD validates cleanly.
ALTER TABLE admin_audit_log DROP CONSTRAINT admin_audit_log_target_type_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type IN (
    'host','guest','user','booking','listing','review','subscription',
    'feature_override','platform_setting','platform_staff','staff_member',
    'impersonation','permission_denied',
    'help_article','help_video','help_faq','help_category',
    'help_status','help_settings','help_article_suggestion',
    'broadcast','notification_send',
    'listing_category','amenity_group','amenity_catalog',
    -- New: host-scoped user-record actions (were silently failing to audit).
    'addon','policy','business','affiliate'
  ));
