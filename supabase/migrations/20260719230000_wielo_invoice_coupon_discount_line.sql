-- Itemize the PLATFORM-coupon discount on the Wielo invoice.
--
-- The mint set the product line's unit_price to NEW.amount — already NET of any
-- platform coupon (product_orders.discount_amount). So a host who redeemed e.g.
-- WELCOME50 saw "Starter Membership · R419" with no hint the list price was R599
-- or that R180 was taken off. The invoice footed (shown total = charged total)
-- but hid the discount — the platform analogue of the booking-invoice gap fixed
-- in 20260716130000.
--
-- Fix (mint only — renderers unchanged): show the product line at its GROSS
-- (pre-discount) price and append a negative "Discount (CODE)" line, so the
-- line_items still sum to the net total (= stored subtotal for a non-VAT issuer)
-- and the reduction + coupon code are visible. subtotal / vat_amount /
-- total_amount stay the net charged values. No discount → byte-identical output.

CREATE OR REPLACE FUNCTION mint_wielo_invoice_on_ledger_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_biz      jsonb;
  v_buyer    jsonb;
  v_lines    jsonb;
  v_subtotal numeric;
  v_vat      numeric;
  v_total    numeric;
  v_setup    numeric;
  v_recur    numeric;
  v_discount numeric;
  v_code     text;
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

  -- Order → product name + the platform-coupon discount and its code (if any).
  SELECT po.id, po.product_name, COALESCE(po.discount_amount, 0), pc.code
    INTO v_order_id, v_pname, v_discount, v_code
    FROM product_orders po
    LEFT JOIN platform_coupons pc ON pc.id = po.coupon_id
    WHERE po.provider_reference = NEW.provider_reference;
  v_discount := COALESCE(v_discount, 0);
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

  -- Product/recurring line shown at GROSS (net + discount); setup fee never
  -- discounted. Lines then sum to the net total, and a discount line makes the
  -- reduction explicit.
  v_setup := round(least(GREATEST(COALESCE(NEW.setup_fee_amount, 0), 0), v_total), 2);
  v_recur := round(v_total - v_setup + v_discount, 2);
  IF v_setup > 0 THEN
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
      'description', v_desc, 'quantity', 1, 'unit_price', v_recur, 'subtotal', v_recur));
  END IF;

  IF v_discount > 0 THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'description',
      'Discount'
        || CASE WHEN NULLIF(btrim(v_code), '') IS NOT NULL
                THEN ' (' || v_code || ')' ELSE '' END,
      'quantity', 1,
      'unit_price', -v_discount,
      'subtotal', -v_discount));
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
