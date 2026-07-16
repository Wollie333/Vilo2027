-- Migration: scope the site_themes admin policy to authenticated only.
--
-- 20260619004000 created `site_themes_admin_all` as `FOR ALL USING
-- (is_super_admin())` with no role clause, so it applies to EVERY role including
-- anon. A permissive SELECT evaluates all applicable policies, so an anon read of
-- the catalogue evaluates is_super_admin() — and the anon role can be denied
-- EXECUTE on that function (the grant is reset by unrelated migrations). When
-- that happens the whole SELECT fails with "permission denied for function
-- is_super_admin" and the theme picker silently falls back to a single preset.
--
-- Fix: the admin policy only ever needs to grant super-admins write access, and
-- super-admins are authenticated users — scope it to `authenticated`. An
-- anonymous catalogue read then evaluates ONLY the public `site_themes_read`
-- policy (is_active and deleted_at is null), which never calls is_super_admin().
-- Idempotent (drop + recreate).

drop policy if exists site_themes_admin_all on public.site_themes;
create policy site_themes_admin_all on public.site_themes
  for all
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());
