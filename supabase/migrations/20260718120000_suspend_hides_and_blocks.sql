-- Suspend = hidden + blocked from all features.
--
-- Two admin capabilities on a host, now with a shared public-suppression gate:
--   * HIDE  (hosts.hidden_from_directory)      — listings/specials off every public
--     surface; host still logs in + manages normally.
--   * SUSPEND (user_profiles.is_active = false) — same public hide PLUS the host is
--     walled out of the app (server-side in requireHost/assertFullHost + the
--     dashboard/portal layouts) and cannot receive bookings.
--
-- A host is "publicly suppressed" when EITHER applies. This one predicate drives
-- the public-read RLS on properties + specials, so a suspended host's listings
-- disappear exactly like a hidden host's — no surface can be missed. Supersedes
-- host_hidden_from_directory (20260718110000), which only covered the hide flag.
--
-- Nothing is deleted or unpublished by either; reinstating/unhiding restores
-- visibility instantly.

CREATE OR REPLACE FUNCTION public.host_public_suppressed(p_host_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT h.hidden_from_directory
        OR COALESCE(up.is_active = false, false)
    FROM public.hosts h
    LEFT JOIN public.user_profiles up ON up.id = h.user_id
    WHERE h.id = p_host_id
  ), false);
$$;

COMMENT ON FUNCTION public.host_public_suppressed IS
  'True when a host is hidden (hosts.hidden_from_directory) OR suspended (user_profiles.is_active = false). Drives the public_read RLS on properties + specials so both states remove all listings/specials from public view. Returns only a boolean.';

-- Used inside anon public-read policies.
GRANT EXECUTE ON FUNCTION public.host_public_suppressed(uuid) TO anon, authenticated, service_role;

-- Repoint both public-read policies onto the unified predicate.
ALTER POLICY public_read_published ON public.properties
  USING (
    is_published = true
    AND is_suspended = false
    AND deleted_at IS NULL
    AND NOT public.host_public_suppressed(host_id)
  );

ALTER POLICY specials_public_read ON public.specials
  USING (
    status = 'active'
    AND deleted_at IS NULL
    AND NOT public.host_public_suppressed(host_id)
  );

-- The hide-only predicate is fully superseded; nothing references it now.
DROP FUNCTION IF EXISTS public.host_hidden_from_directory(uuid);
