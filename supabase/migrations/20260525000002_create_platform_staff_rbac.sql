-- Migration: Platform Staff RBAC (Super Admin Control Centre — Phase A foundation)
--
-- Introduces a role-based permission model for Vilo platform staff (separate
-- from the host-delegated `staff_members` table — those are co-hosts/cleaners
-- working FOR a host, not Vilo employees).
--
-- Adds: admin_roles, admin_permissions, admin_role_permissions, platform_staff,
-- platform_staff_invites, has_admin_permission() helper.
--
-- Replaces is_super_admin() to consult platform_staff (preserving the function
-- signature so the existing `admin_full_*` RLS policies keep working).
--
-- Seeds the founder (wollie333@gmail.com) into platform_staff with the
-- super_admin role. Migration aborts if the founder profile does not exist.

-- ─── admin_roles ──────────────────────────────────────────────
CREATE TABLE public.admin_roles (
  id          text        PRIMARY KEY,
  name        text        NOT NULL,
  description text,
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_roles IS
  'Named Vilo-staff roles. is_system = true means the row is protected and cannot be modified or deleted via the admin UI.';

INSERT INTO admin_roles (id, name, description, is_system) VALUES
  ('super_admin',   'Super Admin',       'Full platform access — founder/owner.',                   true),
  ('support_agent', 'Support Agent',     'Read all user data; edit profiles and non-financial settings on behalf of users.', false),
  ('finance',       'Finance',           'Payments, refunds, subscriptions, EFT approvals.',        false),
  ('content_mod',   'Content Moderator', 'Listings moderation, reviews moderation, host verification.', false),
  ('ops',           'Operations',        'Platform settings, feature flags, ranking weights, audit log.', false);

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

-- ─── admin_permissions ────────────────────────────────────────
CREATE TABLE public.admin_permissions (
  key         text        PRIMARY KEY,
  domain      text        NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_permissions IS
  'Catalog of granular admin permission keys. Format: domain.action (e.g. payments.refund). Never hardcode capability checks in app code — query has_admin_permission(key).';

INSERT INTO admin_permissions (key, domain, description) VALUES
  ('users.view',         'users',         'View any user profile and their owned entities.'),
  ('users.edit',         'users',         'Edit any user profile fields.'),
  ('users.suspend',      'users',         'Suspend or restore any user account.'),
  ('users.impersonate',  'users',         'Start view-only impersonation of any user.'),
  ('hosts.verify',       'hosts',         'Award or revoke host verification badge.'),
  ('listings.edit',      'listings',      'Edit any listing on behalf of any host.'),
  ('listings.moderate',  'listings',      'Hide, feature, or suspend any listing.'),
  ('bookings.edit',      'bookings',      'Edit booking status, dates, notes on any booking.'),
  ('bookings.cancel',    'bookings',      'Force-cancel any booking.'),
  ('payments.view',      'payments',      'View any payment record.'),
  ('payments.refund',    'payments',      'Issue refunds and override refund decisions.'),
  ('subscriptions.edit', 'subscriptions', 'Force plan changes, comp billing periods, restrict.'),
  ('reviews.moderate',   'reviews',       'Approve, reject, or hide any review.'),
  ('platform.settings',  'platform',      'Edit platform_settings key-values.'),
  ('platform.features',  'platform',      'Edit plan_features and host_feature_overrides.'),
  ('platform.staff',     'platform',      'Invite, remove, and re-role Vilo staff.'),
  ('audit.view',         'platform',      'View admin_audit_log.');

ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;

-- ─── admin_role_permissions ───────────────────────────────────
CREATE TABLE public.admin_role_permissions (
  role_id        text NOT NULL REFERENCES admin_roles(id)        ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES admin_permissions(key) ON DELETE CASCADE,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);

CREATE INDEX idx_admin_role_permissions_role ON admin_role_permissions(role_id);

ALTER TABLE admin_role_permissions ENABLE ROW LEVEL SECURITY;

-- super_admin gets everything
INSERT INTO admin_role_permissions (role_id, permission_key)
SELECT 'super_admin', key FROM admin_permissions;

-- support_agent — read-heavy + non-financial edits + impersonation
INSERT INTO admin_role_permissions (role_id, permission_key) VALUES
  ('support_agent', 'users.view'),
  ('support_agent', 'users.edit'),
  ('support_agent', 'users.impersonate'),
  ('support_agent', 'listings.edit'),
  ('support_agent', 'bookings.edit'),
  ('support_agent', 'payments.view'),
  ('support_agent', 'audit.view');

-- finance — money operations
INSERT INTO admin_role_permissions (role_id, permission_key) VALUES
  ('finance', 'users.view'),
  ('finance', 'payments.view'),
  ('finance', 'payments.refund'),
  ('finance', 'subscriptions.edit'),
  ('finance', 'bookings.cancel'),
  ('finance', 'audit.view');

-- content_mod — listings & reviews
INSERT INTO admin_role_permissions (role_id, permission_key) VALUES
  ('content_mod', 'users.view'),
  ('content_mod', 'listings.edit'),
  ('content_mod', 'listings.moderate'),
  ('content_mod', 'reviews.moderate'),
  ('content_mod', 'hosts.verify'),
  ('content_mod', 'audit.view');

-- ops — platform configuration
INSERT INTO admin_role_permissions (role_id, permission_key) VALUES
  ('ops', 'users.view'),
  ('ops', 'platform.settings'),
  ('ops', 'platform.features'),
  ('ops', 'audit.view');

-- ─── platform_staff ───────────────────────────────────────────
CREATE TABLE public.platform_staff (
  user_id          uuid        PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_id          text        NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  is_active        boolean     NOT NULL DEFAULT true,
  invited_by       uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  invited_at       timestamptz,
  accepted_at      timestamptz,
  last_active_at   timestamptz,
  mfa_enrolled_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_staff_role   ON platform_staff(role_id);
CREATE INDEX idx_platform_staff_active ON platform_staff(is_active) WHERE is_active = true;

COMMENT ON TABLE platform_staff IS
  'Vilo employees with admin-panel access. Separate from staff_members (which is host-delegated). is_active = false revokes access without losing audit history.';
COMMENT ON COLUMN platform_staff.mfa_enrolled_at IS
  'Set when the user first enrols TOTP. is_super_admin() requires AAL2, so staff cannot reach the admin panel until MFA is set up.';

ALTER TABLE platform_staff ENABLE ROW LEVEL SECURITY;

-- ─── platform_staff_invites ───────────────────────────────────
CREATE TABLE public.platform_staff_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,
  role_id     text        NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  token       text        NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  invited_by  uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_staff_invites_token ON platform_staff_invites(token);
CREATE INDEX idx_platform_staff_invites_email ON platform_staff_invites(email);

COMMENT ON TABLE platform_staff_invites IS
  'Pending invites for Vilo staff. 72h expiry. Accept flow requires MFA enrolment before platform_staff row is created.';

ALTER TABLE platform_staff_invites ENABLE ROW LEVEL SECURITY;

-- ─── extend admin_audit_log.target_type ───────────────────────
-- Add new target_type values needed by the control centre:
--   user             — edits to a user_profile row
--   staff_member     — host-delegated staff changes
--   platform_staff   — Vilo staff changes (invite/role/deactivate)
--   permission_denied — failed authorisation attempts (probing)
ALTER TABLE admin_audit_log DROP CONSTRAINT admin_audit_log_target_type_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type IN (
    'host','guest','user','booking','listing','review','subscription',
    'feature_override','platform_setting','platform_staff','staff_member',
    'impersonation','permission_denied'
  ));

-- ─── replace is_super_admin() ─────────────────────────────────
-- Signature unchanged, so existing admin_full_* RLS policies keep working.
-- Body now consults platform_staff and requires AAL2 (MFA).
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.role_id = 'super_admin'
      AND ps.is_active = true
      AND COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  );
$$;

-- ─── has_admin_permission(key) ────────────────────────────────
CREATE OR REPLACE FUNCTION has_admin_permission(p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_staff ps
    JOIN admin_role_permissions arp ON arp.role_id = ps.role_id
    WHERE ps.user_id = auth.uid()
      AND ps.is_active = true
      AND arp.permission_key = p_key
      AND COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  );
$$;

COMMENT ON FUNCTION has_admin_permission(text) IS
  'Source of truth for admin capability checks. Requires AAL2. Always call this from Server Actions / Edge Functions — never hardcode role logic in app code.';

-- ─── RLS policies for the new tables ─────────────────────────
-- All four tables: super admin full access; nothing for non-admins.
CREATE POLICY "admin_full_admin_roles"            ON admin_roles            FOR ALL USING (is_super_admin());
CREATE POLICY "admin_full_admin_permissions"      ON admin_permissions      FOR ALL USING (is_super_admin());
CREATE POLICY "admin_full_admin_role_permissions" ON admin_role_permissions FOR ALL USING (is_super_admin());
CREATE POLICY "admin_full_platform_staff"         ON platform_staff         FOR ALL USING (is_super_admin());
CREATE POLICY "admin_full_platform_staff_invites" ON platform_staff_invites FOR ALL USING (is_super_admin());

-- A staff member can read their own platform_staff row (so the dashboard
-- can show role + last_active without needing service-role).
CREATE POLICY "staff_read_own_membership" ON platform_staff FOR SELECT
  USING (user_id = auth.uid());

-- Anyone with audit.view can read admin_role_permissions + admin_permissions
-- (for the catalog viewer). Don't expose role definitions to non-admins.
CREATE POLICY "staff_read_permission_catalog" ON admin_permissions FOR SELECT
  USING (has_admin_permission('audit.view'));
CREATE POLICY "staff_read_role_grants" ON admin_role_permissions FOR SELECT
  USING (has_admin_permission('audit.view'));
CREATE POLICY "staff_read_roles" ON admin_roles FOR SELECT
  USING (has_admin_permission('audit.view'));

-- ─── seed founder into platform_staff ─────────────────────────
DO $$
DECLARE
  v_founder_id uuid;
BEGIN
  SELECT id INTO v_founder_id
  FROM user_profiles
  WHERE email = 'wollie333@gmail.com'
  LIMIT 1;

  IF v_founder_id IS NULL THEN
    RAISE EXCEPTION
      'Founder profile (wollie333@gmail.com) not found in user_profiles. '
      'Sign up the founder account first, then re-run this migration. '
      'For emergency recovery, run supabase/scripts/grant-super-admin.sql.';
  END IF;

  INSERT INTO platform_staff (user_id, role_id, is_active, accepted_at)
  VALUES (v_founder_id, 'super_admin', true, now())
  ON CONFLICT (user_id) DO UPDATE
    SET role_id = 'super_admin',
        is_active = true,
        updated_at = now();
END $$;
