-- Migration: payment receipts. Every completed payment gets an auto-numbered,
-- tokenised receipt (proof of money received) the host can download and share —
-- distinct from invoices (which are the bills). Numbering mirrors invoices via a
-- per-host counter; a BEFORE trigger stamps the number the moment a payment
-- becomes 'completed', covering every path (manual EFT, credit applied, add-on,
-- future card webhooks).

ALTER TABLE public.host_counters
  ADD COLUMN IF NOT EXISTS last_receipt_number integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION next_receipt_number(p_host_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_handle text;
  v_next   integer;
BEGIN
  INSERT INTO host_counters (host_id, last_receipt_number)
  VALUES (p_host_id, 1)
  ON CONFLICT (host_id) DO UPDATE
    SET last_receipt_number = host_counters.last_receipt_number + 1,
        updated_at = now()
  RETURNING last_receipt_number INTO v_next;

  SELECT handle INTO v_handle FROM hosts WHERE id = p_host_id;
  v_handle := COALESCE(v_handle, 'HOST');

  RETURN upper(v_handle) || '-RCT' || to_char(now(), 'YYYY') || '-' ||
         lpad(v_next::text, 4, '0');
END;
$$;

COMMENT ON FUNCTION next_receipt_number IS
  'Returns the next per-host receipt number, formatted {handle}-RCTYYYY-NNNN. Bumps host_counters under row lock.';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS receipt_token  text UNIQUE DEFAULT gen_url_token();

COMMENT ON COLUMN public.payments.receipt_token IS
  'Random 22-char base64url token for the public /receipt/[token] page + PDF.';

-- Stamp the receipt number when a payment reaches 'completed' (idempotent — only
-- ever set once). BEFORE trigger so we mutate NEW in place without recursion.
CREATE OR REPLACE FUNCTION assign_receipt_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_host uuid;
BEGIN
  IF NEW.status = 'completed' AND NEW.receipt_number IS NULL THEN
    SELECT host_id INTO v_host FROM bookings WHERE id = NEW.booking_id;
    IF v_host IS NOT NULL THEN
      NEW.receipt_number := next_receipt_number(v_host);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_receipt_number
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION assign_receipt_number();

-- Backfill receipt numbers for already-completed payments (pre-MVP, low volume).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id, b.host_id
    FROM payments p JOIN bookings b ON b.id = p.booking_id
    WHERE p.status = 'completed' AND p.receipt_number IS NULL
    ORDER BY p.created_at
  LOOP
    UPDATE payments SET receipt_number = next_receipt_number(r.host_id)
    WHERE id = r.id;
  END LOOP;
END $$;
