-- Migration: per-business store credit
--
-- guest_credit_ledger held one (host, gkey) bucket — credit wasn't attributable
-- to a business. Add business_id so a per-business view can net the right
-- business's credit. The guest's HEADLINE balance still sums all businesses;
-- this only makes the filtered view accurate.
--
-- Every credit row carries a booking_id today, and the listing is the single
-- source of truth for a booking's business (booking_business_id()). So we
-- auto-attribute via a BEFORE INSERT trigger — the five app write-paths stay
-- unchanged — and backfill existing rows the same way. business_id stays
-- nullable for any future bookless manual credit (which may set it explicitly).

ALTER TABLE public.guest_credit_ledger
  ADD COLUMN business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guest_credit_host_business_gkey
  ON public.guest_credit_ledger(host_id, business_id, gkey);

-- Backfill from each row's booking → listing → business.
UPDATE public.guest_credit_ledger g
SET business_id = booking_business_id(g.booking_id)
WHERE g.business_id IS NULL AND g.booking_id IS NOT NULL;

-- Auto-attribute new rows to the booking's business (listing = SSOT), so the
-- existing inserts (overpayment auto-post, apply-credit, manual credit note,
-- credit-note void) need no change. Manual bookless credit may pre-set business_id.
CREATE OR REPLACE FUNCTION set_guest_credit_business()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.business_id IS NULL AND NEW.booking_id IS NOT NULL THEN
    NEW.business_id := booking_business_id(NEW.booking_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_guest_credit_business
  BEFORE INSERT ON public.guest_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION set_guest_credit_business();

COMMENT ON COLUMN public.guest_credit_ledger.business_id IS
  'The business this credit belongs to, auto-set from the booking''s listing on insert. Lets a per-business view net the right business''s credit; the headline guest balance still sums all businesses.';
