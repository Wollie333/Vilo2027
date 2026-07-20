-- Migration: Affiliate CAMPAIGN commission resolver (WS-1.5) — THE money branch.
--
-- The default accrual path stays BYTE-IDENTICAL. `accrue_affiliate_commission`
-- gains ONE gated branch: if the source charge's referral carries an ACTIVE
-- `campaign_id`, the recurring commission resolves under that campaign's
-- `commission_structure` instead of the per-product rate. When `campaign_id` is
-- NULL (every referral today) the function behaves exactly as before — same
-- rates, same bonus, same rows — only now stamping `campaign_id = NULL`.
--
-- Models (commission_structure.model):
--   • inherit → per-product rate × tier bonus (identical to default), campaign-stamped
--   • flat    → a fixed % (fraction) or Rand amount on the recurring NET, NO tier bonus
--   • ladder  → MAX(band_rate, won_floor) on the recurring NET of SUBSCRIPTION charges,
--               NO tier bonus; the band comes from the affiliate's month-to-date
--               collected subscription revenue for THIS campaign (the "book")
--
-- Duration: a campaign supplies its own duration (once/recurring(N)/lifetime),
-- overriding the product's affiliate_duration for campaign-tagged referrals. The
-- Founding Race = lifetime → every paid subscription period earns.
--
-- Money-safety (blueprint §11): default path unchanged; one gated branch; same
-- idempotency guard uniq_commission_accrual(source_ledger_id, kind); clawback via
-- reverses_ledger_id is kind-agnostic (campaign rows claw back unchanged);
-- re-rating touches PENDING rows only (never cleared/paid) so the cleared-time
-- platform_ledger mirror never desyncs; scoring/book are read-only.

