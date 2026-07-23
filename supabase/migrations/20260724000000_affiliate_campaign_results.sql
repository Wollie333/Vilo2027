-- Campaign finalization (WS-1n): auto-close ended campaigns + compute the winners.
--
-- Flow: a campaign runs 'active'. At its end date the hourly cron auto-closes it
-- (status → 'ended') and COMPUTES the placing winners into `results` — visible to
-- admins only. An admin reviews and clicks "Accept & publish", which stamps
-- `results_published_at` (TS action) → the public final leaderboard reveals the
-- winners + prizes, and the placing FLOOR prizes are awarded through the existing
-- floor engine. Nothing is public until the admin approves.
--
-- `results` shape: [{ placing, affiliate_id, score, cash, floor }, …] — the
-- minimal facts; names/slugs are resolved at render. Cash prizes are recorded as
-- owed (paid out-of-band); floor prizes are applied on publish.

ALTER TABLE public.affiliate_campaigns
  ADD COLUMN IF NOT EXISTS results jsonb,
  ADD COLUMN IF NOT EXISTS results_computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS results_published_at timestamptz;

-- ── Winner computation ───────────────────────────────────────────────────────
-- Rank the final standings by live listings (the same score the leaderboard
-- uses), tie-broken by who reached their score first (earliest daily snapshot) —
-- matching the competition's `earliest_to_final_score` tie-breaker. Then match
-- each PLACING prize to that rank. Returns the results jsonb (never writes).
CREATE OR REPLACE FUNCTION public.compute_campaign_results(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH standings AS (
    SELECT
      s.affiliate_id,
      s.active_listings,
      row_number() OVER (
        ORDER BY s.active_listings DESC, fs.first_date ASC NULLS LAST
      ) AS rnk
    FROM public.campaign_active_listings(p_campaign_id) s
    LEFT JOIN (
      SELECT affiliate_id, min(score_date) AS first_date
      FROM public.affiliate_campaign_daily_scores
      WHERE campaign_id = p_campaign_id AND active_listings > 0
      GROUP BY affiliate_id
    ) fs ON fs.affiliate_id = s.affiliate_id
  ),
  prizes AS (
    SELECT elem
    FROM public.affiliate_campaigns c,
         LATERAL jsonb_array_elements(COALESCE(c.competition->'prizes', '[]'::jsonb)) elem
    WHERE c.id = p_campaign_id AND elem ? 'placing'
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'placing', (p.elem->>'placing')::int,
        'affiliate_id', st.affiliate_id,
        'score', st.active_listings,
        'cash', COALESCE((p.elem->>'cash')::numeric, 0),
        'floor', COALESCE((p.elem->>'floor')::numeric, 0)
      )
      ORDER BY (p.elem->>'placing')::int
    ),
    '[]'::jsonb
  )
  FROM prizes p
  JOIN standings st ON st.rnk = (p.elem->>'placing')::int;
$function$;

REVOKE ALL ON FUNCTION public.compute_campaign_results(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_campaign_results(uuid) TO service_role;

-- ── Auto-close + compute (the cron body) ─────────────────────────────────────
-- Closes every active campaign past its end date and stores the computed winners
-- for admin review. Does NOT publish — results_published_at stays NULL until an
-- admin accepts. Idempotent: only ever touches status='active' rows.
CREATE OR REPLACE FUNCTION public.finalize_ended_campaigns()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c   record;
  n   integer := 0;
BEGIN
  FOR c IN
    SELECT id FROM public.affiliate_campaigns
    WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= now()
  LOOP
    UPDATE public.affiliate_campaigns
    SET status = 'ended',
        results = public.compute_campaign_results(c.id),
        results_computed_at = now()
    WHERE id = c.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_ended_campaigns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_ended_campaigns() TO service_role;

-- Hourly: auto-close campaigns at their end date and compute winners.
SELECT cron.schedule(
  'finalize-ended-campaigns',
  '30 * * * *',
  $cron$ SELECT public.finalize_ended_campaigns(); $cron$
);
