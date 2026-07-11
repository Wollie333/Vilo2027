-- Fix a regression from 20260711110000/110001: the mint function called
-- next_wielo_credit_note_number(), but the deployed counter is actually
-- next_credit_note_number() (a later rename). Calling the wrong name made EVERY
-- non-charge ledger insert (refund/credit/adjustment/commission/payout) fail to
-- mint and roll back. This restores the correct counter for all types.

CREATE OR REPLACE FUNCTION mint_wielo_credit_note_on_ledger_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_biz       jsonb;
  v_buyer     jsonb;
  v_lines     jsonb;
  v_mag       numeric;
  v_subtotal  numeric;
  v_vat       numeric;
  v_has_vat   boolean;
  v_desc      text;
  v_affiliate boolean;
BEGIN
  IF NEW.status <> 'completed'
     OR NEW.type NOT IN ('refund','credit','adjustment','commission','payout') THEN
    RETURN NEW;
  END IF;
  IF NEW.amount IS NULL OR NEW.amount = 0 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.wielo_credit_notes WHERE ledger_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_affiliate := NEW.type IN ('commission','payout');
  v_mag := abs(NEW.amount);

  SELECT value INTO v_biz FROM public.platform_settings WHERE key = 'wielo_business';
  v_biz := COALESCE(v_biz, '{}'::jsonb);

  SELECT jsonb_build_object('name', full_name, 'email', email)
    INTO v_buyer FROM public.user_profiles WHERE id = NEW.user_id;
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

  INSERT INTO public.wielo_credit_notes (
    credit_note_number, kind, ledger_id, user_id,
    wielo_snapshot, buyer_snapshot, line_items,
    subtotal, vat_amount, total_amount, signed_amount, currency,
    reason, status, environment, issued_at
  ) VALUES (
    public.next_credit_note_number(), NEW.type, NEW.id, NEW.user_id,
    v_biz, v_buyer, v_lines,
    v_subtotal, v_vat, v_mag, NEW.amount, NEW.currency,
    NEW.reason, 'issued', NEW.environment, now()
  );

  RETURN NEW;
END;
$$;
