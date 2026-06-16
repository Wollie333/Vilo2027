-- Migration: Affiliate program — accrual + clawback RPCs (the finance engine).
--
-- accrue_affiliate_commission(ledger_id): called right after a COMPLETED
--   platform_ledger 'charge' is written (Paystack webhook for products +
--   subscriptions/renewals, and admin manual charges). Derives one commission
--   row from the charge. Idempotent via UNIQUE(source_ledger_id, kind).
--
-- clawback_affiliate_commission(charge_id, refund_id): voids/offsets commission
--   when a charge is refunded. Fired by a trigger when a refund row links to its
--   charge via the new platform_ledger.reverses_ledger_id column. The 30-day hold
--   means most refunds hit while commission is still 'pending' (simply voided);
--   a refund after payout posts a negative offset that nets the next payout.
--
-- NOTE: setup-fee commission (products.setup_fee_affiliate_*) is intentionally
-- NOT accrued yet — the billing flow does not charge the setup fee as a
-- separable platform_ledger amount, so there is nothing to base it on. The
-- affiliate_commissions.kind = 'setup_fee' path is reserved for when it does.

-- A refund can point at the charge it reverses (additive; enables auto-clawback).
ALTER TABLE public.platform_ledger
  ADD COLUMN IF NOT EXISTS reverses_ledger_id uuid
    REFERENCES public.platform_ledger(id) ON DELETE SET NULL;

-- ─── accrual ───────────────────────────────────────────────────────────────
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
  v_net        numeric;
  v_hold       timestamptz;
  v_n          integer;
  v_commission numeric;
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
  IF prod.affiliate_type = 'none' OR COALESCE(prod.affiliate_value, 0) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO s FROM public.affiliate_settings WHERE id = true;
  v_hold := now() + make_interval(days => COALESCE(s.hold_days, 30));

  -- NET base = amount paid minus VAT (coupon already reflected in amount).
  v_net := round(l.amount - COALESCE(l.vat_amount, 0), 2);
  IF v_net <= 0 THEN RETURN NULL; END IF;

  -- Recurring-duration cutoff (subscriptions only; one-off accrues per purchase).
  SELECT count(*) INTO v_n
  FROM public.affiliate_commissions
  WHERE referral_id = ref.id AND product_id = prod.id
    AND kind = 'subscription' AND entry_type = 'accrual';

  IF prod.type = 'subscription' THEN
    IF prod.affiliate_duration = 'once' AND v_n >= 1 THEN RETURN NULL; END IF;
    IF prod.affiliate_duration = 'months'
       AND v_n >= COALESCE(prod.affiliate_duration_months, 0) THEN RETURN NULL; END IF;
    -- 'forever' → always accrue
  END IF;

  IF prod.affiliate_type = 'percent' THEN
    v_commission := round(v_net * prod.affiliate_value / 100.0, 2);
  ELSE  -- 'amount' (fixed), never more than the net actually paid
    v_commission := round(least(prod.affiliate_value, v_net), 2);
  END IF;
  IF v_commission <= 0 THEN RETURN NULL; END IF;

  INSERT INTO public.affiliate_commissions (
    affiliate_id, referral_id, referred_host_id, product_id, source_ledger_id,
    entry_type, kind, base_amount, rate_type, rate_value, commission_amount,
    currency, status, billing_period, hold_until
  ) VALUES (
    acct.id, ref.id, ref.referred_host_id, prod.id, l.id,
    'accrual', 'subscription', v_net, prod.affiliate_type, prod.affiliate_value,
    v_commission, l.currency, 'pending', v_n + 1, v_hold
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ─── clawback ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clawback_affiliate_commission(
  p_source_ledger_id uuid,
  p_refund_ledger_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.affiliate_commissions%ROWTYPE;
BEGIN
  FOR c IN
    SELECT * FROM public.affiliate_commissions
    WHERE source_ledger_id = p_source_ledger_id
      AND entry_type = 'accrual'
      AND status IN ('pending', 'cleared', 'paid')
  LOOP
    IF c.status IN ('pending', 'cleared') THEN
      -- Not yet paid out → void in place.
      UPDATE public.affiliate_commissions
      SET status = 'voided', voided_at = now(), void_reason = 'refund',
          refund_ledger_id = COALESCE(refund_ledger_id, p_refund_ledger_id)
      WHERE id = c.id AND status IN ('pending', 'cleared');
    ELSE
      -- Already paid out → post a negative offset that nets the next payout.
      INSERT INTO public.affiliate_commissions (
        affiliate_id, referral_id, referred_host_id, product_id, source_ledger_id,
        entry_type, kind, base_amount, rate_type, rate_value, commission_amount,
        currency, status, hold_until, refund_ledger_id, voided_at, void_reason
      ) VALUES (
        c.affiliate_id, c.referral_id, c.referred_host_id, c.product_id, c.source_ledger_id,
        'clawback', c.kind, c.base_amount, c.rate_type, c.rate_value, -c.commission_amount,
        c.currency, 'cleared', now(), p_refund_ledger_id, now(), 'refund_after_payout'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- Auto-clawback when a refund row links to its charge.
CREATE OR REPLACE FUNCTION public.tg_affiliate_clawback_on_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.clawback_affiliate_commission(NEW.reverses_ledger_id, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS affiliate_clawback_on_refund ON public.platform_ledger;
CREATE TRIGGER affiliate_clawback_on_refund
  AFTER INSERT ON public.platform_ledger
  FOR EACH ROW
  WHEN (NEW.type = 'refund' AND NEW.reverses_ledger_id IS NOT NULL)
  EXECUTE FUNCTION public.tg_affiliate_clawback_on_refund();

COMMENT ON FUNCTION public.accrue_affiliate_commission(uuid) IS
  'Derives one affiliate commission row from a completed platform_ledger charge. Idempotent.';
COMMENT ON FUNCTION public.clawback_affiliate_commission(uuid, uuid) IS
  'Voids (pending/cleared) or negatively offsets (paid) commission for a refunded charge.';
