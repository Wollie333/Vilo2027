-- =============================================================================
-- _can_read_host returned NULL (not false) for a non-owner → guards failed OPEN.
--
-- Its body was:
--   SELECT p_host_id = get_my_host_id()
--       OR p_host_id = get_my_host_id_as_staff()
--       OR is_super_admin();
--
-- For a signed-in host reading SOMEONE ELSE's host: `= get_my_host_id()` is
-- false, but `= get_my_host_id_as_staff()` is `hostX = NULL` = NULL, and
-- `false OR NULL OR false` = **NULL**. Every caller does `IF NOT _can_read_host`
-- — and `NOT NULL` = NULL, which is not TRUE, so the deny branch never ran. The
-- ownership checks in fetch_host_guests / fetch_guest_record / the broadcast
-- counters / and the new analytics guard were ALL silently failing open for the
-- non-owner, non-staff case.
--
-- PROVEN on live: impersonating host1, `_can_read_host('<host2>')` returned NULL,
-- and fetch_primary_kpis('<host2>') returned host2's KPIs.
--
-- Fix: COALESCE the result to false so a non-match is a hard deny, and harden the
-- analytics guard the same way (belt-and-braces). One change to _can_read_host
-- fixes every caller at once.
-- =============================================================================

CREATE OR REPLACE FUNCTION public._can_read_host(p_host_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
       p_host_id = get_my_host_id()
    OR p_host_id = get_my_host_id_as_staff()
    OR is_super_admin()
  , false);
$$;

-- Defence in depth: even if _can_read_host ever returns NULL again, the analytics
-- guard denies rather than skips.
CREATE OR REPLACE FUNCTION public._assert_can_read_host(p_host_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(public._can_read_host(p_host_id), false) THEN
    RAISE EXCEPTION 'not authorised to read this host''s data'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
