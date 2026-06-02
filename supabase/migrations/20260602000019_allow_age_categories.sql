-- Migration: per-room (and per-listing) toggles for children / infants / pets.
--
-- A host can switch each category ON or OFF. OFF means guests can't book that
-- category at all — the stepper is disabled on checkout/quotes and the price
-- input is hidden in room settings. ON lets the host set its flat per-night
-- rate (migration 20260602000012). Default ON so existing rooms are unchanged.

ALTER TABLE public.listing_rooms
  ADD COLUMN IF NOT EXISTS allow_children boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_infants  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_pets     boolean NOT NULL DEFAULT true;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS allow_children boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_infants  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_pets     boolean NOT NULL DEFAULT true;
