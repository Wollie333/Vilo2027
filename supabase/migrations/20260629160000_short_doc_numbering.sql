-- Migration: short, global document numbers.
--
--   Booking      BK-0001
--   Invoice      INV-0001
--   Quote        Q-0001
--   Credit note  CR-0001
--   Refund       RF-0001
--   Receipt      RCT-0001
--
-- Replaces the long per-business `{PREFIX}-{BIZ}-{ID5}-NNNNN` formats with a
-- short PREFIX-NNNN that is GLOBALLY UNIQUE (one sequence per document type), so
-- the number itself doubles as a payment reference. The existing global UNIQUE
-- constraints on these columns are naturally satisfied by the sequences.
--
-- The financial generators are DROP+CREATEd (not CREATE OR REPLACE) because the
-- live signatures use p_business_id and you cannot rename a parameter via
-- replace. The argument is now IGNORED (numbering is global) but the parameter
-- name is preserved so the by-name RPC callers
-- (next_quote_number / next_invoice_number / next_credit_note_number) keep
-- working unchanged. The trigger callers (refund + receipt + booking) call
-- positionally. Numbers are opaque strings in the app (display + ilike search),
-- so the shorter format is a drop-in.
--
-- Pre-MVP: switch outright (no live financial documents exist yet — DB was wiped
-- to a single super-admin). The old per-host/per-listing counter tables
-- (host_counters / listing_counters) are left in place but become vestigial.
--
-- NOTE (trade-off): numbering is now global, not per-host. A single host's
-- invoices may therefore have gaps (INV-0001, INV-0004, …). If strict per-host
-- sequential numbering is later required for VAT/accounting, revisit with a
-- per-host sequence + composite UNIQUE (host_id, number).

-- ─── 1. One global sequence per document type ─────────────────────
CREATE SEQUENCE IF NOT EXISTS public.seq_booking_number;
CREATE SEQUENCE IF NOT EXISTS public.seq_invoice_number;
CREATE SEQUENCE IF NOT EXISTS public.seq_quote_number;
CREATE SEQUENCE IF NOT EXISTS public.seq_credit_note_number;
CREATE SEQUENCE IF NOT EXISTS public.seq_refund_number;
CREATE SEQUENCE IF NOT EXISTS public.seq_receipt_number;

-- ─── 2. Financial generators (drop+create; arg kept for by-name RPCs) ──
DROP FUNCTION IF EXISTS public.next_quote_number(uuid);
CREATE FUNCTION public.next_quote_number(p_business_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'Q-' || lpad(nextval('public.seq_quote_number')::text, 4, '0');
$$;

DROP FUNCTION IF EXISTS public.next_invoice_number(uuid);
CREATE FUNCTION public.next_invoice_number(p_business_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'INV-' || lpad(nextval('public.seq_invoice_number')::text, 4, '0');
$$;

DROP FUNCTION IF EXISTS public.next_credit_note_number(uuid);
CREATE FUNCTION public.next_credit_note_number(p_business_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'CR-' || lpad(nextval('public.seq_credit_note_number')::text, 4, '0');
$$;

DROP FUNCTION IF EXISTS public.next_refund_number(uuid);
CREATE FUNCTION public.next_refund_number(p_business_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'RF-' || lpad(nextval('public.seq_refund_number')::text, 4, '0');
$$;

DROP FUNCTION IF EXISTS public.next_receipt_number(uuid);
CREATE FUNCTION public.next_receipt_number(p_business_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'RCT-' || lpad(nextval('public.seq_receipt_number')::text, 4, '0');
$$;

-- ─── 3. Booking reference — BK-0001 (global) ──────────────────────
-- (same signature → CREATE OR REPLACE; trigger already exists)
CREATE OR REPLACE FUNCTION public.gen_booking_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := 'BK-' || lpad(nextval('public.seq_booking_number')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- ─── 4. EFT payment reference = just the booking ref (drop VILO- prefix) ──
ALTER TABLE public.eft_banking_details
  ALTER COLUMN reference_format SET DEFAULT '{booking_ref}';

UPDATE public.eft_banking_details
  SET reference_format = '{booking_ref}'
  WHERE reference_format = 'VILO-{booking_ref}';
