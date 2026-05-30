-- Migration: optional per-guest party manifest on a booking
--
-- Lets the booker optionally capture name + contact for each member of the
-- party (e.g. 23 guests → up to 23 named entries). Stored as a jsonb array of
-- { name, email?, phone? } and snapshotted at checkout. Entirely optional —
-- defaults to an empty array.
-- Pre-MVP: additive, defaulted, safe on an empty DB.
--
-- DOWN: ALTER TABLE public.bookings DROP COLUMN additional_guests;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS additional_guests jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.bookings.additional_guests IS
  'Optional party manifest: array of {name, email?, phone?} for guests beyond the lead booker. Snapshotted at checkout.';
