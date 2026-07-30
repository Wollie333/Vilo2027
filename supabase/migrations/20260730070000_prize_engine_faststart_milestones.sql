-- Migration: prize engine — all milestones + Fast Start (SoT §5.5 / §10.5).
--
-- compute_campaign_results previously computed only the first_to_10 milestone and
-- a single-winner any_reaching_5_in_30d. The SoT prize set needs:
--   • milestones first_host_live (>=1), first_to_10 (>=10), first_to_25 (>=25) —
--     each "first past the post, once each";
--   • Fast Start — NON-competitive: R1 000 to EVERY partner who reaches >=5 live
--     listings within THEIR first 30 days (from enrolment where present, else
--     their first scored day). Multiple winners.
-- Placings + monthly net-change are unchanged. Awards are still created as 'owed'
-- rows on publish and require admin settle (= the "admin approval" gate).
--
-- Mid-race auto-flagging of milestones (flag the moment hit, not only at close)
-- is a follow-up — this migration makes the FINAL award set correct + complete.

CREATE OR REPLACE FUNCTION public.compute_campaign_results(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c          public.affiliate_campaigns%ROWTYPE;
  v_prizes   jsonb;
  v_out      jsonb := '[]'::jsonb;
  v_prize    jsonb;
  v_aff      uuid;
  v_score    int;
  v_month    date;
  v_cash     numeric;
  v_threshold int;
BEGIN
  SELECT * INTO c FROM public.affiliate_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  v_prizes := COALESCE(c.competition->'prizes', '[]'::jsonb);

  -- ── PLACING: rank by final live listings, tie-break earliest-to-score ──
  FOR v_prize IN SELECT e FROM jsonb_array_elements(v_prizes) e WHERE e ? 'placing'
  LOOP
    SELECT st.affiliate_id, st.active_listings INTO v_aff, v_score
    FROM (
      SELECT s.affiliate_id, s.active_listings,
        row_number() OVER (ORDER BY s.active_listings DESC, fs.first_date ASC NULLS LAST) AS rnk
      FROM public.campaign_active_listings(p_campaign_id) s
      LEFT JOIN (
        SELECT affiliate_id, min(score_date) AS first_date
        FROM public.affiliate_campaign_daily_scores
        WHERE campaign_id = p_campaign_id AND active_listings > 0
        GROUP BY affiliate_id
      ) fs ON fs.affiliate_id = s.affiliate_id
    ) st
    WHERE st.rnk = (v_prize->>'placing')::int;
    IF FOUND THEN
      v_out := v_out || jsonb_build_object(
        'kind', 'placing', 'placing', (v_prize->>'placing')::int,
        'affiliate_id', v_aff, 'score', v_score,
        'cash', COALESCE((v_prize->>'cash')::numeric, 0),
        'floor', COALESCE((v_prize->>'floor')::numeric, 0));
    END IF;
  END LOOP;

  -- ── MILESTONES: first_host_live / first_to_10 / first_to_25 (earliest to
  --    reach the threshold live listings; first past the post, once each) ──
  FOR v_prize IN
    SELECT e FROM jsonb_array_elements(v_prizes) e
    WHERE e->>'milestone' IN ('first_host_live', 'first_to_10', 'first_to_25')
  LOOP
    v_threshold := CASE v_prize->>'milestone'
      WHEN 'first_host_live' THEN 1
      WHEN 'first_to_10' THEN 10
      WHEN 'first_to_25' THEN 25
    END;
    SELECT affiliate_id INTO v_aff
    FROM public.affiliate_campaign_daily_scores
    WHERE campaign_id = p_campaign_id AND active_listings >= v_threshold
    ORDER BY score_date ASC, created_at ASC LIMIT 1;
    IF FOUND THEN
      v_out := v_out || jsonb_build_object(
        'kind', 'milestone', 'milestone', v_prize->>'milestone',
        'affiliate_id', v_aff, 'cash', COALESCE((v_prize->>'cash')::numeric, 0), 'floor', 0);
    END IF;
  END LOOP;

  -- ── MILESTONE (legacy, single-winner): any_reaching_5_in_30d from campaign
  --    start. Kept for campaigns still configured with it; Fast Start (below)
  --    is the SoT non-competitive replacement. ──
  FOR v_prize IN SELECT e FROM jsonb_array_elements(v_prizes) e WHERE e->>'milestone' = 'any_reaching_5_in_30d'
  LOOP
    SELECT affiliate_id INTO v_aff
    FROM public.affiliate_campaign_daily_scores
    WHERE campaign_id = p_campaign_id AND active_listings >= 5
      AND (c.starts_at IS NULL OR score_date <= (c.starts_at::date + 30))
    ORDER BY score_date ASC, created_at ASC LIMIT 1;
    IF FOUND THEN
      v_out := v_out || jsonb_build_object(
        'kind', 'milestone', 'milestone', 'any_reaching_5_in_30d',
        'affiliate_id', v_aff, 'cash', COALESCE((v_prize->>'cash')::numeric, 0), 'floor', 0);
    END IF;
  END LOOP;

  -- ── FAST START: non-competitive. R<cash> to EVERY partner who reached >=5
  --    live listings within their first 30 days (from enrolment if present, else
  --    their first scored day). Every qualifier is a winner. ──
  FOR v_prize IN SELECT e FROM jsonb_array_elements(v_prizes) e WHERE e ? 'fast_start'
  LOOP
    v_cash := COALESCE((v_prize->>'fast_start')::numeric, 0);
    IF v_cash <= 0 THEN CONTINUE; END IF;
    FOR v_aff IN
      WITH starts AS (
        SELECT ds.affiliate_id,
          COALESCE(
            (SELECT min(en.enrolled_at)::date
             FROM public.affiliate_campaign_enrollments en
             WHERE en.campaign_id = p_campaign_id AND en.affiliate_id = ds.affiliate_id),
            min(ds.score_date)
          ) AS window_start
        FROM public.affiliate_campaign_daily_scores ds
        WHERE ds.campaign_id = p_campaign_id
        GROUP BY ds.affiliate_id
      )
      SELECT s.affiliate_id
      FROM starts s
      WHERE EXISTS (
        SELECT 1 FROM public.affiliate_campaign_daily_scores d
        WHERE d.campaign_id = p_campaign_id AND d.affiliate_id = s.affiliate_id
          AND d.active_listings >= 5
          AND d.score_date <= s.window_start + 30
      )
    LOOP
      v_out := v_out || jsonb_build_object(
        'kind', 'fast_start', 'affiliate_id', v_aff, 'score', 5,
        'cash', v_cash, 'floor', 0);
    END LOOP;
  END LOOP;

  -- ── MONTHLY: top net-change per calendar month with movement ──
  FOR v_prize IN SELECT e FROM jsonb_array_elements(v_prizes) e WHERE e ? 'monthly_top_net_change'
  LOOP
    v_cash := COALESCE((v_prize->>'monthly_top_net_change')::numeric, 0);
    FOR v_month IN
      SELECT DISTINCT date_trunc('month', score_date)::date AS m
      FROM public.affiliate_campaign_daily_scores
      WHERE campaign_id = p_campaign_id
      ORDER BY m
    LOOP
      SELECT mm.affiliate_id, (mm.last_v - mm.first_v) INTO v_aff, v_score
      FROM (
        SELECT affiliate_id,
          (array_agg(active_listings ORDER BY score_date ASC))[1]  AS first_v,
          (array_agg(active_listings ORDER BY score_date DESC))[1] AS last_v
        FROM public.affiliate_campaign_daily_scores
        WHERE campaign_id = p_campaign_id
          AND date_trunc('month', score_date)::date = v_month
        GROUP BY affiliate_id
      ) mm
      ORDER BY (mm.last_v - mm.first_v) DESC, mm.affiliate_id ASC
      LIMIT 1;
      IF FOUND AND v_score > 0 AND v_cash > 0 THEN
        v_out := v_out || jsonb_build_object(
          'kind', 'monthly', 'period', to_char(v_month, 'YYYY-MM'),
          'affiliate_id', v_aff, 'score', v_score, 'cash', v_cash, 'floor', 0);
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.compute_campaign_results(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_campaign_results(uuid) TO service_role;

-- Add the Fast Start prize to the Founding Race config (R1 000 per qualifier).
UPDATE public.affiliate_campaigns
SET competition = jsonb_set(
      competition, '{prizes}',
      (competition->'prizes') || '[{"fast_start": 1000}]'::jsonb
    )
WHERE slug = 'founding-race'
  AND NOT (competition->'prizes' @> '[{"fast_start": 1000}]'::jsonb);
