-- Migration: Affiliate money as REAL platform_ledger rows + auto-minted docs.
--
-- Founder req (2026-07-11): every affiliate commission, clawback/refund and
-- payout must be recorded on BOTH the affiliate's own ledger AND the main Wielo
-- ledger, each auto-generating a financial document — like charge→invoice and
-- refund→credit-note already do.
--
-- Design: affiliate_commissions / affiliate_payouts stay the money SSOT
-- (balances, payout claiming). On the real-money events they now EMIT a
-- platform_ledger row on the affiliate's OWN user_id:
--   • commission clears (pending→cleared)      → + 'commission' row  (earning)
--   • cleared commission reversed (refund)      → − 'commission' row  (reversal)
--   • clawback offset row inserted (partial)    → − 'commission' row  (reversal)
--   • payout paid                               → − 'payout' row      (cash out)
-- Each row mints a numbered wielo_credit_notes document via the existing trigger
-- (extended below), so it shows — with a downloadable doc — on the admin Wielo
-- ledger AND the affiliate's own Transactions page (RLS own-read). These types
-- are affiliate-axis and stay EXCLUDED from revenue KPIs (isAffiliateTxn).
-- Provisional (pending, held) commission is NOT documented — only real money.

-- ─── 1. platform_ledger: outbound affiliate types + back-links ───────────────
ALTER TABLE public.platform_ledger DROP CONSTRAINT IF EXISTS platform_ledger_type_check;
ALTER TABLE public.platform_ledger
  ADD CONSTRAINT platform_ledger_type_check
  CHECK (type IN ('charge','refund','credit','adjustment','commission','payout'));

ALTER TABLE public.platform_ledger
  ADD COLUMN IF NOT EXISTS affiliate_commission_id uuid
    REFERENCES public.affiliate_commissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_payout_id uuid
    REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL;

-- ─── 2. wielo_credit_notes: allow affiliate document kinds ───────────────────
ALTER TABLE public.wielo_credit_notes DROP CONSTRAINT IF EXISTS wielo_credit_notes_kind_check;
ALTER TABLE public.wielo_credit_notes
  ADD CONSTRAINT wielo_credit_notes_kind_check
  CHECK (kind IN ('refund','credit','adjustment','commission','payout'));

-- ─── 3. Mint docs for commission / payout rows too (no VAT split) ────────────
CREATE OR REPLACE FUNCTION mint_wielo_credit_note_on_ledger_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_biz      jsonb;
  v_buyer    jsonb;
  v_lines    jsonb;
  v_mag      numeric;
  v_subtotal numeric;
  v_vat      numeric;
  v_has_vat  boolean;
  v_desc     text;
  v_affiliate boolean;
BEGIN
  IF NEW.status <> 'completed'
     OR NEW.type NOT IN ('refund','credit','adjustment','commission','payout') THEN
    RETURN NEW;
  END IF;
  IF NEW.amount IS NULL OR NEW.amount = 0 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM wielo_credit_notes WHERE ledger_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_affiliate := NEW.type IN ('commission','payout');
  v_mag := abs(NEW.amount);

  SELECT value INTO v_biz FROM platform_settings WHERE key = 'wielo_business';
  v_biz := COALESCE(v_biz, '{}'::jsonb);

  SELECT jsonb_build_object('name', full_name, 'email', email)
    INTO v_buyer FROM user_profiles WHERE id = NEW.user_id;
  v_buyer := COALESCE(v_buyer, '{}'::jsonb);

  v_desc := COALESCE(NULLIF(btrim(NEW.reason), ''),
    CASE NEW.type
      WHEN 'refund'     THEN 'Refund'
      WHEN 'credit'     THEN 'Goodwill credit'
      WHEN 'commission' THEN CASE WHEN NEW.amount < 0
                                  THEN 'Affiliate commission reversal'
                                  ELSE 'Affiliate commission' END
      WHEN 'payout'     THEN 'Affiliate payout'
      ELSE 'Account adjustment'
    END);

  -- Affiliate documents are not VAT invoices — never split VAT out of them.
  v_has_vat := (NOT v_affiliate)
    AND NULLIF(btrim(v_biz->>'vat_number'), '') IS NOT NULL;
  IF v_has_vat THEN
    v_subtotal := round(v_mag / 1.15, 2);
    v_vat      := round(v_mag - v_subtotal, 2);
  ELSE
    v_subtotal := v_mag;
    v_vat      := 0;
  END IF;

  v_lines := jsonb_build_array(jsonb_build_object(
    'description', v_desc, 'quantity', 1, 'unit_price', v_mag, 'subtotal', v_mag));

  INSERT INTO wielo_credit_notes (
    credit_note_number, kind, ledger_id, user_id,
    wielo_snapshot, buyer_snapshot, line_items,
    subtotal, vat_amount, total_amount, signed_amount, currency,
    reason, status, environment, issued_at
  ) VALUES (
    next_wielo_credit_note_number(), NEW.type, NEW.id, NEW.user_id,
    v_biz, v_buyer, v_lines,
    v_subtotal, v_vat, v_mag, NEW.amount, NEW.currency,
    NEW.reason, 'issued', NEW.environment, now()
  );

  RETURN NEW;
