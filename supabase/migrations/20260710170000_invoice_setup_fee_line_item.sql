-- Migration: show the setup fee as its own invoice line item.
--
-- The Wielo invoice mint (20260708140000) wrote a single line for the whole
-- charge. Now that a charge can bundle a once-off setup fee (20260710160000,
-- carried on platform_ledger.setup_fee_amount), split the invoice into two
-- lines when a setup fee is present: the recurring/product line + a dedicated
-- "Setup fee (once-off)" line. Purely a presentation change to line_items — the
-- invoice subtotal / VAT / total are unchanged. Line amounts stay VAT-inclusive
-- (gross), matching the existing single-line behaviour.

CREATE OR REPLACE FUNCTION mint_wielo_invoice_on_ledger_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_biz      jsonb;
  v_buyer    jsonb;
  v_lines    jsonb;
  v_subtotal numeric;
  v_vat      numeric;
  v_total    numeric;
  v_setup    numeric;
  v_recur    numeric;
  v_has_vat  boolean;
  v_desc     text;
  v_pname    text;
  v_order_id uuid;
  v_inv_id   uuid;
BEGIN
  IF NEW.status <> 'completed' OR NEW.type <> 'charge' THEN RETURN NEW; END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM wielo_invoices WHERE ledger_id = NEW.id) THEN RETURN NEW; END IF;

  SELECT value INTO v_biz FROM platform_settings WHERE key = 'wielo_business';
  v_biz := COALESCE(v_biz, '{}'::jsonb);

  SELECT jsonb_build_object('name', full_name, 'email', email)
    INTO v_buyer FROM user_profiles WHERE id = NEW.user_id;
  v_buyer := COALESCE(v_buyer, '{}'::jsonb);

  SELECT id, product_name INTO v_order_id, v_pname
    FROM product_orders WHERE provider_reference = NEW.provider_reference;
  v_desc := COALESCE(v_pname, NEW.reason, 'Wielo purchase');

  v_total   := NEW.amount;
  v_has_vat := NULLIF(btrim(v_biz->>'vat_number'), '') IS NOT NULL;
  IF v_has_vat THEN
    v_subtotal := round(v_total / 1.15, 2);
    v_vat      := round(v_total - v_subtotal, 2);
  ELSE
    v_subtotal := v_total;
    v_vat      := 0;
  END IF;

  -- Split off the setup-fee portion as its own line when present.
  v_setup := round(least(GREATEST(COALESCE(NEW.setup_fee_amount, 0), 0), v_total), 2);
  IF v_setup > 0 THEN
    v_recur := round(v_total - v_setup, 2);
    v_lines := jsonb_build_array(
      jsonb_build_object(
        'description', v_desc, 'quantity', 1,
        'unit_price', v_recur, 'subtotal', v_recur),
      jsonb_build_object(
        'description', 'Setup fee (once-off)', 'quantity', 1,
        'unit_price', v_setup, 'subtotal', v_setup)
    );
  ELSE
    v_lines := jsonb_build_array(jsonb_build_object(
      'description', v_desc, 'quantity', 1, 'unit_price', v_total, 'subtotal', v_total));
  END IF;

  INSERT INTO wielo_invoices (
    invoice_number, ledger_id, order_id, subscription_id, user_id,
    wielo_snapshot, buyer_snapshot, line_items,
    subtotal, vat_amount, total_amount, currency,
    status, environment, issued_at, paid_at
  ) VALUES (
    next_invoice_number(NULL), NEW.id, v_order_id, NEW.subscription_id, NEW.user_id,
    v_biz, v_buyer, v_lines,
    v_subtotal, v_vat, v_total, NEW.currency,
    'paid', NEW.environment, now(), COALESCE(NEW.paid_at, now())
  )
  RETURNING id INTO v_inv_id;

  UPDATE platform_ledger SET invoice_id = v_inv_id WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
