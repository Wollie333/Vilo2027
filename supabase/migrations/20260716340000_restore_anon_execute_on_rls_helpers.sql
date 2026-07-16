-- REGRESSION FIX: 20260716320000 (yesterday) took the public site down for every
-- signed-out visitor. This restores it.
--
-- WHAT HAPPENED. ..320000 looped over every SECURITY DEFINER function in `public`
-- that anon could execute and revoked it, keeping an allowlist of four. That was
-- right for the ~85 privileged RPCs it was aimed at. But five of the functions it
-- swept up are not RPCs at all — they are the helpers RLS policies THEMSELVES call:
--
--   get_my_host_id()            -- `host_id = get_my_host_id()` on ~40 host tables
--   get_my_host_id_as_staff()   -- the staff-delegation half of the same policies
--   get_my_role()
--   is_super_admin()            -- every admin_full_* policy
--   has_admin_permission(text)
--
-- A policy that calls a function anon cannot EXECUTE does not evaluate to false —
-- it RAISES. And Postgres OR-evaluates permissive policies with no guaranteed
-- short-circuit, so a `public_read_*` policy sitting next to a `host_manage_*` one
-- does not save you. Proven on live as role anon, every one a plain SELECT:
--
--   properties       -> 42501 permission denied for function get_my_host_id_as_staff
--   reviews          -> 42501 permission denied for function get_my_host_id
--   external_reviews -> 42501 permission denied for function get_my_host_id
--   blocked_dates, addons, property_rooms, specials, coupons, hosts -> same
--
-- Every public property page, every availability calendar, for every signed-out
-- visitor. It went unnoticed for exactly the reason this codebase keeps getting
-- burned: nothing has ever run (0 properties, 0 bookings), and the pages that do
-- prerender use createAdminClient(), which is service_role and bypasses RLS.
-- ..320000 verified its RPCs over real HTTP and never read a TABLE as anon.
--
-- WHY GRANTING THESE BACK IS SAFE — and why they are a different species to the 85.
-- Each is keyed solely on auth.uid() and takes no caller-supplied identity. For
-- anon, auth.uid() is NULL, so they return NULL / false. An anon caller learns only
-- "I am nobody", which it already knew. There is no argument that selects someone
-- else's row. That is the exact opposite of fetch_primary_kpis(p_host_id), which
-- hands you any host's revenue if you know their id — those stay revoked.
--
-- 🔑 RULE FOR THE NEXT SWEEP: never revoke anon from a function named inside an RLS
-- policy. `docs/SCHEMA.md` now auto-flags this (generate-schema-doc.mjs red flag 6),
-- so it fails loudly on the next regeneration instead of six weeks later.

GRANT EXECUTE ON FUNCTION public.get_my_host_id()            TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_host_id_as_staff()   TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_role()               TO anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin()            TO anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text)  TO anon;

COMMENT ON FUNCTION public.get_my_host_id() IS
  'RLS helper: the caller''s host_id, or NULL. Called from ~40 policies, so EVERY role that reads those tables — anon included — must keep EXECUTE, or the policy raises 42501 instead of evaluating false. See 20260716340000.';
COMMENT ON FUNCTION public.is_super_admin() IS
  'RLS helper: is the caller an active super admin. Called from every admin_full_* policy, so anon must keep EXECUTE or those tables raise 42501 for signed-out readers. See 20260716340000.';
