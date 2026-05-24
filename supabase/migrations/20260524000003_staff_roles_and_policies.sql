-- Migration: Staff roles + RLS policies for staff_invites
--
-- Adds a `role` column to both `staff_members` and `staff_invites`
-- (`co_host` / `cleaner` / `assistant`), an `invited_by` audit column on
-- `staff_invites`, and the RLS policies that let the host list and
-- manage their own pending invites from the dashboard.

-- ─── 1. staff_members.role ────────────────────────────────────
ALTER TABLE public.staff_members
  ADD COLUMN role text NOT NULL DEFAULT 'assistant'
    CHECK (role IN ('co_host', 'cleaner', 'assistant'));

CREATE INDEX idx_staff_members_role ON staff_members(host_id, role);

COMMENT ON COLUMN staff_members.role IS
  'co_host: full operational access (bookings + listings + inbox). cleaner: read-only listings, manages blocked_dates. assistant: bookings + inbox.';

-- ─── 2. staff_invites.role + invited_by ───────────────────────
ALTER TABLE public.staff_invites
  ADD COLUMN role text NOT NULL DEFAULT 'assistant'
    CHECK (role IN ('co_host', 'cleaner', 'assistant')),
  ADD COLUMN invited_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN staff_invites.role IS
  'The role to assign on accept. Stamped onto staff_members.role.';

-- ─── 3. RLS — staff_invites ───────────────────────────────────
-- Host manages their own invites (list / cancel / resend).
CREATE POLICY "host_manage_own_invites" ON staff_invites FOR ALL
  USING (host_id = get_my_host_id());

-- The invitee accept flow runs via the admin client (token IS the auth),
-- so no guest/staff SELECT policy is required.
CREATE POLICY "admin_full_invites" ON staff_invites FOR ALL
  USING (is_super_admin());
