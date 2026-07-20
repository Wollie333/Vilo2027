-- Migration: lock the campaign-scoring RPCs to service_role (WS-1.3 hardening).
--
-- The previous migration REVOKEd EXECUTE FROM PUBLIC, but Supabase's default
-- privileges grant EXECUTE to `anon` and `authenticated` DIRECTLY on every new
-- function in `public` — so a REVOKE FROM PUBLIC is a no-op for them (the same
-- trap the recent lock_anon_secdef_read_rpcs migrations fixed). Revoke from the
-- concrete roles too. Both functions are called only from server components via
-- the service-role admin client (the public leaderboard reads through it), so
-- neither anon nor authenticated need EXECUTE. Fail closed.

REVOKE ALL ON FUNCTION public.campaign_active_listings(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_active_listings(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.snapshot_campaign_scores()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_campaign_scores() TO service_role;
