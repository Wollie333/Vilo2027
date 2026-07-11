-- Migration: Affiliate tiers — a BONUS layered on top of the per-product base
-- commission (founder-confirmed model). Affiliates qualify for a tier by their
-- lifetime CLEARED earnings; the tier adds a bonus % to every commission they
-- earn. The per-product rate stays the source of truth — a tier never replaces
-- it, only multiplies the result.

CREATE TABLE IF NOT EXISTS public.affiliate_tiers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  -- Unlock threshold: lifetime cleared earnings ≥ this.
  min_lifetime_earnings numeric NOT NULL DEFAULT 0 CHECK (min_lifetime_earnings >= 0),
  -- Bonus added on top of the base commission, in percent (e.g. 10 = +10%).
  bonus_percent         numeric NOT NULL DEFAULT 0 CHECK (bonus_percent >= 0),
  sort_order            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_tiers ENABLE ROW LEVEL SECURITY;
-- Any authenticated user may read the tier ladder (portal shows their tier).
CREATE POLICY affiliate_tiers_read ON public.affiliate_tiers
  FOR SELECT USING (auth.role() = 'authenticated');
-- Writes go through the service-role admin client.

-- Default ladder (admin-editable in Affiliate settings).
INSERT INTO public.affiliate_tiers (name, min_lifetime_earnings, bonus_percent, sort_order)
VALUES
  ('Standard', 0,     0,  0),
  ('Silver',   5000,  10, 1),
  ('Gold',     20000, 25, 2)
ON CONFLICT DO NOTHING;

-- The bonus % an affiliate currently qualifies for (highest tier whose threshold
-- their lifetime CLEARED earnings meet). Clawback offsets (also 'cleared') net in.
CREATE OR REPLACE FUNCTION public.affiliate_tier_bonus(p_affiliate_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earn  numeric;
  v_bonus numeric;
BEGIN
  SELECT COALESCE(sum(commission_amount), 0) INTO v_earn
  FROM public.affiliate_commissions
  WHERE affiliate_id = p_affiliate_id AND status IN ('cleared', 'paid');

  SELECT bonus_percent INTO v_bonus
  FROM public.affiliate_tiers
  WHERE min_lifetime_earnings <= v_earn
  ORDER BY min_lifetime_earnings DESC
  LIMIT 1;

  RETURN COALESCE(v_bonus, 0);
END;
$$;

-- ── Accrual with the tier bonus applied to both commission kinds ─────────────
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

  -- ── Recurring / one-off commission (kind='subscription') ──────────────────
  IF prod.affiliate_type <> 'none' AND COALESCE(prod.affiliate_value, 0) > 0
     AND v_recur_net > 0 THEN
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
