-- Migration: PRE-MVP — drop AAL2 requirement from admin authorisation
--
-- The original 20260525000002_create_platform_staff_rbac migration required
-- AAL2 (MFA-verified session) inside is_super_admin() and has_admin_permission().
-- The matching MFA enrolment page (/account/mfa-enrol) was never built, so
-- platform_staff members cannot actually reach /admin — the layout redirects to
-- a 404 instead.
--
-- Per CLAUDE.md "Pre-MVP data policy" and AGENT_RULES.md §3.4, we ship the
-- admin panel password-only for the founder build, and restore the MFA gate
-- before public launch. The platform_staff table remains the actual gate —
-- only seeded staff can reach the panel.
--
-- TO RESTORE BEFORE PRODUCTION LAUNCH:
--   1. Build /account/mfa-enrol (TOTP enrol + verify).
--   2. Revert this migration (re-add the COALESCE(auth.jwt()->>'aal','aal1')='aal2'
--      clause to both functions).
--   3. Document in CHANGELOG.

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_staff ps
    WHERE ps.user_id = auth.uid()
      AND ps.role_id = 'super_admin'
      AND ps.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION has_admin_permission(p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_staff ps
    JOIN admin_role_permissions arp ON arp.role_id = ps.role_id
    WHERE ps.user_id = auth.uid()
      AND ps.is_active = true
      AND arp.permission_key = p_key
  );
$$;
