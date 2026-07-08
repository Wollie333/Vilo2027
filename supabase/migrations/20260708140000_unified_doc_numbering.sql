-- Migration: one unified short document-numbering scheme across host + Wielo.
--
--   Invoice      INV-0001   (host booking invoices AND Wielo revenue invoices)
--   Receipt      RPT-0001   (was RCT-)
--   Refund       REF-0001   (was RF-)
--   Credit note  CN-0001    (was CR-;  Wielo credit + adjustment docs too)
--   Quote        Q-0001     (unchanged)
--   Booking      BK-0001    (unchanged)
--
-- Extends the 2026-06-29 short-numbering scheme (20260629160000) to (a) rename
-- receipt/refund/credit-note prefixes to the founder's standard and (b) put the
-- Wielo revenue documents (wielo_invoices + wielo_credit_notes) on the SAME
-- global per-type sequences as the host documents, so a number like INV-0018 is
-- globally unique and doubles as a payment reference regardless of which system
-- issued it. Replaces the Wielo-only WIELO-INV2026- / WIELO-CN2026- formats.
--
-- Pre-MVP: switch outright (only test financial documents exist). Existing test
-- rows are renumbered onto the shared sequences out-of-band after this migration.
--
-- DOWN: restore next_receipt_number→RCT / next_refund_number→RF /
--       next_credit_note_number→CR, and revert the two mint_wielo_* trigger
--       functions to call next_wielo_invoice_number()/next_wielo_credit_note_number().

-- ─── 1. Host generators — rename prefixes (signatures unchanged) ────────
CREATE OR REPLACE FUNCTION public.next_receipt_number(p_business_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'RPT-' || lpad(nextval('public.seq_receipt_number')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_refund_number(p_business_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'REF-' || lpad(nextval('public.seq_refund_number')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_credit_note_number(p_business_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'CN-' || lpad(nextval('public.seq_credit_note_number')::text, 4, '0');
$$;

-- ─── 2. Wielo invoice mint → shared INV- sequence ──────────────────────
CREATE OR REPLACE FUNCTION mint_wielo_invoice_on_ledger_complete()
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

  v_lines := jsonb_build_array(jsonb_build_object(
    'description', v_desc, 'quantity', 1, 'unit_price', v_total, 'subtotal', v_total));

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

-- ─── 3. Wielo credit-note mint → shared REF-/CN- sequences by kind ──────
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
  v_number   text;
BEGIN
  IF NEW.status <> 'completed' OR NEW.type NOT IN ('refund','credit','adjustment') THEN
    RETURN NEW;
  END IF;
  IF NEW.amount IS NULL OR NEW.amount = 0 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM wielo_credit_notes WHERE ledger_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_mag := abs(NEW.amount);

  SELECT value INTO v_biz FROM platform_settings WHERE key = 'wielo_business';
  v_biz := COALESCE(v_biz, '{}'::jsonb);

  SELECT jsonb_build_object('name', full_name, 'email', email)
    INTO v_buyer FROM user_profiles WHERE id = NEW.user_id;
  v_buyer := COALESCE(v_buyer, '{}'::jsonb);

  v_desc := COALESCE(NULLIF(btrim(NEW.reason), ''),
    CASE NEW.type
      WHEN 'refund' THEN 'Refund'
      WHEN 'credit' THEN 'Goodwill credit'
      ELSE 'Account adjustment'
    END);

  v_has_vat := NULLIF(btrim(v_biz->>'vat_number'), '') IS NOT NULL;
  IF v_has_vat THEN
    v_subtotal := round(v_mag / 1.15, 2);
    v_vat      := round(v_mag - v_subtotal, 2);
  ELSE
    v_subtotal := v_mag;
    v_vat      := 0;
  END IF;

  v_lines := jsonb_build_array(jsonb_build_object(
    'description', v_desc, 'quantity', 1, 'unit_price', v_mag, 'subtotal', v_mag));

  -- A refund gets a REF- number; a goodwill credit or a signed adjustment gets
  -- a CN- number (both are credit-note-style documents).
  IF NEW.type = 'refund' THEN
    v_number := next_refund_number(NULL);
  ELSE
    v_number := next_credit_note_number(NULL);
  END IF;

  INSERT INTO wielo_credit_notes (
    credit_note_number, kind, ledger_id, user_id,
    wielo_snapshot, buyer_snapshot, line_items,
    subtotal, vat_amount, total_amount, signed_amount, currency,
    reason, status, environment, issued_at
  ) VALUES (
    v_number, NEW.type, NEW.id, NEW.user_id,
    v_biz, v_buyer, v_lines,
    v_subtotal, v_vat, v_mag, NEW.amount, NEW.currency,
    NEW.reason, 'issued', NEW.environment, now()
  );

  RETURN NEW;
END;
$$;

-- ─── 4. Retire the Wielo-only number generators ────────────────────────
DROP FUNCTION IF EXISTS next_wielo_invoice_number();
DROP FUNCTION IF EXISTS next_wielo_credit_note_number();