END;
$$;

-- ─── 4. Emit ledger rows from affiliate commission events ────────────────────
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
BEGIN
  SELECT a.user_id, COALESCE(NEW.currency, a.currency, 'ZAR')
    INTO v_user, v_curr
  FROM public.affiliate_accounts a WHERE a.id = NEW.affiliate_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_name FROM public.products WHERE id = NEW.product_id;

  -- (a) A cleared accrual is real, payable commission → + earning row.
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
        v_user, NULL, 'commission', 'completed', NEW.commission_amount, v_curr, 'live',
        'affiliate',
        'Affiliate commission' || COALESCE(' · ' || v_name, ''),
        NEW.id, now());
    END IF;

  -- (b) A cleared accrual later reversed by a refund → − reversal row.
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
        v_user, NULL, 'commission', 'completed', -abs(NEW.commission_amount), v_curr, 'live',
        'affiliate',
        'Affiliate commission reversal' || COALESCE(' · ' || v_name, ''),
        NEW.id, now());
    END IF;

  -- (c) A clawback OFFSET row (partial / after-payout) → − reversal row.
  ELSIF TG_OP = 'INSERT' AND NEW.entry_type = 'clawback' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.platform_ledger WHERE affiliate_commission_id = NEW.id
    ) THEN
      INSERT INTO public.platform_ledger (
        user_id, host_id, type, status, amount, currency, environment,
        provider, reason, affiliate_commission_id, paid_at)
      VALUES (
        v_user, NULL, 'commission', 'completed', NEW.commission_amount, v_curr, 'live',
        'affiliate',
        'Affiliate commission reversal' || COALESCE(' · ' || v_name, ''),
        NEW.id, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_affiliate_commission_ledger ON public.affiliate_commissions;
CREATE TRIGGER trg_emit_affiliate_commission_ledger
  AFTER INSERT OR UPDATE OF status ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.emit_affiliate_commission_ledger();

-- ─── 5. Emit a payout row when a payout is marked paid ───────────────────────
CREATE OR REPLACE FUNCTION public.emit_affiliate_payout_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.affiliate_accounts WHERE id = NEW.affiliate_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.platform_ledger WHERE affiliate_payout_id = NEW.id
  ) THEN
    INSERT INTO public.platform_ledger (
      user_id, host_id, type, status, amount, currency, environment,
      provider, provider_reference, reason, affiliate_payout_id, paid_at)
    VALUES (
      v_user, NULL, 'payout', 'completed', -abs(NEW.net_amount),
      COALESCE(NEW.currency, 'ZAR'), 'live',
      COALESCE(NEW.provider, 'affiliate'), NEW.provider_reference,
      'Affiliate payout' || COALESCE(' · ' || NEW.method, ''),
      NEW.id, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_affiliate_payout_ledger ON public.affiliate_payouts;
CREATE TRIGGER trg_emit_affiliate_payout_ledger
  AFTER UPDATE OF status ON public.affiliate_payouts
  FOR EACH ROW EXECUTE FUNCTION public.emit_affiliate_payout_ledger();

COMMENT ON FUNCTION public.emit_affiliate_commission_ledger() IS
  'Mirrors real (cleared/reversed) affiliate commission onto platform_ledger (type=commission) on the affiliate''s user_id, minting a document. Provisional pending commission is not documented.';
COMMENT ON FUNCTION public.emit_affiliate_payout_ledger() IS
  'Mirrors a paid affiliate payout onto platform_ledger (type=payout) on the affiliate''s user_id, minting a remittance document.';
