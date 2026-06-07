-- Migration: Per-listing VAT (host-controlled tax).
--
-- Each LISTING is responsible for its own VAT. A listing carries a VAT number
-- and a VAT rate (default 15% for South Africa, editable for any country). If a
-- listing has a VAT number, its bookings add VAT "at the end" — the ex-VAT
-- subtotal is grossed up by the rate, and the document becomes a TAX INVOICE.
-- No VAT number → no VAT, plain invoice.
--
-- ONE SOURCE OF TRUTH: the VAT math lives only in `effective_vat_rate()` +
-- the `apply_booking_vat` BEFORE INSERT trigger. Every booking-creation path
-- (manual, quote-convert, enquiry, and the guest booking flow) runs through
-- this trigger automatically, so no application code re-implements VAT.

-- ─── 1. Per-listing VAT settings ───────────────────────────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS vat_rate   numeric NOT NULL DEFAULT 15
    CHECK (vat_rate >= 0 AND vat_rate <= 100);

COMMENT ON COLUMN listings.vat_number IS
  'The listing''s VAT registration number. Set = this listing charges VAT (tax invoices); blank = no VAT (plain invoices).';
COMMENT ON COLUMN listings.vat_rate IS
  'VAT percentage applied when vat_number is set. Default 15 (South Africa); editable per listing for other countries.';

-- ─── 2. VAT recorded on each booking (so documents reconcile) ──────────
-- total_amount is stored VAT-INCLUSIVE; the ex-VAT subtotal is
-- (total_amount - vat_amount). vat_rate is the rate that was applied (frozen
-- per booking, so historical invoices stay correct if a listing's rate changes).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS vat_rate   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN bookings.vat_amount IS
  'VAT portion included in total_amount (0 if the listing is not VAT-registered). Ex-VAT subtotal = total_amount - vat_amount.';

-- ─── 3. The single source of truth for a listing''s effective VAT rate ──
CREATE OR REPLACE FUNCTION public.effective_vat_rate(p_listing_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN l.vat_number IS NOT NULL
            AND btrim(l.vat_number) <> ''
            AND COALESCE(l.vat_rate, 0) > 0
           THEN l.vat_rate
           ELSE 0
         END
  FROM listings l
  WHERE l.id = p_listing_id;
$$;

COMMENT ON FUNCTION public.effective_vat_rate(uuid) IS
  'The VAT rate a listing charges (0 if it has no VAT number). The one place VAT applicability is decided.';

-- ─── 4. Apply VAT to every new booking ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_booking_vat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric;
BEGIN
  -- Idempotent: if VAT was already computed upstream (a caller set it
  -- explicitly), leave it alone — never double-apply.
  IF COALESCE(NEW.vat_rate, 0) > 0 OR COALESCE(NEW.vat_amount, 0) > 0 THEN
    RETURN NEW;
  END IF;

  v_rate := public.effective_vat_rate(NEW.listing_id);

  IF v_rate > 0 AND COALESCE(NEW.total_amount, 0) > 0 THEN
    -- The incoming total_amount is the ex-VAT subtotal; gross it up.
    NEW.vat_rate   := v_rate;
    NEW.vat_amount := round(NEW.total_amount * v_rate / 100.0, 2);
    NEW.total_amount := round(NEW.total_amount + NEW.vat_amount, 2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_booking_vat ON bookings;
CREATE TRIGGER trg_apply_booking_vat
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.apply_booking_vat();
