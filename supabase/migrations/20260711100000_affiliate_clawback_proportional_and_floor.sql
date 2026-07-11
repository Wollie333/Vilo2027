-- Migration: Affiliate program — proportional clawback + true admin payout floor.
--
-- Two hardening fixes (founder-directed 2026-07-11):
--
-- 1. PROPORTIONAL CLAWBACK. A refund/credit that reverses a charge
--    (reverses_ledger_id set) now claws back commission IN PROPORTION to the
--    amount reversed, not always in full:
--      • Full refund (refund amount ≈ the charge)      → the commission is voided.
--      • Pro-rated cancel refund/credit (partial)      → a negative offset for the
--        reversed share is posted; the affiliate keeps the used-portion share.
--    Everything flows through reverses_ledger_id + the trigger, which now passes
--    the refund amount so the RPC can compute the fraction. The trigger also fires
--    for a linked 'credit' (pro-rated cancel can mint a credit note, not just a
--    refund) — goodwill credits are NOT linked, so they never claw back.
--
-- 2. TRUE ADMIN FLOOR. create_affiliate_payout used
--    COALESCE(acct.payout_threshold, admin_min) — a stale, lower per-affiliate
--    threshold could undercut a later-raised admin minimum. It now uses
--    GREATEST(personal, admin_min) so the admin's "Min payout" is always a hard
--    floor: an affiliate can never request below it.

-- ─── proportional clawback ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clawback_affiliate_commission(
  p_source_ledger_id uuid,
  p_refund_ledger_id uuid,
  p_refund_amount numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c            public.affiliate_commissions%ROWTYPE;
  v_charge_amt numeric;
  v_fraction   numeric := 1.0;
  v_claw       numeric;
BEGIN
  -- Fraction of each commission to reverse. NULL amount → full (back-compat).
  IF p_refund_amount IS NOT NULL THEN
    SELECT amount INTO v_charge_amt
    FROM public.platform_ledger WHERE id = p_source_ledger_id;
    IF COALESCE(v_charge_amt, 0) > 0 THEN
      v_fraction := least(1.0, round(abs(p_refund_amount) / v_charge_amt, 4));
    END IF;
  END IF;
  IF v_fraction <= 0 THEN RETURN; END IF;

  FOR c IN
    SELECT * FROM public.affiliate_commissions
    WHERE source_ledger_id = p_source_ledger_id
      AND entry_type = 'accrual'
      AND status IN ('pending', 'cleared', 'paid')
  LOOP
    v_claw := round(c.commission_amount * v_fraction, 2);
    IF v_claw <= 0 THEN CONTINUE; END IF;

    IF v_fraction >= 0.9999 AND c.status IN ('pending', 'cleared') THEN
      -- Full reversal, not yet paid → void the accrual in place.
      UPDATE public.affiliate_commissions
      SET status = 'voided', voided_at = now(), void_reason = 'refund',
          refund_ledger_id = COALESCE(refund_ledger_id, p_refund_ledger_id)
      WHERE id = c.id AND status IN ('pending', 'cleared');
    ELSE
      -- Partial reversal, or a full reversal of already-paid commission →
      -- negative offset (nets the balance / the next payout). One offset per
      -- (refund, kind) via uniq_commission_clawback; NOT EXISTS keeps re-runs
      -- (daily backstop) idempotent.
      IF NOT EXISTS (
        SELECT 1 FROM public.affiliate_commissions
        WHERE refund_ledger_id = p_refund_ledger_id
          AND kind = c.kind
          AND entry_type = 'clawback'
      ) THEN
        INSERT INTO public.affiliate_commissions (
          affiliate_id, referral_id, referred_host_id, product_id, source_ledger_id,
          entry_type, kind, base_amount, rate_type, rate_value, commission_amount,
          currency, status, hold_until, refund_ledger_id, voided_at, void_reason
        ) VALUES (
          c.affiliate_id, c.referral_id, c.referred_host_id, c.product_id, c.source_ledger_id,
          'clawback', c.kind, c.base_amount, c.rate_type, c.rate_value, -v_claw,
          c.currency, 'cleared', now(), p_refund_ledger_id, now(),
          CASE WHEN v_fraction >= 0.9999 THEN 'refund_after_payout' ELSE 'partial_refund' END
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Trigger passes the refund amount so the RPC computes the fraction; fires for a
-- linked refund OR credit (pro-rated cancels can mint either).
CREATE OR REPLACE FUNCTION public.tg_affiliate_clawback_on_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.clawback_affiliate_commission(
    NEW.reverses_ledger_id, NEW.id, abs(NEW.amount));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS affiliate_clawback_on_refund ON public.platform_ledger;
CREATE TRIGGER affiliate_clawback_on_refund
  AFTER INSERT ON public.platform_ledger
  FOR EACH ROW
  WHEN (NEW.type IN ('refund', 'credit') AND NEW.reverses_ledger_id IS NOT NULL)
  EXECUTE FUNCTION public.tg_affiliate_clawback_on_refund();

-- Backstop cron: pass the refund amount too, so a partial refund the trigger
-- missed is offset proportionally (and re-runs stay idempotent).
SELECT cron.unschedule('affiliate-clawback-backstop')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'affiliate-clawback-backstop');

SELECT cron.schedule('affiliate-clawback-backstop', '23 2 * * *', $cron$
  DO $body$
  DECLARE r record;
  BEGIN
    FOR r IN
      SELECT pl.id AS refund_id, pl.reverses_ledger_id AS charge_id, abs(pl.amount) AS refund_amount
      FROM public.platform_ledger pl
      WHERE pl.type IN ('refund', 'credit') AND pl.reverses_ledger_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.affiliate_commissions ac
          WHERE ac.source_ledger_id = pl.reverses_ledger_id
            AND ac.entry_type = 'accrual'
            AND ac.status IN ('pending', 'cleared')
        )
    LOOP
      PERFORM public.clawback_affiliate_commission(r.charge_id, r.refund_id, r.refund_amount);
    END LOOP;
  END;
  $body$;
$cron$);

