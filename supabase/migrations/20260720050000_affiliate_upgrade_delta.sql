-- Migration: H2 — affiliate treatment of prorated mid-cycle UPGRADE deltas.
--
-- Founder decision (2026-07-20): a prorated upgrade top-up (the small delta a host
-- pays when moving to a higher tier mid-cycle) SHOULD earn affiliate commission at
-- the RECURRING rate, but must NOT consume a once/months duration slot. Previously
-- the delta accrued kind='subscription' and burned a slot, so a capped affiliate
-- earned on the tiny delta and was blocked from the full first charge of the new
-- tier (an UNDER-pay). `forever` was unaffected; it never over-paid.
--
-- Mechanism: mark the delta's platform_ledger charge with is_prorated_upgrade, and
-- accrue it as a distinct kind='upgrade'. The subscription duration counter only
-- counts kind='subscription', so the delta neither consumes nor is gated by a slot —
-- it always earns, and the full first renewal of the new tier still earns as the
-- first 'subscription' period. (See RECURRING_BILLING_HARDENING_AND_GOLIVE.md H2.)

-- 1) Mark upgrade-delta charges. Set true by the Paystack delta seed
--    (activate_on_pay=false order) and, once wired, the PayPal setup-fee sale.
ALTER TABLE public.platform_ledger
  ADD COLUMN IF NOT EXISTS is_prorated_upgrade boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.platform_ledger.is_prorated_upgrade IS
  'True for a mid-cycle prorated UPGRADE top-up charge (the delta). Drives kind=''upgrade'' affiliate accrual that does not consume a duration slot (H2).';

-- 2) Allow the new commission kind.
ALTER TABLE public.affiliate_commissions
  DROP CONSTRAINT IF EXISTS affiliate_commissions_kind_check;
ALTER TABLE public.affiliate_commissions
  ADD CONSTRAINT affiliate_commissions_kind_check
  CHECK (kind IN ('subscription','setup_fee','upgrade'));

-- 3) Accrual: branch the recurring block so an upgrade delta accrues kind='upgrade'
--    at the recurring rate, ungated by and invisible to the duration counter.
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
  v_bonus      numeric;   -- tier bonus % applied on top of the base commission
  v_result     uuid;
  v_new_id     uuid;
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

  -- Tier bonus for this affiliate (0 when no tier / not qualified).
  v_bonus := public.affiliate_tier_bonus(acct.id);

  v_net_total := round(l.amount - COALESCE(l.vat_amount, 0), 2);
  IF v_net_total <= 0 THEN RETURN NULL; END IF;
  v_setup := round(least(GREATEST(COALESCE(l.setup_fee_amount, 0), 0), v_net_total), 2);
  v_recur_net := round(GREATEST(v_net_total - v_setup, 0), 2);

  -- ── Recurring / one-off / upgrade-delta commission ────────────────────────
  IF prod.affiliate_type <> 'none' AND COALESCE(prod.affiliate_value, 0) > 0
     AND v_recur_net > 0 THEN

    IF l.is_prorated_upgrade THEN
      -- H2 — prorated mid-cycle UPGRADE top-up. Earns at the recurring rate but is
      -- accrued as kind='upgrade', which the 'subscription' duration counter below
      -- ignores — so the delta neither consumes a once/months slot nor is gated by
      -- one. The full first charge of the new tier still earns as period 1.
      IF prod.affiliate_type = 'percent' THEN
        v_commission := round(v_recur_net * prod.affiliate_value / 100.0, 2);
      ELSE
        v_commission := round(least(prod.affiliate_value, v_recur_net), 2);
      END IF;
      v_commission := round(v_commission * (1 + v_bonus / 100.0), 2);
      IF v_commission > 0 THEN
        INSERT INTO public.affiliate_commissions (
          affiliate_id, referral_id, referred_host_id, product_id, source_ledger_id,
          entry_type, kind, base_amount, rate_type, rate_value, commission_amount,
          currency, status, billing_period, hold_until
        ) VALUES (
          acct.id, ref.id, ref.referred_host_id, prod.id, l.id,
          'accrual', 'upgrade', v_recur_net, prod.affiliate_type, prod.affiliate_value,
          v_commission, l.currency, 'pending', 0, v_hold
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

      IF prod.type <> 'subscription'
         OR (prod.affiliate_duration = 'once' AND v_n < 1)
         OR (prod.affiliate_duration = 'months'
             AND v_n < COALESCE(prod.affiliate_duration_months, 0))
         OR prod.affiliate_duration = 'forever' THEN
        IF prod.affiliate_type = 'percent' THEN
          v_commission := round(v_recur_net * prod.affiliate_value / 100.0, 2);
        ELSE
          v_commission := round(least(prod.affiliate_value, v_recur_net), 2);
        END IF;
        -- Apply the tier bonus on top of the base commission.
        v_commission := round(v_commission * (1 + v_bonus / 100.0), 2);
        IF v_commission > 0 THEN
          INSERT INTO public.affiliate_commissions (
            affiliate_id, referral_id, referred_host_id, product_id, source_ledger_id,
            entry_type, kind, base_amount, rate_type, rate_value, commission_amount,
            currency, status, billing_period, hold_until
          ) VALUES (
            acct.id, ref.id, ref.referred_host_id, prod.id, l.id,
            'accrual', 'subscription', v_recur_net, prod.affiliate_type, prod.affiliate_value,
            v_commission, l.currency, 'pending', v_n + 1, v_hold
          )
          ON CONFLICT DO NOTHING
          RETURNING id INTO v_new_id;
          v_result := COALESCE(v_result, v_new_id);
        END IF;
      END IF;
    END IF;
  END IF;

  -- ── Setup-fee commission (kind='setup_fee', once per charge) ──────────────
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
        currency, status, billing_period, hold_until
      ) VALUES (
        acct.id, ref.id, ref.referred_host_id, prod.id, l.id,
        'accrual', 'setup_fee', v_setup, prod.setup_fee_affiliate_type,
        prod.setup_fee_affiliate_value, v_commission, l.currency, 'pending', 1, v_hold
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_new_id;
      v_result := COALESCE(v_result, v_new_id);
    END IF;
  END IF;

  RETURN v_result;
END;
$$;
