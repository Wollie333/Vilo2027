-- Legal docs — dedicated permission + Legal Counsel role (Phase 3b).
--
-- Adds a granular `legal.docs` permission so a lawyer can manage legal documents
-- and their placements WITHOUT full platform-settings access. The app gates the
-- legal-doc actions on `legal.docs` OR `platform.settings`, so this is fully
-- additive and NON-REGRESSIVE: existing admins (super_admin, ops) keep working
-- whether or not this migration has applied yet; only the new counsel role
-- depends on it.

-- 1. The permission key.
INSERT INTO public.admin_permissions (key, domain, description) VALUES
  ('legal.docs', 'legal',
   'Create, edit, publish and place legal documents (Terms, Privacy, Cookies, affiliate & competition rules).')
ON CONFLICT (key) DO NOTHING;

-- 2. Keep everyone who manages platform settings today able to manage legal docs.
--    (super_admin is granted every key at role-creation time, but a key ADDED
--    later is not auto-granted — so grant both explicitly.)
INSERT INTO public.admin_role_permissions (role_id, permission_key) VALUES
  ('super_admin', 'legal.docs'),
  ('ops',         'legal.docs')
ON CONFLICT DO NOTHING;

-- 3. Dedicated Legal Counsel role — legal documents only, nothing else. Assign a
--    lawyer this role via the staff admin; they then reach /admin/legal and can
--    edit/publish/place documents, and see nothing else.
INSERT INTO public.admin_roles (id, name, description, is_system) VALUES
  ('legal_counsel', 'Legal Counsel',
   'Manage legal documents and their placements only.', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key) VALUES
  ('legal_counsel', 'legal.docs')
ON CONFLICT DO NOTHING;