COMMENT ON FUNCTION public.clawback_affiliate_commission(uuid, uuid, numeric) IS
  'Proportionally reverses commission for a refunded/partially-refunded charge (fraction = refund/charge). Full → void; partial → negative offset. Idempotent.';

-- ─── true admin payout floor ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_affiliate_payout(
  p_affiliate_id uuid,
  p_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct       public.affiliate_accounts%ROWTYPE;
  s          public.affiliate_settings%ROWTYPE;
  fee_cfg    public.affiliate_payout_fees%ROWTYPE;
  dest       public.affiliate_payout_methods%ROWTYPE;
  v_threshold numeric;
  v_gross    numeric := 0;
  v_count    integer := 0;
  v_ids      uuid[];
  v_raw      numeric;
  v_fee      numeric := 0;
  v_net      numeric := 0;
  v_payout_id uuid;
BEGIN
  SELECT * INTO acct FROM public.affiliate_accounts WHERE id = p_affiliate_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF acct.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'suspended'); END IF;
  IF p_method NOT IN ('eft', 'paystack', 'paypal') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_method');
  END IF;

  SELECT * INTO s FROM public.affiliate_settings WHERE id = true;
  -- Admin's minimum is a HARD floor: a per-affiliate threshold can only RAISE it,
  -- never undercut it (guards a stale personal value after the admin raises min).
  v_threshold := greatest(COALESCE(acct.payout_threshold, 0), COALESCE(s.min_payout_threshold, 0));

  SELECT * INTO dest FROM public.affiliate_payout_methods
    WHERE affiliate_id = p_affiliate_id AND method = p_method
    ORDER BY is_default DESC, created_at LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'no_method'); END IF;

  SELECT COALESCE(sum(commission_amount), 0), count(*), COALESCE(array_agg(id), '{}')
  INTO v_gross, v_count, v_ids
  FROM (
    SELECT id, commission_amount
    FROM public.affiliate_commissions
    WHERE affiliate_id = p_affiliate_id
      AND status = 'cleared'
      AND payout_id IS NULL
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
  ) q;

  IF v_count = 0 OR v_gross <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nothing_to_pay');
  END IF;
  IF v_gross < v_threshold THEN
    RETURN jsonb_build_object('ok', false, 'error', 'below_threshold',
      'gross', v_gross, 'threshold', v_threshold);
  END IF;

  SELECT * INTO fee_cfg FROM public.affiliate_payout_fees WHERE method = p_method;
  v_raw := COALESCE(fee_cfg.fixed_fee, 0) + v_gross * COALESCE(fee_cfg.percent_fee, 0) / 100.0;
  IF fee_cfg.cap_fee IS NOT NULL THEN v_raw := least(v_raw, fee_cfg.cap_fee); END IF;
  v_gross := round(v_gross, 2);
  v_fee := round(greatest(0, least(v_raw, v_gross)), 2);
  v_net := round(v_gross - v_fee, 2);

  INSERT INTO public.affiliate_payouts (
    affiliate_id, method, status, gross_amount, fee_amount, net_amount, currency,
    fee_config_snapshot, destination_snapshot, provider
  ) VALUES (
    p_affiliate_id, p_method, 'requested', v_gross, v_fee, v_net, acct.currency,
    jsonb_build_object('fixed', fee_cfg.fixed_fee, 'percent', fee_cfg.percent_fee, 'cap', fee_cfg.cap_fee),
    CASE p_method
      WHEN 'eft' THEN jsonb_build_object(
        'bank_name', dest.bank_name, 'account_name', dest.account_name,
        'account_number', dest.account_number, 'branch_code', dest.branch_code)
      WHEN 'paystack' THEN jsonb_build_object('paystack_recipient_code', dest.paystack_recipient_code)
      ELSE jsonb_build_object('paypal_email', dest.paypal_email)
    END,
    'manual'
  )
  RETURNING id INTO v_payout_id;

  UPDATE public.affiliate_commissions
  SET payout_id = v_payout_id
  WHERE id = ANY(v_ids);

  RETURN jsonb_build_object('ok', true, 'payout_id', v_payout_id,
    'gross', v_gross, 'fee', v_fee, 'net', v_net, 'count', v_count);
END;
$$;
