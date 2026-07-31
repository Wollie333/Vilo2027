-- Funnel Manager — Phase 1b: RBAC + audit target type.
--
-- Adds the pipeline permissions, a dedicated "Sales Team" role for the staff who
-- work leads, and extends admin_audit_log.target_type so pipeline mutations can
-- be recorded via withAdminAudit. Fully additive; existing roles keep working
-- whether or not this has applied (the app gates on pipeline.* which simply isn't
-- granted yet elsewhere).
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   DELETE FROM admin_role_permissions WHERE permission_key IN ('pipeline.view','pipeline.manage');
--   DELETE FROM admin_permissions      WHERE key           IN ('pipeline.view','pipeline.manage');
--   DELETE FROM admin_roles            WHERE id = 'sales_team';
--   (target_type CHECK: re-create without 'pipeline'.)

-- 1. Permission keys.
INSERT INTO public.admin_permissions (key, domain, description) VALUES
  ('pipeline.view',   'pipeline', 'View the sales pipeline board and lead records.'),
  ('pipeline.manage', 'pipeline', 'Work leads: move stages, assign owners, log calls/notes, send one-off emails, edit funnels.')
ON CONFLICT (key) DO NOTHING;

-- 2. New Sales Team role — works leads across both boards, nothing else.
INSERT INTO public.admin_roles (id, name, description, is_system) VALUES
  ('sales_team', 'Sales Team',
   'Work the funnel/lead pipeline — hosts and affiliate boards. No other platform access.', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Grant. super_admin is granted every key AT ROLE CREATION only — a key added
--    later is NOT auto-granted (see 20260731170000), so grant it explicitly.
INSERT INTO public.admin_role_permissions (role_id, permission_key) VALUES
  ('super_admin',   'pipeline.view'),
  ('super_admin',   'pipeline.manage'),
  ('sales_team',    'pipeline.view'),
  ('sales_team',    'pipeline.manage'),
  ('support_agent', 'pipeline.view')   -- read-only visibility for support
ON CONFLICT DO NOTHING;

-- 4. Allow 'pipeline' as an admin_audit_log target_type (withAdminAudit writes it).
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check CHECK (
  target_type = ANY (ARRAY[
    'host','guest','user','booking','listing','business','addon','policy','review',
    'subscription','plan','plan_feature','platform_service','product','product_feature',
    'platform_ledger','platform_coupon','feature_override','platform_setting','platform_staff',
    'staff_member','impersonation','permission_denied','help_article','help_video','help_faq',
    'help_category','help_status','help_settings','help_article_suggestion','broadcast',
    'notification_send','listing_category','amenity_group','amenity_catalog','special_category',
    'affiliate','affiliate_payout','affiliate_settings','affiliate_campaign',
    'affiliate_campaign_enrollment','marketing_asset','looking_for_requirement_group',
    'looking_for_requirement_option','looking_for_post','conversation','feature_request',
    'changelog_entry',
    'pipeline'
  ]::text[])
);
