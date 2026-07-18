-- Manual admin "hide host from public" kill-switch.
--
-- An admin toggle that removes ALL of a host's listings AND specials from every
-- public surface (directory, search, listing detail, specials, sitemap) at once,
-- independent of subscription status. Reversible instantly. Nothing is deleted or
-- unpublished — the host keeps their data + their own published state; the rows
-- are simply invisible to the public while the flag is on. Owner, staff and admin
-- access are untouched (they read through separate RLS policies).
--
-- Mirrors the existing per-listing `properties.is_suspended` gate, but at the host
-- level, so it is behaviourally identical to "suspend every one of this host's
-- listings + specials" in a single switch.
--
-- Enforcement is at the RLS layer (not per-query) so a surface can never be missed:
-- every public read of properties/specials already flows through these two policies.

ALTER TABLE public.hosts
  ADD COLUMN IF NOT EXISTS hidden_from_directory        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_from_directory_at     timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_from_directory_reason text;

COMMENT ON COLUMN public.hosts.hidden_from_directory IS
  'Admin kill-switch: when true, all of this host''s listings + specials are hidden from every public surface (RLS). Data + published state retained; owner/staff/admin access unaffected.';

-- SECURITY DEFINER so the RLS check reads the flag reliably regardless of whether
-- the querying (anon) role can otherwise see the host row. Returns only a boolean —
-- no sensitive data, no writes, parameterised (no injection surface).
CREATE OR REPLACE FUNCTION public.host_hidden_from_directory(p_host_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT hidden_from_directory FROM public.hosts WHERE id = p_host_id),
    false
  );
$$;

COMMENT ON FUNCTION public.host_hidden_from_directory IS
  'True when an admin has hidden this host from public surfaces. Used by the public_read RLS policies on properties + specials.';

-- Used inside public (anon) read policies, so anon/authenticated must be able to
-- call it. It exposes only the hidden boolean.
GRANT EXECUTE ON FUNCTION public.host_hidden_from_directory(uuid) TO anon, authenticated, service_role;

-- ── Extend the two public-read policies to exclude hidden hosts ───────────
ALTER POLICY public_read_published ON public.properties
  USING (
    is_published = true
    AND is_suspended = false
    AND deleted_at IS NULL
    AND NOT public.host_hidden_from_directory(host_id)
  );

ALTER POLICY specials_public_read ON public.specials
  USING (
    status = 'active'
    AND deleted_at IS NULL
    AND NOT public.host_hidden_from_directory(host_id)
  );
