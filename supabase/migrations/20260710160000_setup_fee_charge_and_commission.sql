-- Migration: charge the product setup fee + accrue its commission.
--
-- Until now products.setup_fee (and its setup_fee_affiliate_* commission) were
-- stored on the product but NEVER charged and NEVER paid out — the checkout only
-- billed the recurring price, and accrue_affiliate_commission only knew the
-- 'subscription' kind (see the note in 20260616000013). This wires it up:
--
--   1. product_orders.setup_fee_amount  — the setup-fee portion folded into the
--      order's `amount` on the FIRST purchase of a subscription-like product.
--   2. platform_ledger.setup_fee_amount — that portion carried onto the charge
--      row so commission can be split off it.
--   3. accrue_affiliate_commission — now emits TWO independent commission rows
--      from one charge: kind='subscription' on the recurring net (amount − VAT −
--      setup) and kind='setup_fee' on the setup portion, each with its own
--      configured rate. Both remain idempotent via UNIQUE(source_ledger_id, kind).
--
-- The setup fee is charged once (first purchase only, enforced in the checkout
-- code), so its commission naturally accrues once; the unique index guards replays.

ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS setup_fee_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.platform_ledger
  ADD COLUMN IF NOT EXISTS setup_fee_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.product_orders.setup_fee_amount IS
  'The once-off setup-fee portion folded into `amount` (0 when none / renewal).';
COMMENT ON COLUMN public.platform_ledger.setup_fee_amount IS
  'The setup-fee portion of this charge; commission is split off it (kind=setup_fee).';

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
  v_net_total  numeric;   -- amount − VAT (net actually paid)
  v_setup      numeric;   -- setup-fee portion (net; VAT is assigned to recurring)
  v_recur_net  numeric;   -- recurring net = v_net_total − v_setup
  v_hold       timestamptz;
  v_n          integer;
  v_commission numeric;
  v_result     uuid;      -- the subscription accrual id (back-compat return)
  v_new_id     uuid;
BEGIN
  SELECT * INTO l FROM public.platform_ledger WHERE id = p_ledger_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF l.type <> 'charge' OR l.status <> 'completed' THEN RETURN NULL; END IF;
  IF l.user_id IS NULL THEN RETURN NULL; END IF;

  -- The payer must be a bound referral.
  SELECT * INTO ref FROM public.affiliate_referrals WHERE referred_user_id = l.user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO acct FROM public.affiliate_accounts WHERE id = ref.affiliate_id;
  IF NOT FOUND OR acct.status <> 'active' THEN RETURN NULL; END IF;

  -- Resolve the product: explicit product_id, else by plan slug (subscriptions).
  IF l.product_id IS NOT NULL THEN
    SELECT * INTO prod FROM public.products WHERE id = l.product_id;
  ELSIF l.plan IS NOT NULL THEN
    SELECT * INTO prod FROM public.products WHERE slug = l.plan ORDER BY created_at LIMIT 1;
  END IF;
  IF prod.id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO s FROM public.affiliate_settings WHERE id = true;
  v_hold := now() + make_interval(days => COALESCE(s.hold_days, 30));

  -- Split the net into recurring + setup. VAT (usually 0 on these rows) is
  -- assigned to the recurring portion; the setup portion is capped at the net.
  v_net_total := round(l.amount - COALESCE(l.vat_amount, 0), 2);
  IF v_net_total <= 0 THEN RETURN NULL; END IF;
  v_setup := round(least(GREATEST(COALESCE(l.setup_fee_amount, 0), 0), v_net_total), 2);
  v_recur_net := round(GREATEST(v_net_total - v_setup, 0), 2);

  -- ── Recurring / one-off commission (kind='subscription') ──────────────────
  IF prod.affiliate_type <> 'none' AND COALESCE(prod.affiliate_value, 0) > 0
     AND v_recur_net > 0 THEN
    -- Recurring-duration cutoff (subscriptions only; one-off accrues per purchase).
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
      ELSE  -- fixed amount, never more than the recurring net actually paid
        v_commission := round(least(prod.affiliate_value, v_recur_net), 2);
      END IF;
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
    ELSE  -- fixed amount, never more than the setup net actually paid
      v_commission := round(least(prod.setup_fee_affiliate_value, v_setup), 2);
    END IF;
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

COMMENT ON FUNCTION public.accrue_affiliate_commission(uuid) IS
  'Derives affiliate commission from a completed platform_ledger charge: kind=subscription on the recurring net + kind=setup_fee on the setup portion. Idempotent per (source_ledger_id, kind).';