-- ─── helper: ladder band rate for a given book (pure) ────────────────────────
-- bands JSON: [{max:10000,rate:0.10},…,{max:null,rate:0.25}]. Returns the rate
-- (fraction 0..1) of the first band (ascending by ceiling, null = open top) whose
-- ceiling the book does not exceed. Whole-book: one rate applies to the entire book.
CREATE OR REPLACE FUNCTION public.ladder_rate_for_book(p_bands jsonb, p_book numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  b jsonb;
BEGIN
  IF p_bands IS NULL OR jsonb_typeof(p_bands) <> 'array' THEN RETURN 0; END IF;
  FOR b IN
    SELECT elem
    FROM jsonb_array_elements(p_bands) AS elem
    ORDER BY ((elem->>'max') IS NULL), NULLIF(elem->>'max', '')::numeric
  LOOP
    IF (b->>'max') IS NULL THEN
      RETURN COALESCE((b->>'rate')::numeric, 0);          -- open-ended top band
    ELSIF p_book <= (b->>'max')::numeric THEN
      RETURN COALESCE((b->>'rate')::numeric, 0);
    END IF;
  END LOOP;
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.ladder_rate_for_book(jsonb, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ladder_rate_for_book(jsonb, numeric) TO service_role;

-- ─── helper: the ladder "book" — month-to-date collected subscription revenue ─
-- Sum of NET (amount − vat_amount) over COMPLETED subscription charges collected
-- in the calendar month of p_asof, from users this affiliate referred UNDER this
-- campaign. scope='subscription' → subscription_id IS NOT NULL only (one-off
-- products never feed the band). Churn-sensitive by construction: a churned host
-- simply stops generating charges, so their revenue leaves next month's window.
-- (Refunds are not netted from the band in v1 — a documented simplification; the
-- commission itself still claws back via reverses_ledger_id.)
CREATE OR REPLACE FUNCTION public.campaign_ladder_book(
  p_affiliate_id uuid,
  p_campaign_id  uuid,
  p_asof         timestamptz DEFAULT now()
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(round(pl.amount - COALESCE(pl.vat_amount, 0), 2)), 0)
  FROM public.platform_ledger pl
  JOIN public.affiliate_referrals r ON r.referred_user_id = pl.user_id
  WHERE r.affiliate_id = p_affiliate_id
    AND r.campaign_id  = p_campaign_id
    AND pl.type = 'charge'
    AND pl.status = 'completed'
    AND pl.subscription_id IS NOT NULL
    AND COALESCE(pl.paid_at, pl.created_at) >= date_trunc('month', p_asof)
    AND COALESCE(pl.paid_at, pl.created_at) <  date_trunc('month', p_asof) + interval '1 month';
$$;

REVOKE ALL ON FUNCTION public.campaign_ladder_book(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_ladder_book(uuid, uuid, timestamptz) TO service_role;

-- ─── accrual: the default path + ONE gated campaign branch ───────────────────
CREATE OR REPLACE FUNCTION public.accrue_affiliate_commission(p_ledger_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l            public.platform_ledger%ROWTYPE;
  ref          public.affiliate_referrals%ROWTYPE;
  acct         public.affiliate_accounts%ROWTYPE;
  prod         public.products%ROWTYPE;
  s            public.affiliate_settings%ROWTYPE;
  camp         public.affiliate_campaigns%ROWTYPE;
  v_net_total  numeric;
  v_setup      numeric;
  v_recur_net  numeric;
  v_hold       timestamptz;
  v_n          integer;
  v_commission numeric;
  v_bonus      numeric;   -- tier bonus % (default program only)
  v_result     uuid;
  v_new_id     uuid;
  -- campaign layer
  v_campaign_id uuid := NULL;
  cs            jsonb;
  v_model       text;
  v_use_camp    boolean := false;  -- does the campaign OVERRIDE the recurring rate?
  v_rate_type   text;
  v_rate_value  numeric;
  v_book        numeric;
  v_eff         numeric;           -- effective ladder fraction (0..1)
  v_floor       numeric;
  v_dur         text;
  v_dur_n       integer;
  v_emit        boolean;
BEGIN
  SELECT * INTO l FROM public.platform_ledger WHERE id = p_ledger_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF l.type <> 'charge' OR l.status <> 'completed' THEN RETURN NULL; END IF;
  IF l.user_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO ref FROM public.affiliate_referrals WHERE referred_user_id = l.user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO acct FROM public.affiliate_accounts WHERE id = ref.affiliate_id;
  IF NOT FOUND OR acct.status <> 'active' THEN RETURN NULL; END IF;

  IF l.product_id IS NOT NULL THEN
    SELECT * INTO prod FROM public.products WHERE id = l.product_id;
  ELSIF l.plan IS NOT NULL THEN
    SELECT * INTO prod FROM public.products WHERE slug = l.plan ORDER BY created_at LIMIT 1;
  END IF;
  IF prod.id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO s FROM public.affiliate_settings WHERE id = true;
  v_hold := now() + make_interval(days => COALESCE(s.hold_days, 30));
  v_bonus := public.affiliate_tier_bonus(acct.id);

  v_net_total := round(l.amount - COALESCE(l.vat_amount, 0), 2);
  IF v_net_total <= 0 THEN RETURN NULL; END IF;
  v_setup := round(least(GREATEST(COALESCE(l.setup_fee_amount, 0), 0), v_net_total), 2);
  v_recur_net := round(GREATEST(v_net_total - v_setup, 0), 2);

  -- ── Campaign resolution (the ONE gated branch) ────────────────────────────
  -- Only an ACTIVE campaign tags. NULL / inactive / inherit → default rate.
  IF ref.campaign_id IS NOT NULL THEN
    SELECT * INTO camp FROM public.affiliate_campaigns WHERE id = ref.campaign_id;
    IF FOUND AND camp.status = 'active' THEN
      v_campaign_id := camp.id;                 -- stamp all rows for this charge
      cs := camp.commission_structure;
      v_model := cs->>'model';
      IF v_model = 'flat' THEN
        v_use_camp := true;
        IF COALESCE(cs->>'flat_type', 'percent') = 'amount' THEN
          v_rate_type  := 'amount';
          v_rate_value := COALESCE((cs->>'flat_rate')::numeric, 0);       -- Rand
        ELSE
          v_rate_type  := 'percent';
          v_rate_value := round(COALESCE((cs->>'flat_rate')::numeric, 0) * 100, 4); -- fraction→%
        END IF;
      ELSIF v_model = 'ladder' AND prod.type = 'subscription' THEN
        -- Ladder overrides SUBSCRIPTION charges only. A one-off product bought by
        -- a ladder-campaign referral falls back to its per-product rate below.
        v_use_camp := true;
        v_book  := public.campaign_ladder_book(acct.id, v_campaign_id); -- incl. this charge
        v_floor := COALESCE((
          SELECT floor_rate FROM public.affiliate_campaign_floors
          WHERE affiliate_id = acct.id AND campaign_id = v_campaign_id), 0);
        v_eff := GREATEST(public.ladder_rate_for_book(cs->'bands', v_book), v_floor);
        v_rate_type  := 'percent';
        v_rate_value := round(v_eff * 100, 4);   -- store as percent, matching convention
      END IF;
      -- 'inherit' (or ladder on a one-off): v_use_camp stays false → default rate,
      -- but v_campaign_id is set so the row is still stamped to the campaign.
    END IF;
  END IF;

  -- ── Recurring / one-off / upgrade-delta commission ────────────────────────
  -- Runs if the product carries a default rate OR the campaign supplies one.
  IF v_recur_net > 0 AND (
       (prod.affiliate_type <> 'none' AND COALESCE(prod.affiliate_value, 0) > 0)
       OR v_use_camp
     ) THEN

    -- Resolve the recurring rate + commission (shared by upgrade + subscription).
    IF v_use_camp THEN
      IF v_rate_type = 'percent' THEN
        v_commission := round(v_recur_net * v_rate_value / 100.0, 2);
      ELSE
        v_commission := round(least(v_rate_value, v_recur_net), 2);
      END IF;
      -- Campaign overrides carry NO tier bonus (the structure IS the progression).
    ELSE
      v_rate_type  := prod.affiliate_type;
      v_rate_value := prod.affiliate_value;
      IF prod.affiliate_type = 'percent' THEN
        v_commission := round(v_recur_net * prod.affiliate_value / 100.0, 2);
      ELSE
        v_commission := round(least(prod.affiliate_value, v_recur_net), 2);
      END IF;
      v_commission := round(v_commission * (1 + v_bonus / 100.0), 2);
    END IF;

    IF l.is_prorated_upgrade THEN
      -- H2 — prorated mid-cycle UPGRADE top-up; kind='upgrade', no duration slot.
      IF v_commission > 0 THEN
        INSERT INTO public.affiliate_commissions (
          affiliate_id, referral_id, referred_host_id, product_id, source_ledger_id,
          entry_type, kind, base_amount, rate_type, rate_value, commission_amount,
          currency, status, billing_period, hold_until, campaign_id
        ) VALUES (
          acct.id, ref.id, ref.referred_host_id, prod.id, l.id,
          'accrual', 'upgrade', v_recur_net, v_rate_type, v_rate_value,
          v_commission, l.currency, 'pending', 0, v_hold, v_campaign_id
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_new_id;
        v_result := COALESCE(v_result, v_new_id);
      END IF;

    ELSE
      -- Standard recurring / one-off accrual (kind='subscription'), duration-capped.
      SELECT count(*) INTO v_n
      FROM public.affiliate_commissions
      WHERE referral_id = ref.id AND product_id = prod.id
        AND kind = 'subscription' AND entry_type = 'accrual';

      IF v_use_camp THEN
        -- Campaign duration overrides the product's for tagged referrals.
        v_dur   := COALESCE(cs->>'duration', 'lifetime');
        v_dur_n := COALESCE((cs->>'recurring_periods')::int, 0);
        v_emit := (prod.type <> 'subscription')
               OR (v_dur = 'once' AND v_n < 1)
               OR (v_dur = 'recurring' AND v_n < v_dur_n)
               OR (v_dur = 'lifetime');
      ELSE
        v_emit := (prod.type <> 'subscription')
               OR (prod.affiliate_duration = 'once' AND v_n < 1)
               OR (prod.affiliate_duration = 'months'
                   AND v_n < COALESCE(prod.affiliate_duration_months, 0))
               OR (prod.affiliate_duration = 'forever');
      END IF;

      IF v_emit AND v_commission > 0 THEN
        INSERT INTO public.affiliate_commissions (
          affiliate_id, referral_id, referred_host_id, product_id, source_ledger_id,
          entry_type, kind, base_amount, rate_type, rate_value, commission_amount,
          currency, status, billing_period, hold_until, campaign_id
        ) VALUES (
          acct.id, ref.id, ref.referred_host_id, prod.id, l.id,
          'accrual', 'subscription', v_recur_net, v_rate_type, v_rate_value,
          v_commission, l.currency, 'pending', v_n + 1, v_hold, v_campaign_id
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_new_id;
        v_result := COALESCE(v_result, v_new_id);
      END IF;
    END IF;
  END IF;

  -- ── Setup-fee commission (kind='setup_fee') — default per-product, campaign-stamped ──
  IF v_setup > 0 AND prod.setup_fee_affiliate_type <> 'none'
     AND COALESCE(prod.setup_fee_affiliate_value, 0) > 0 THEN
    IF prod.setup_fee_affiliate_type = 'percent' THEN
      v_commission := round(v_setup * prod.setup_fee_affiliate_value / 100.0, 2);
    ELSE
      v_commission := round(least(prod.setup_fee_affiliate_value, v_setup), 2);
    END IF;
    v_commission := round(v_commission * (1 + v_bonus / 100.0), 2);
    IF v_commission > 0 THEN
      INSERT INTO public.affiliate_commissions (
        affiliate_id, referral_id, referred_host_id, product_id, source_ledger_id,
        entry_type, kind, base_amount, rate_type, rate_value, commission_amount,
        currency, status, billing_period, hold_until, campaign_id
      ) VALUES (
        acct.id, ref.id, ref.referred_host_id, prod.id, l.id,
        'accrual', 'setup_fee', v_setup, prod.setup_fee_affiliate_type,
        prod.setup_fee_affiliate_value, v_commission, l.currency, 'pending', 1, v_hold,
        v_campaign_id
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_new_id;
      v_result := COALESCE(v_result, v_new_id);
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

-- ─── ladder re-rate: whole-book retroactive, PENDING rows only ───────────────
-- For each active ladder campaign, level every affiliate's current-month PENDING
-- ladder rows to the current band (MAX band, floor). PENDING-only is the money-
-- safety invariant: a pending row has NOT emitted its cleared-time platform_ledger
-- mirror yet, so updating commission_amount can never desync the mirror. With the
-- 30-day hold, current-month rows are always still pending. Never touches
-- cleared/paid/voided rows.
CREATE OR REPLACE FUNCTION public.recompute_affiliate_campaign_rates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c        record;
  a        record;
  v_book   numeric;
  v_floor  numeric;
  v_eff    numeric;
  v_total  integer := 0;
  v_n      integer;
BEGIN
  FOR c IN
    SELECT id, commission_structure AS cs
    FROM public.affiliate_campaigns
    WHERE status = 'active'
      AND commission_structure->>'model' = 'ladder'
  LOOP
    FOR a IN
      SELECT DISTINCT affiliate_id
      FROM public.affiliate_commissions
      WHERE campaign_id = c.id
        AND entry_type = 'accrual'
        AND status = 'pending'
        AND kind IN ('subscription', 'upgrade')
        AND rate_type = 'percent'
        AND created_at >= date_trunc('month', now())
        AND created_at <  date_trunc('month', now()) + interval '1 month'
    LOOP
      v_book  := public.campaign_ladder_book(a.affiliate_id, c.id);
      v_floor := COALESCE((
        SELECT floor_rate FROM public.affiliate_campaign_floors
        WHERE affiliate_id = a.affiliate_id AND campaign_id = c.id), 0);
      v_eff := GREATEST(public.ladder_rate_for_book(c.cs->'bands', v_book), v_floor);

      UPDATE public.affiliate_commissions
      SET rate_value = round(v_eff * 100, 4),
          commission_amount = round(base_amount * v_eff, 2)
      WHERE campaign_id = c.id
        AND affiliate_id = a.affiliate_id
        AND entry_type = 'accrual'
        AND status = 'pending'
        AND kind IN ('subscription', 'upgrade')
        AND rate_type = 'percent'
        AND created_at >= date_trunc('month', now())
        AND created_at <  date_trunc('month', now()) + interval '1 month';
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_total := v_total + v_n;
    END LOOP;
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_affiliate_campaign_rates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_affiliate_campaign_rates() TO service_role;

-- ─── cron: re-rate nightly (mirrors the affiliate-cron idiom) ────────────────
SELECT cron.unschedule('recompute-affiliate-campaign-rates')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recompute-affiliate-campaign-rates');

SELECT cron.schedule('recompute-affiliate-campaign-rates', '35 1 * * *', $cron$
  SELECT public.recompute_affiliate_campaign_rates();
$cron$);

COMMENT ON FUNCTION public.accrue_affiliate_commission(uuid) IS
  'Accrues affiliate commission for a completed charge. Default per-product path is byte-identical; ONE gated branch resolves campaign-tagged referrals under the campaign commission_structure (inherit/flat/ladder). Idempotent on (source_ledger_id, kind).';
COMMENT ON FUNCTION public.recompute_affiliate_campaign_rates() IS
  'Nightly whole-book re-rate of current-month PENDING ladder commission rows to the current band (MAX band, floor). Pending-only → never desyncs the cleared-time platform_ledger mirror.';
