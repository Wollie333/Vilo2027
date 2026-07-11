-- Affiliate ledger rows inherit the environment of the money they came from,
-- instead of always 'live'. A commission from a test charge is test money; a
-- payout inherits from the commissions it settles. This keeps affiliate rows in
-- the same test/live scope as the charges that produced them.

CREATE OR REPLACE FUNCTION public.emit_affiliate_commission_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_curr text;
  v_name text;
  v_env  text;
BEGIN
  SELECT a.user_id, COALESCE(NEW.currency, a.currency, 'ZAR')
    INTO v_user, v_curr
  FROM public.affiliate_accounts a WHERE a.id = NEW.affiliate_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_name FROM public.products WHERE id = NEW.product_id;
  SELECT environment INTO v_env FROM public.platform_ledger WHERE id = NEW.source_ledger_id;
  v_env := COALESCE(v_env, 'live');

  IF TG_OP = 'UPDATE' AND NEW.entry_type = 'accrual'
     AND NEW.status = 'cleared' AND OLD.status IS DISTINCT FROM 'cleared' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.platform_ledger
      WHERE affiliate_commission_id = NEW.id AND type = 'commission' AND amount > 0
    ) THEN
      INSERT INTO public.platform_ledger (
        user_id, host_id, type, status, amount, currency, environment,
        provider, reason, affiliate_commission_id, paid_at)
      VALUES (
        v_user, NULL, 'commission', 'completed', NEW.commission_amount, v_curr, v_env,
        'affiliate', 'Affiliate commission' || COALESCE(' · ' || v_name, ''),
        NEW.id, now());
    END IF;

  ELSIF TG_OP = 'UPDATE' AND NEW.entry_type = 'accrual'
        AND NEW.status = 'voided' AND OLD.status = 'cleared' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.platform_ledger
      WHERE affiliate_commission_id = NEW.id AND type = 'commission' AND amount < 0
    ) THEN
      INSERT INTO public.platform_ledger (
        user_id, host_id, type, status, amount, currency, environment,
        provider, reason, affiliate_commission_id, paid_at)
      VALUES (
        v_user, NULL, 'commission', 'completed', -abs(NEW.commission_amount), v_curr, v_env,
        'affiliate', 'Affiliate commission reversal' || COALESCE(' · ' || v_name, ''),
        NEW.id, now());
    END IF;

  ELSIF TG_OP = 'INSERT' AND NEW.entry_type = 'clawback' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.platform_ledger WHERE affiliate_commission_id = NEW.id
    ) THEN
      INSERT INTO public.platform_ledger (
        user_id, host_id, type, status, amount, currency, environment,
        provider, reason, affiliate_commission_id, paid_at)
      VALUES (
        v_user, NULL, 'commission', 'completed', NEW.commission_amount, v_curr, v_env,
        'affiliate', 'Affiliate commission reversal' || COALESCE(' · ' || v_name, ''),
        NEW.id, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.emit_affiliate_payout_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_env  text;
BEGIN
  IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.affiliate_accounts WHERE id = NEW.affiliate_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;

  -- Inherit env from a commission this payout settles (fallback live).
  SELECT pl.environment INTO v_env
  FROM public.affiliate_commissions ac
  JOIN public.platform_ledger pl ON pl.id = ac.source_ledger_id
  WHERE ac.payout_id = NEW.id
  LIMIT 1;
  v_env := COALESCE(v_env, 'live');

  IF NOT EXISTS (
    SELECT 1 FROM public.platform_ledger WHERE affiliate_payout_id = NEW.id
  ) THEN
    INSERT INTO public.platform_ledger (
      user_id, host_id, type, status, amount, currency, environment,
      provider, provider_reference, reason, affiliate_payout_id, paid_at)
    VALUES (
      v_user, NULL, 'payout', 'completed', -abs(NEW.net_amount),
      COALESCE(NEW.currency, 'ZAR'), v_env,
      COALESCE(NEW.provider, 'affiliate'), NEW.provider_reference,
      'Affiliate payout' || COALESCE(' · ' || NEW.method, ''),
      NEW.id, now());
  END IF;

  RETURN NEW;
END;
$$;
