-- Migration: Affiliate campaign SCORING — live query + nightly snapshot (WS-1.3).
--
-- Score = a live query over the referral graph, NOT a points ledger (blueprint
-- §6.1). A churned host's listings drop off the next recompute automatically →
-- no clawback job, no dispute queue. Scoring is READ-ONLY: it never writes money;
-- a scoring bug can misrank a leaderboard but can never mis-pay. This whole
-- migration is zero financial risk.
--
--   score(affiliate, campaign) =
--     Σ over hosts H referred by <affiliate> under <campaign>
--       ( count of H's currently published + active listings ) × event weight
--
-- The referral is tagged to a campaign only by an active-in-window campaign link
-- (see /r/[slug] route), so a tagged referral's bound_at already sits inside the
-- window — no extra window filter is needed here. Suspended affiliate accounts
-- are excluded (anti-gaming). 'total' mode reads this live; 'net_change' mode +
-- leaderboard history read the daily snapshots this migration also writes.

-- ─── live active-listing count per affiliate for a campaign ──────────────────
-- SECURITY DEFINER to traverse hosts/properties regardless of the caller's RLS;
-- strictly read-only and returns aggregate counts only. Locked to service_role
-- (the public leaderboard page + snapshot cron call it) — never anon.
CREATE OR REPLACE FUNCTION public.campaign_active_listings(p_campaign_id uuid)
RETURNS TABLE (affiliate_id uuid, active_listings integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.affiliate_id, COUNT(p.id)::int AS active_listings
  FROM public.affiliate_referrals r
  JOIN public.affiliate_accounts a
    ON a.id = r.affiliate_id AND a.status = 'active'
  JOIN public.hosts h
    ON h.user_id = r.referred_user_id AND h.deleted_at IS NULL
  JOIN public.properties p
    ON p.host_id = h.id
   AND p.is_published = true
   AND p.is_suspended = false
   AND p.deleted_at IS NULL
  WHERE r.campaign_id = p_campaign_id
  GROUP BY r.affiliate_id;
$$;

REVOKE ALL ON FUNCTION public.campaign_active_listings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campaign_active_listings(uuid) TO service_role;

-- ─── nightly snapshot of every active competition campaign ───────────────────
-- Upserts one row per (campaign, affiliate) for CURRENT_DATE with the raw
-- listing count and the weighted score. Needed for 'net_change' windows (net =
-- end − start snapshot) and leaderboard history. 'total' mode still reads live,
-- so a missed night never distorts the current standings.
CREATE OR REPLACE FUNCTION public.snapshot_campaign_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c        record;
  weight   numeric;
  total    integer := 0;
  n        integer;
BEGIN
  FOR c IN
    SELECT id, competition
    FROM public.affiliate_campaigns
    WHERE status = 'active' AND competition IS NOT NULL
  LOOP
    weight := COALESCE((c.competition->'events'->>'listing_published')::numeric, 1);
    INSERT INTO public.affiliate_campaign_daily_scores
      (campaign_id, affiliate_id, score_date, active_listings, score)
    SELECT c.id, s.affiliate_id, CURRENT_DATE, s.active_listings, s.active_listings * weight
    FROM public.campaign_active_listings(c.id) s
    ON CONFLICT (campaign_id, affiliate_id, score_date)
    DO UPDATE SET active_listings = EXCLUDED.active_listings, score = EXCLUDED.score;
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
  END LOOP;
  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_campaign_scores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snapshot_campaign_scores() TO service_role;

-- ─── cron: snapshot every night ──────────────────────────────────────────────
SELECT cron.unschedule('snapshot-campaign-scores')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-campaign-scores');

SELECT cron.schedule('snapshot-campaign-scores', '15 1 * * *', $cron$
  SELECT public.snapshot_campaign_scores();
$cron$);

COMMENT ON FUNCTION public.campaign_active_listings(uuid) IS
  'Live read-only campaign score: count of currently published+active listings per (active) affiliate for campaign-tagged referrals. Zero money risk.';
COMMENT ON FUNCTION public.snapshot_campaign_scores() IS
  'Nightly upsert of daily campaign score snapshots (for net_change windows + leaderboard history). total-mode reads live.';
