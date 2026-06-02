-- Migration: per-room (and per-listing) age-based + pet pricing.
--
-- Hosts set flat per-night amounts in room settings: a child rate, an infant
-- rate (free by default), and a pet fee. These layer ON TOP of the existing
-- accommodation pricing as line items (children × rate × nights, etc.) — the
-- core priceStay engine is untouched. Listing-level fields cover whole-listing
-- bookings; room-level fields apply to per-room bookings.
--
-- Party counts live in guests_breakdown {adults, children, infants, pets} on
-- bookings (already present) and now quotes.

ALTER TABLE public.listing_rooms
  ADD COLUMN IF NOT EXISTS child_price  numeric NOT NULL DEFAULT 0 CHECK (child_price  >= 0),
  ADD COLUMN IF NOT EXISTS infant_price numeric NOT NULL DEFAULT 0 CHECK (infant_price >= 0),
  ADD COLUMN IF NOT EXISTS pet_fee      numeric NOT NULL DEFAULT 0 CHECK (pet_fee      >= 0);

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS child_price  numeric NOT NULL DEFAULT 0 CHECK (child_price  >= 0),
  ADD COLUMN IF NOT EXISTS infant_price numeric NOT NULL DEFAULT 0 CHECK (infant_price >= 0),
  ADD COLUMN IF NOT EXISTS pet_fee      numeric NOT NULL DEFAULT 0 CHECK (pet_fee      >= 0);

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS guests_breakdown jsonb;

COMMENT ON COLUMN public.listing_rooms.child_price IS
  'Flat per-child, per-night charge added as a quote/booking line. 0 = no child charge.';
COMMENT ON COLUMN public.listing_rooms.pet_fee IS
  'Flat per-night pet fee, applied once per booking when pets > 0.';
