-- Migration: Affiliate program — atomic payout request RPC.
--
-- create_affiliate_payout(affiliate_id, method): in ONE transaction, locks the
-- affiliate's cleared, unattached commission rows (FOR UPDATE SKIP LOCKED so two
-- concurrent requests can't claim the same row), sums them (negative clawback
-- offsets net automatically), checks the payout threshold, computes the
-- per-method fee (deducted from the affiliate), inserts the payout header, and
-- stamps payout_id onto the claimed rows. Returns a jsonb result.
--
-- Settlement (cleared→paid) and rejection (un-stamp) are admin actions in P7.

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
  v_threshold := COALESCE(acct.payout_threshold, s.min_payout_threshold, 0);

  SELECT * INTO dest FROM public.affiliate_payout_methods
    WHERE affiliate_id = p_affiliate_id AND method = p_method
    ORDER BY is_default DESC, created_at LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'no_method'); END IF;

  -- Atomically lock + claim the cleared, unattached commission rows.
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

COMMENT ON FUNCTION public.create_affiliate_payout(uuid, text) IS
  'Atomically claims cleared commission into a new payout request (fee deducted from the affiliate).';
