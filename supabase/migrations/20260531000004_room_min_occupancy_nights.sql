-- Migration: per-room minimum occupancy + minimum nights
-- Lets a host require a floor on guests and length-of-stay for a specific room
-- (e.g. "this room is min 2 guests, min 2 nights"). Defaults to 1/1 so existing
-- rooms are unchanged. Enforced at checkout + in the booking action.
--
-- Pre-MVP: additive, defaulted, safe on an empty DB.
--
-- DOWN: ALTER TABLE public.listing_rooms
--         DROP COLUMN min_guests, DROP COLUMN min_nights;

ALTER TABLE public.listing_rooms
  ADD COLUMN IF NOT EXISTS min_guests integer NOT NULL DEFAULT 1
    CHECK (min_guests >= 1),
  ADD COLUMN IF NOT EXISTS min_nights integer NOT NULL DEFAULT 1
    CHECK (min_nights >= 1);

COMMENT ON COLUMN public.listing_rooms.min_guests IS
  'Minimum guests required to book this room (defaults 1). Must be <= max_guests; enforced in the app.';
COMMENT ON COLUMN public.listing_rooms.min_nights IS
  'Minimum nights required to book this room (defaults 1). The booking enforces the max of the listing and selected rooms.';
