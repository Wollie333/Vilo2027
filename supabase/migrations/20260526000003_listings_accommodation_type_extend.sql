-- Migration: Extend listings.accommodation_type CHECK to cover the full
-- option set the host signup wizard offers.
--
-- Original constraint (from 20260501000002) allowed
--   hotel | guesthouse | bb | self_catering | lodge | other
-- but the wizard also offers `cottage` and `villa` (and never offered
-- `other`). Picking cottage/villa on signup would fail the listings INSERT
-- with a check violation. Pre-MVP table is empty so we widen the CHECK
-- additively — no data backfill needed.

ALTER TABLE public.listings
  DROP CONSTRAINT listings_accommodation_type_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_accommodation_type_check
  CHECK (accommodation_type IN (
    'hotel',
    'guesthouse',
    'bb',
    'self_catering',
    'lodge',
    'cottage',
    'villa',
    'other'
  ));
