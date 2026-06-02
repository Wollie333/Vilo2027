-- Migration: age-band thresholds for age-based pricing.
--
-- The flat per-night rates (child_price / infant_price) need bands that define
-- WHO is an infant vs child vs adult, the hotel/Booking.com standard:
--   infant: 0 .. infant_max_age          (charged infant_price, usually free)
--   child:  infant_max_age+1 .. child_max_age  (charged child_price)
--   adult:  child_max_age+1 and up        (charged the room/occupancy rate)
-- Defaults: infants 0–2, children 3–12. Set per room (and per listing for
-- whole-listing stays). Surfaced as hints on the guest party selector.

ALTER TABLE public.listing_rooms
  ADD COLUMN IF NOT EXISTS infant_max_age integer NOT NULL DEFAULT 2
    CHECK (infant_max_age >= 0 AND infant_max_age <= 17),
  ADD COLUMN IF NOT EXISTS child_max_age  integer NOT NULL DEFAULT 12
    CHECK (child_max_age >= 0 AND child_max_age <= 17);

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS infant_max_age integer NOT NULL DEFAULT 2
    CHECK (infant_max_age >= 0 AND infant_max_age <= 17),
  ADD COLUMN IF NOT EXISTS child_max_age  integer NOT NULL DEFAULT 12
    CHECK (child_max_age >= 0 AND child_max_age <= 17);

-- child_max_age must not sit below infant_max_age (bands can't cross).
ALTER TABLE public.listing_rooms
  ADD CONSTRAINT listing_rooms_age_band_order
  CHECK (child_max_age >= infant_max_age);
ALTER TABLE public.listings
  ADD CONSTRAINT listings_age_band_order
  CHECK (child_max_age >= infant_max_age);
