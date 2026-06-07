-- Migration: give refunds a first-class document number (REF series), so every
-- financial document (invoice, quote, credit note, receipt, refund) carries a
-- unique per-host number associated with its booking. Mirrors the invoice /
-- receipt numbering; a BEFORE trigger stamps it on insert.

ALTER TABLE public.host_counters
  ADD COLUMN IF NOT EXISTS last_refund_number integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION next_refund_number(p_host_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_handle text;
  v_next   integer;
BEGIN
  INSERT INTO host_counters (host_id, last_refund_number)
  VALUES (p_host_id, 1)
  ON CONFLICT (host_id) DO UPDATE
    SET last_refund_number = host_counters.last_refund_number + 1,
        updated_at = now()
  RETURNING last_refund_number INTO v_next;

  SELECT handle INTO v_handle FROM hosts WHERE id = p_host_id;
  v_handle := COALESCE(v_handle, 'HOST');

  RETURN upper(v_handle) || '-REF' || to_char(now(), 'YYYY') || '-' ||
         lpad(v_next::text, 4, '0');
END;
$$;

COMMENT ON FUNCTION next_refund_number IS
  'Returns the next per-host refund number, formatted {handle}-REFYYYY-NNNN. Bumps host_counters under row lock.';

ALTER TABLE public.refund_requests
  ADD COLUMN IF NOT EXISTS refund_number text;

CREATE OR REPLACE FUNCTION assign_refund_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.refund_number IS NULL AND NEW.host_id IS NOT NULL THEN
    NEW.refund_number := next_refund_number(NEW.host_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_refund_number
  BEFORE INSERT ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION assign_refund_number();

-- Backfill existing refund requests (pre-MVP, low volume).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, host_id FROM refund_requests
    WHERE refund_number IS NULL AND host_id IS NOT NULL
    ORDER BY created_at
  LOOP
    UPDATE refund_requests SET refund_number = next_refund_number(r.host_id)
    WHERE id = r.id;
  END LOOP;
END $$;
