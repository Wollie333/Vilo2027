-- Migration: payout threshold sweep-ups (SoT §4.2 / §10.6).
--
-- The R1,000 threshold normally holds a balance back. Three cases sweep ANY
-- balance regardless of amount: competition close, partner account closure, and
-- once annually in June. Negative-balance carry-forward already works (a
-- refund-after-payout inserts a negative 'cleared' offset that nets the next
-- payout — see 20260711100000), so this migration only adds the bypass.
--
-- create_affiliate_payout gains p_bypass_threshold (DEFAULT false → every existing
-- 2-arg call is unchanged). sweep_affiliate_payouts() pays out each eligible
-- balance with the bypass on; the June cron calls it for everyone, and it can be
-- called for one partner at competition close / account closure.

-- ── create_affiliate_payout + threshold bypass ──────────────────────────────
DROP FUNCTION IF EXISTS public.create_affiliate_payout(uuid, text);

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

  RETURN jsonb_build_object('ok', true, 'payout_id', v_payout_id,
    'gross', v_gross, 'fee', v_fee, 'net', v_net, 'count', v_count,
    'swept', p_bypass_threshold);
END;
$$;

REVOKE ALL ON FUNCTION public.create_affiliate_payout(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_affiliate_payout(uuid, text, boolean) TO service_role;

COMMENT ON FUNCTION public.create_affiliate_payout(uuid, text, boolean) IS
  'Atomically claims cleared commission into a new payout request (fee deducted). p_bypass_threshold=true sweeps any balance regardless of the minimum (competition close / account closure / June).';

-- ── sweep_affiliate_payouts: pay out eligible balances, bypassing the threshold ─
CREATE OR REPLACE FUNCTION public.sweep_affiliate_payouts(p_affiliate_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        record;
  v_method text;
  v_bal    numeric;
  v_res    jsonb;
  v_swept  integer := 0;
  v_skipped integer := 0;
BEGIN
  FOR r IN
    SELECT a.id
    FROM public.affiliate_accounts a
    WHERE a.status = 'active'
      AND (p_affiliate_id IS NULL OR a.id = p_affiliate_id)
  LOOP
    SELECT COALESCE(sum(commission_amount), 0) INTO v_bal
    FROM public.affiliate_commissions
    WHERE affiliate_id = r.id AND status = 'cleared' AND payout_id IS NULL;
    IF v_bal <= 0 THEN CONTINUE; END IF;

    SELECT method INTO v_method FROM public.affiliate_payout_methods
    WHERE affiliate_id = r.id ORDER BY is_default DESC, created_at LIMIT 1;
    IF v_method IS NULL THEN
      v_skipped := v_skipped + 1;   -- has a balance but no payout method on file
      CONTINUE;
    END IF;

    v_res := public.create_affiliate_payout(r.id, v_method, true);
    IF COALESCE((v_res->>'ok')::boolean, false) THEN
      v_swept := v_swept + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('swept', v_swept, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_affiliate_payouts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_affiliate_payouts(uuid) TO service_role;

COMMENT ON FUNCTION public.sweep_affiliate_payouts(uuid) IS
  'Sweep-up payout (SoT §4.2): pays out every eligible balance regardless of the threshold. Called with one id at competition close / account closure, or for all via the June cron. Skips partners with no payout method on file.';

-- ── June annual sweep cron ──────────────────────────────────────────────────
SELECT cron.unschedule('affiliate-june-sweep')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'affiliate-june-sweep');

SELECT cron.schedule('affiliate-june-sweep', '0 6 1 6 *', $cron$
  SELECT public.sweep_affiliate_payouts();
$cron$);
