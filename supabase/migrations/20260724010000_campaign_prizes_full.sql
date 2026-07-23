-- Campaign finalization, round 2 (WS-1o): compute ALL prize types (placing,
-- milestone, monthly) and record cash prizes as payable awards.
--
-- The results jsonb now carries typed entries:
--   { kind:'placing',  placing:int, affiliate_id, score, cash, floor }
--   { kind:'milestone', milestone:text, affiliate_id, score, cash, floor:0 }
--   { kind:'monthly',   period:'YYYY-MM', affiliate_id, score(net change), cash, floor:0 }
-- Human labels are built in TS (lib/affiliate/finalize.ts) from these facts.

-- ── Payable cash prizes ──────────────────────────────────────────────────────
-- Publishing a final auto-creates one 'owed' row per cash prize; an admin then
-- settles it (marks paid) the same way affiliate payouts are settled — the money
-- transfer itself stays admin-initiated, this just tracks what is owed.
CREATE TABLE IF NOT EXISTS public.affiliate_prize_awards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES public.affiliate_campaigns(id) ON DELETE CASCADE,
  affiliate_id uuid NOT NULL REFERENCES public.affiliate_accounts(id) ON DELETE RESTRICT,
  label        text NOT NULL,
  amount       numeric NOT NULL CHECK (amount > 0),
  currency     text NOT NULL DEFAULT 'ZAR',
  status       text NOT NULL DEFAULT 'owed' CHECK (status = ANY (ARRAY['owed','paid','void'])),
  awarded_at   timestamptz NOT NULL DEFAULT now(),
  awarded_by   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  paid_at      timestamptz,
  paid_by      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reference    text,
  UNIQUE (campaign_id, affiliate_id, label)
);

ALTER TABLE public.affiliate_prize_awards ENABLE ROW LEVEL SECURITY;

-- A partner may read their OWN prize awards; all writes go through the service
-- role (admin actions). Mirrors affiliate_payouts_own_read.
CREATE POLICY affiliate_prize_awards_own_read ON public.affiliate_prize_awards
  FOR SELECT USING (
    affiliate_id IN (
      SELECT affiliate_accounts.id FROM public.affiliate_accounts
      WHERE affiliate_accounts.user_id = auth.uid()
    )
  );

-- ── Richer winner computation ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_campaign_results(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c        public.affiliate_campaigns%ROWTYPE;
  v_prizes jsonb;
  v_out    jsonb := '[]'::jsonb;
  v_prize  jsonb;
  v_aff    uuid;
  v_score  int;
  v_month  date;
  v_cash   numeric;
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

  -- ── MILESTONE: first_to_10 (earliest to reach 10 live listings) ──
  FOR v_prize IN SELECT e FROM jsonb_array_elements(v_prizes) e WHERE e->>'milestone' = 'first_to_10'
  LOOP
    SELECT affiliate_id INTO v_aff
    FROM public.affiliate_campaign_daily_scores
    WHERE campaign_id = p_campaign_id AND active_listings >= 10
    ORDER BY score_date ASC, created_at ASC LIMIT 1;
    IF FOUND THEN
      v_out := v_out || jsonb_build_object(
        'kind', 'milestone', 'milestone', 'first_to_10',
        'affiliate_id', v_aff, 'cash', COALESCE((v_prize->>'cash')::numeric, 0), 'floor', 0);
    END IF;
  END LOOP;

  -- ── MILESTONE: any_reaching_5_in_30d (first to reach 5 within 30 days of start) ──
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
