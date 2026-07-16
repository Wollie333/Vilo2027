-- Migration: grant the anon/authenticated roles SELECT on the theme catalogue.
--
-- 20260619004000_site_themes enabled RLS and added a public read POLICY
-- (`select using (is_active and deleted_at is null)`) but never GRANTed the
-- underlying table privilege. A policy only FILTERS rows; Postgres still refuses
-- the query if the role has no SELECT grant. So any read through the anon key
-- (e.g. the theme picker's catalogue loader when the service-role key isn't
-- wired into a deployment) failed with "permission denied for table
-- site_themes" and silently fell back to a single built-in preset ("Warm").
--
-- Granting SELECT lets the RLS policy do its job: anon/authenticated can read
-- the ACTIVE catalogue (inactive/deleted rows are still hidden by the policy),
-- while writes remain admin-only. Idempotent.

grant select on public.site_themes to anon, authenticated;
