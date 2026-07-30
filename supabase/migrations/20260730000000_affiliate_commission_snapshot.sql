-- Migration: Affiliate commission SNAPSHOT + 25% standard rate (launch model).
--
-- Decision doc: docs/strategy/AFFILIATE_COMPETITION_DECISIONS.md.
--
-- WHAT CHANGES
--  1. affiliate_referrals gains `commission_snapshot jsonb` — the commission
--     structure captured at bind time for a campaign-tagged referral.
--  2. accrue_affiliate_commission resolves a campaign referral from that SNAPSHOT
--     instead of the live campaign. This makes the rate PERMANENT for the
--     referral: it survives the campaign ending (status <> 'active') and any
--     later edit to the campaign's structure — the "60% lifetime, locked at
--     referral time" guarantee, and the fix for the campaign-end fallback bug
--     (an ended Founding Race used to silently drop referrals to the default).
--  3. The standard (non-campaign) default-program rate on `pro` becomes 25%
--     lifetime (was 20% test / 'none' at seed). Still admin-editable config.
--  4. The Founding Race prize `floor` fields are stripped — with commission flat
--     at 60% a rate floor is redundant. Cash prizes are untouched.
--
-- Money-safety: the default (campaign_id IS NULL) path is byte-identical. Only
-- the campaign branch changes its SOURCE of the structure (snapshot vs live).
-- Idempotency guard uniq_commission_accrual(source_ledger_id, kind) unchanged;
-- clawback via reverses_ledger_id unchanged.

-- ── 1. Snapshot column ───────────────────────────────────────────────────────
ALTER TABLE public.affiliate_referrals
  ADD COLUMN IF NOT EXISTS commission_snapshot jsonb;

COMMENT ON COLUMN public.affiliate_referrals.commission_snapshot IS
  'Commission structure (campaigns.commission_structure shape) captured at bind time for a campaign-tagged referral. The accrual resolver reads THIS, not the live campaign, so the rate is permanent — it survives the campaign ending and later edits. NULL for default-program referrals (they track the live per-product rate).';

-- Backfill any existing campaign-tagged referral from its campaign's current
-- structure (pre-MVP: expected 0 real rows, but keeps old rows resolvable).
UPDATE public.affiliate_referrals r
SET commission_snapshot = c.commission_structure
FROM public.affiliate_campaigns c
WHERE r.campaign_id = c.id
  AND r.commission_snapshot IS NULL;

-- ── 2. Standard default-program rate → 25% lifetime ──────────────────────────
-- The launch "standard rate". Editable afterwards in the admin ProductEditor.
UPDATE public.products
SET affiliate_type = 'percent',
    affiliate_value = 25,
    affiliate_duration = 'forever',
    affiliate_duration_months = NULL
WHERE slug = 'pro';

-- ── 3. Strip redundant prize floors from active/any campaigns ────────────────
-- Remove the `floor` key from every prize object; keep cash/placing/milestone.
UPDATE public.affiliate_campaigns c
SET competition = jsonb_set(
      c.competition,
      '{prizes}',
      (
        SELECT COALESCE(jsonb_agg(p - 'floor'), '[]'::jsonb)
        FROM jsonb_array_elements(c.competition->'prizes') AS p
      )
    )
WHERE c.competition ? 'prizes'
  AND jsonb_typeof(c.competition->'prizes') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(c.competition->'prizes') AS p
    WHERE p ? 'floor'
  );

-- ── 4. Accrual resolver — reads the per-referral snapshot ────────────────────
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

  -- ── Campaign resolution — reads the PER-REFERRAL SNAPSHOT ──────────────────
  -- The commission structure is captured onto affiliate_referrals.commission_snapshot
  -- at bind time (see bindAffiliateReferral). Reading it HERE — not the live
  -- campaign — makes the rate permanent for the referral: it no longer depends on
  -- the campaign still being 'active', so an ended competition keeps paying its
  -- locked rate, and a later edit to the campaign never re-rates an existing
  -- referral. Fallback: a legacy campaign referral with no snapshot reads the
  -- live campaign structure so it never silently pays nothing.
  IF ref.campaign_id IS NOT NULL THEN
    v_campaign_id := ref.campaign_id;              -- stamp all rows for this charge
    cs := ref.commission_snapshot;
    IF cs IS NULL THEN
      SELECT commission_structure INTO cs
      FROM public.affiliate_campaigns WHERE id = ref.campaign_id;
    END IF;
    IF cs IS NOT NULL THEN
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
  IF v_recur_net > 0 AND (
       (prod.affiliate_type <> 'none' AND COALESCE(prod.affiliate_value, 0) > 0)
       OR v_use_camp
     ) THEN

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
      SELECT count(*) INTO v_n
      FROM public.affiliate_commissions
      WHERE referral_id = ref.id AND product_id = prod.id
        AND kind = 'subscription' AND entry_type = 'accrual';

      IF v_use_camp THEN
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

COMMENT ON FUNCTION public.accrue_affiliate_commission(uuid) IS
  'Accrues affiliate commission for a completed charge. Default per-product path byte-identical. Campaign-tagged referrals resolve from affiliate_referrals.commission_snapshot (captured at bind time) — permanent rate that survives campaign end + edits. Idempotent on (source_ledger_id, kind).';
