-- Migration: standardised document numbering.
--
--   Quote        Q-{BIZ}-{ID5}-000001    (6 digits)   per business
--   Invoice      INV-{BIZ}-{ID5}-00001   (5 digits)   per business
--   Credit note  CR-{BIZ}-{ID5}-00001    (5 digits)   per business
--   Refund       RF-{BIZ}-{ID5}-00001    (5 digits)   per business
--   Booking      BK-{LISTING}-{ID5}-0001 (4 digits)   per listing
--
-- {BIZ}     = uppercased business/trading name (cap 14), fallback handle.
-- {LISTING} = uppercased listing name (cap 14).
-- {ID5}     = first 5 hex chars of the host id (financial) or listing id
--             (bookings) — a tiny stable suffix so two same-named businesses /
--             listings can never collide on the global UNIQUE columns.
--
-- Financial documents share ONE running sequence per business (host_counters);
-- bookings count per listing (listing_counters). Pre-MVP: switch outright.

-- ─── 1. Counters ──────────────────────────────────────────────────
ALTER TABLE public.host_counters
  ADD COLUMN IF NOT EXISTS last_refund_number integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.listing_counters (
  listing_id          uuid PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  last_booking_number integer NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.listing_counters ENABLE ROW LEVEL SECURITY;

-- ─── 2. Identifier helpers ────────────────────────────────────────
CREATE OR REPLACE FUNCTION host_doc_code(p_host_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
           NULLIF(left(regexp_replace(upper(
             COALESCE(bd.trading_name, bd.legal_name, h.display_name, h.handle, 'BIZ')
           ), '[^A-Z0-9]', '', 'g'), 14), ''),
           'BIZ'
         ) || '-' || upper(left(replace(p_host_id::text, '-', ''), 5))
  FROM hosts h
  LEFT JOIN host_business_details bd ON bd.host_id = h.id
  WHERE h.id = p_host_id;
$$;

CREATE OR REPLACE FUNCTION listing_doc_code(p_listing_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
           NULLIF(left(regexp_replace(upper(name), '[^A-Z0-9]', '', 'g'), 14), ''),
           'LISTING'
         ) || '-' || upper(left(replace(p_listing_id::text, '-', ''), 5))
  FROM listings WHERE id = p_listing_id;
$$;

-- ─── 3. Financial generators (per business, unchanged signatures) ──
CREATE OR REPLACE FUNCTION next_quote_number(p_host_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next integer;
BEGIN
  INSERT INTO host_counters (host_id, last_quote_number)
  VALUES (p_host_id, 1)
  ON CONFLICT (host_id) DO UPDATE
    SET last_quote_number = host_counters.last_quote_number + 1, updated_at = now()
  RETURNING last_quote_number INTO v_next;
  RETURN 'Q-' || host_doc_code(p_host_id) || '-' || lpad(v_next::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_invoice_number(p_host_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next integer;
BEGIN
  INSERT INTO host_counters (host_id, last_invoice_number)
  VALUES (p_host_id, 1)
  ON CONFLICT (host_id) DO UPDATE
    SET last_invoice_number = host_counters.last_invoice_number + 1, updated_at = now()
  RETURNING last_invoice_number INTO v_next;
  RETURN 'INV-' || host_doc_code(p_host_id) || '-' || lpad(v_next::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_credit_note_number(p_host_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next integer;
BEGIN
  INSERT INTO host_counters (host_id, last_credit_note_number)
  VALUES (p_host_id, 1)
  ON CONFLICT (host_id) DO UPDATE
    SET last_credit_note_number = host_counters.last_credit_note_number + 1, updated_at = now()
  RETURNING last_credit_note_number INTO v_next;
  RETURN 'CR-' || host_doc_code(p_host_id) || '-' || lpad(v_next::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_refund_number(p_host_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next integer;
BEGIN
  INSERT INTO host_counters (host_id, last_refund_number)
  VALUES (p_host_id, 1)
  ON CONFLICT (host_id) DO UPDATE
    SET last_refund_number = host_counters.last_refund_number + 1, updated_at = now()
  RETURNING last_refund_number INTO v_next;
  RETURN 'RF-' || host_doc_code(p_host_id) || '-' || lpad(v_next::text, 5, '0');
END;
$$;

-- ─── 4. Refund reference ──────────────────────────────────────────
ALTER TABLE public.refund_requests
  ADD COLUMN IF NOT EXISTS reference text;

CREATE OR REPLACE FUNCTION gen_refund_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := next_refund_number(NEW.host_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_gen_refund_reference ON public.refund_requests;
CREATE TRIGGER trigger_gen_refund_reference
  BEFORE INSERT ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION gen_refund_reference();

-- ─── 5. Booking reference — BK-{LISTING}-{ID5}-0001 per listing ───
ALTER TABLE public.bookings ALTER COLUMN reference DROP DEFAULT;

CREATE OR REPLACE FUNCTION gen_booking_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next integer;
BEGIN
  IF NEW.reference IS NULL THEN
    INSERT INTO listing_counters (listing_id, last_booking_number)
    VALUES (NEW.listing_id, 1)
    ON CONFLICT (listing_id) DO UPDATE
      SET last_booking_number = listing_counters.last_booking_number + 1,
          updated_at = now()
    RETURNING last_booking_number INTO v_next;
    NEW.reference := 'BK-' || listing_doc_code(NEW.listing_id) || '-' ||
                     lpad(v_next::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_gen_booking_reference ON public.bookings;
CREATE TRIGGER trigger_gen_booking_reference
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION gen_booking_reference();
