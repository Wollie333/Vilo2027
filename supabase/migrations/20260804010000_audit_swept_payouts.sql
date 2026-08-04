-- F6 · Audit every SWEPT payout.
--
-- The threshold-bypassing sweeps (June annual cron, competition close,
-- partner account closure) create real affiliate_payouts rows via
-- create_affiliate_payout(..., p_bypass_threshold => true), but those code
-- paths run in SQL / cron and bypass the app's withAdminAudit wrapper, so a
-- swept payout landed with NO admin_audit_log row — a gap in the finance audit
-- trail (the triggering ACTION is audited, but not the individual payout).
--
-- Fix: create_affiliate_payout emits one admin_audit_log row per payout it
-- creates under bypass (i.e. every sweep). admin_id is NULL (system/cron
-- initiated — admin_audit_log.admin_id is nullable); the payload carries the
-- affiliate, method and amounts. Normal partner-requested payouts
-- (p_bypass_threshold => false) are unchanged — they are the partner's own
-- action, not an admin/system mutation, and are unaffected here.
--
-- Body is otherwise the live 20260730080000 definition, verbatim, plus the one
-- INSERT before RETURN. admin_audit_log is INSERT-only (append), so this is a
-- pure append with no UPDATE/DELETE.

CREATE OR REPLACE FUNCTION public.create_affiliate_payout(
  p_affiliate_id uuid,
  p_method text,
  p_bypass_threshold boolean DEFAULT false
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
  -- Sweep-ups (competition close / account closure / June) bypass the threshold.
  IF NOT p_bypass_threshold AND v_gross < v_threshold THEN
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

  -- F6 · a swept payout (threshold bypassed) has no app-layer audit row, so
  -- write one here for the finance trail. System/cron initiated → admin_id NULL.
  IF p_bypass_threshold THEN
    INSERT INTO public.admin_audit_log (
      admin_id, action, target_type, target_id, payload
    ) VALUES (
      NULL, 'affiliate.payout_swept', 'affiliate_payout', v_payout_id,
      jsonb_build_object(
        'affiliate_id', p_affiliate_id,
        'method', p_method,
        'gross', v_gross,
        'fee', v_fee,
        'net', v_net,
        'commission_count', v_count
      )
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'payout_id', v_payout_id,
    'gross', v_gross, 'fee', v_fee, 'net', v_net, 'count', v_count,
    'swept', p_bypass_threshold);
END;
$$;

REVOKE ALL ON FUNCTION public.create_affiliate_payout(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_affiliate_payout(uuid, text, boolean) TO service_role;

COMMENT ON FUNCTION public.create_affiliate_payout(uuid, text, boolean) IS
  'Atomically claims cleared commission into a new payout request (fee deducted). p_bypass_threshold=true sweeps any balance regardless of the minimum (competition close / account closure / June) AND writes an admin_audit_log row (system-initiated, admin_id NULL) so swept payouts are audited (F6).';
