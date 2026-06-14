-- Migration: admin notes on any Vilo user (Super-Admin portal Pillar 3)
--
-- Internal staff notes on the Vilo User Record. Distinct from guest_notes (which
-- is host-scoped, keyed by gkey). Admin-only: RLS enabled with no policy, so only
-- the service-role admin client (used by audited admin actions) can read/write.

CREATE TABLE public.admin_user_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  body       text NOT NULL,
  is_pinned  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_user_notes_user ON public.admin_user_notes(user_id, created_at DESC);

ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;
-- No policy on purpose: service-role admin client only.

COMMENT ON TABLE public.admin_user_notes IS
  'Internal staff notes on a Vilo user. Admin-only (service role); not visible to the user or hosts.';

-- ─── New admin permission keys for deep user management ───────
INSERT INTO public.admin_permissions (key, domain, description) VALUES
  ('users.role',   'users', 'Change a user''s role'),
  ('users.delete', 'users', 'Soft-delete a user account')
ON CONFLICT (key) DO NOTHING;

-- Grant them to super_admin (founder/owner gets everything).
INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT 'super_admin', v.k
FROM (VALUES ('users.role'), ('users.delete')) AS v(k)
ON CONFLICT DO NOTHING;
