-- Migration: auto-mint a Vilo invoice when a platform_ledger charge completes
--
-- Single source of truth for Vilo invoicing: fires for EVERY completed inbound
-- charge regardless of how it settled (client confirm-on-return, the webhook
-- backstop, a subscription renewal, or a manual admin charge). Mirrors the host
-- on_booking_confirmed_create_invoice trigger. Vilo issuer details are frozen
-- from the `vilo_business` platform_settings key at issue time.

CREATE OR REPLACE FUNCTION mint_vilo_invoice_on_ledger_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_biz      jsonb;
  v_buyer    jsonb;
  v_lines    jsonb;
  v_subtotal numeric;
  v_vat      numeric;
  v_total    numeric;
  v_has_vat  boolean;
  v_desc     text;
  v_pname    text;
  v_order_id uuid;
  v_inv_id   uuid;
BEGIN
  -- Only completed inbound charges, once per ledger row. Skip zero/free.
  IF NEW.status <> 'completed' OR NEW.type <> 'charge' THEN RETURN NEW; END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM vilo_invoices WHERE ledger_id = NEW.id) THEN RETURN NEW; END IF;

  -- Vilo issuer details (single jsonb settings key, '{}' when unset).
  SELECT value INTO v_biz FROM platform_settings WHERE key = 'vilo_business';
  v_biz := COALESCE(v_biz, '{}'::jsonb);

  -- Buyer snapshot.
  SELECT jsonb_build_object('name', full_name, 'email', email)
    INTO v_buyer FROM user_profiles WHERE id = NEW.user_id;
  v_buyer := COALESCE(v_buyer, '{}'::jsonb);

  -- Description: the product name if we can resolve the order, else the reason.
  SELECT id, product_name INTO v_order_id, v_pname
    FROM product_orders WHERE provider_reference = NEW.provider_reference;
  v_desc := COALESCE(v_pname, NEW.reason, 'Vilo purchase');

  -- VAT is split out of the (inclusive) total only when Vilo is VAT-registered.
  v_total   := NEW.amount;
  v_has_vat := NULLIF(btrim(v_biz->>'vat_number'), '') IS NOT NULL;
  IF v_has_vat THEN
    v_subtotal := round(v_total / 1.15, 2);
    v_vat      := round(v_total - v_subtotal, 2);
  ELSE
    v_subtotal := v_total;
    v_vat      := 0;
  END IF;

  v_lines := jsonb_build_array(jsonb_build_object(
    'description', v_desc, 'quantity', 1, 'unit_price', v_total, 'subtotal', v_total));

  INSERT INTO vilo_invoices (
    invoice_number, ledger_id, order_id, subscription_id, user_id,
    vilo_snapshot, buyer_snapshot, line_items,
    subtotal, vat_amount, total_amount, currency,
    status, environment, issued_at, paid_at
  ) VALUES (
    next_vilo_invoice_number(), NEW.id, v_order_id, NEW.subscription_id, NEW.user_id,
    v_biz, v_buyer, v_lines,
    v_subtotal, v_vat, v_total, NEW.currency,
    'paid', NEW.environment, now(), COALESCE(NEW.paid_at, now())
  )
  RETURNING id INTO v_inv_id;

  -- Link the ledger row to its invoice (UPDATE OF invoice_id won't re-fire).
  UPDATE platform_ledger SET invoice_id = v_inv_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Fire on insert of an already-completed row OR when status flips to completed.
-- Scoped to status so the invoice_id link-back UPDATE above does not re-trigger.
CREATE TRIGGER trg_mint_vilo_invoice
  AFTER INSERT OR UPDATE OF status ON public.platform_ledger
  FOR EACH ROW EXECUTE FUNCTION mint_vilo_invoice_on_ledger_complete();
