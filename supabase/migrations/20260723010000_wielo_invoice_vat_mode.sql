-- Wielo invoice VAT: honour the configurable mode + rate from wielo_business.
--
-- Until now this trigger assumed VAT-INCLUSIVE pricing at a hardcoded 15%: it
-- backed 15% out of the charged total (R99 → R86.09 + R12.91). The admin can now
-- choose VAT-EXCLUSIVE (VAT added on top, R99 → R99 + R14.85 = R113.85) and set
-- the rate, in platform_settings.wielo_business (vat_mode, vat_rate).
--
-- The charge itself is grossed up at checkout / renewal (applyWieloVatToCharge in
-- lib/billing/wielo-invoice.ts), so NEW.amount is ALWAYS the gross the customer
-- paid, in both modes. This function therefore still backs VAT out of that gross
-- total — only two things change:
--   1. the rate is read from settings (fallback 15) instead of hardcoded 1.15;
--   2. in exclusive mode the line items are shown at NET (they sum to the
--      subtotal, with VAT added), because the list price the buyer agreed to was
--      the net figure. Inclusive mode is byte-for-byte unchanged.
--
-- No VAT number → not registered → subtotal = total, VAT = 0 (unchanged).

CREATE OR REPLACE FUNCTION public.mint_wielo_invoice_on_ledger_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_biz        jsonb;
  v_buyer      jsonb;
  v_lines      jsonb;
  v_subtotal   numeric;
  v_vat        numeric;
  v_total      numeric;
  v_line_total numeric;
  v_setup      numeric;
  v_recur      numeric;
  v_discount   numeric;
  v_code       text;
  v_has_vat    boolean;
  v_mode       text;
  v_rate       numeric;
  v_factor     numeric;
  v_desc       text;
  v_pname      text;
  v_order_id   uuid;
  v_inv_id     uuid;
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

  -- Mode + rate from settings. Rate falls back to 15 (SA standard) so a blank
  -- never silently means 0% VAT for a registered seller.
  v_mode := lower(COALESCE(NULLIF(btrim(v_biz->>'vat_mode'), ''), 'inclusive'));
  v_rate := COALESCE(NULLIF(btrim(v_biz->>'vat_rate'), '')::numeric, 15);
  IF v_rate < 0 OR v_rate > 100 THEN v_rate := 15; END IF;
  v_factor := 1 + v_rate / 100.0;

  IF v_has_vat AND v_factor > 1 THEN
    -- The charge is already gross in both modes, so back VAT out of the total.
    v_subtotal := round(v_total / v_factor, 2);
    v_vat      := round(v_total - v_subtotal, 2);
  ELSE
    v_subtotal := v_total;
    v_vat      := 0;
  END IF;

  -- Line-item base. Inclusive (and no-VAT): lines are GROSS and sum to the total.
  -- Exclusive: lines are NET and sum to the subtotal, with VAT added on top — the
  -- list price the buyer agreed to was the net figure, so that is what shows.
  IF v_has_vat AND v_mode = 'exclusive' THEN
    v_line_total := v_subtotal;
  ELSE
    v_line_total := v_total;
  END IF;

  v_setup := round(least(GREATEST(COALESCE(NEW.setup_fee_amount, 0), 0), v_line_total), 2);
  v_recur := round(v_line_total - v_setup + v_discount, 2);
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
$function$;
