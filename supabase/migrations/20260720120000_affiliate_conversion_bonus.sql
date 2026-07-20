-- Migration: Affiliate CAMPAIGN conversion bonus (WS-1.6).
--
-- A flat cash bonus paid ONCE when a campaign-referred host's FIRST paid
-- subscription activates (R250 monthly / R400 annual for the Founding Race).
-- Separate from the ladder; "paid immediately" (short/zero hold) to carry
-- partners through the unpaid beta months. Still clawed back if the activating
-- payment is refunded/charged-back — it stamps source_ledger_id = the activating
-- charge, so the existing kind-agnostic clawback (reverses_ledger_id) reverses it.
--
-- Idempotency: once PER REFERRED HOST per campaign — a dedicated partial unique
-- index on (referral_id) WHERE kind='conversion_bonus' guarantees it even under
-- concurrent accrual of two different charges (the (source_ledger_id, kind) guard
-- alone would not, since the two charges have different ledger ids).

-- 1) Allow the new commission kind.
ALTER TABLE public.affiliate_commissions
  DROP CONSTRAINT IF EXISTS affiliate_commissions_kind_check;
ALTER TABLE public.affiliate_commissions
  ADD CONSTRAINT affiliate_commissions_kind_check
  CHECK (kind IN ('subscription','setup_fee','upgrade','conversion_bonus'));

-- 2) Once-per-referred-host guard for the conversion bonus.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversion_bonus
  ON public.affiliate_commissions(referral_id)
  WHERE kind = 'conversion_bonus' AND entry_type = 'accrual';

-- 3) Configure the Founding Race conversion bonus (pre-MVP: edit the seed row).
UPDATE public.affiliate_campaigns
SET commission_structure = commission_structure
      || jsonb_build_object('conversion_bonus', jsonb_build_object('monthly', 250, 'annual', 400))
WHERE slug = 'founding-race';

-- 4) Accrual: the WS-1.5 resolver + a conversion-bonus block.
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
  v_conv_amt    numeric;           -- conversion bonus (flat cash)
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
  IF ref.campaign_id IS NOT NULL THEN
    SELECT * INTO camp FROM public.affiliate_campaigns WHERE id = ref.campaign_id;
    IF FOUND AND camp.status = 'active' THEN
      v_campaign_id := camp.id;
      cs := camp.commission_structure;
      v_model := cs->>'model';
      IF v_model = 'flat' THEN
        v_use_camp := true;
        IF COALESCE(cs->>'flat_type', 'percent') = 'amount' THEN
          v_rate_type  := 'amount';
          v_rate_value := COALESCE((cs->>'flat_rate')::numeric, 0);
        ELSE
          v_rate_type  := 'percent';
          v_rate_value := round(COALESCE((cs->>'flat_rate')::numeric, 0) * 100, 4);
        END IF;
      ELSIF v_model = 'ladder' AND prod.type = 'subscription' THEN
        v_use_camp := true;
        v_book  := public.campaign_ladder_book(acct.id, v_campaign_id);
        v_floor := COALESCE((
          SELECT floor_rate FROM public.affiliate_campaign_floors
          WHERE affiliate_id = acct.id AND campaign_id = v_campaign_id), 0);
        v_eff := GREATEST(public.ladder_rate_for_book(cs->'bands', v_book), v_floor);
        v_rate_type  := 'percent';
        v_rate_value := round(v_eff * 100, 4);
      END IF;
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

  -- ── Conversion bonus (campaign; flat cash; ONCE per referred host) ─────────
  -- Fires on the first PAID subscription charge of a campaign-referred host. The
  -- free-beta R0 charges never reach here (v_net_total <= 0 returns early). Zero
  -- hold so it clears on the next clearing run; the partial unique index makes it
  -- once-per-referral even under concurrent charges; clawback covers it via
  -- source_ledger_id = the activating charge.
  IF v_campaign_id IS NOT NULL AND prod.type = 'subscription' AND cs ? 'conversion_bonus'
     AND NOT EXISTS (
       SELECT 1 FROM public.affiliate_commissions
       WHERE referral_id = ref.id AND kind = 'conversion_bonus' AND entry_type = 'accrual'
     ) THEN
    v_conv_amt := COALESCE((
      cs->'conversion_bonus'->>(
        CASE WHEN COALESCE(l.billing_cycle, 'monthly') IN ('annual', 'annually', 'yearly', 'year')
             THEN 'annual' ELSE 'monthly' END)
    )::numeric, 0);
    IF v_conv_amt > 0 THEN
      INSERT INTO public.affiliate_commissions (
        affiliate_id, referral_id, referred_host_id, product_id, source_ledger_id,
        entry_type, kind, base_amount, rate_type, rate_value, commission_amount,
        currency, status, billing_period, hold_until, campaign_id
      ) VALUES (
        acct.id, ref.id, ref.referred_host_id, prod.id, l.id,
        'accrual', 'conversion_bonus', v_conv_amt, 'amount', v_conv_amt,
        v_conv_amt, l.currency, 'pending', 1, now(), v_campaign_id
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_new_id;
      v_result := COALESCE(v_result, v_new_id);
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

COMMENT ON INDEX public.uniq_conversion_bonus IS
  'One conversion bonus per referred host per campaign (race-safe; (source_ledger_id,kind) alone would not guard across two different activating charges).';
