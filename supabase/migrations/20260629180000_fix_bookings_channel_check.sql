-- Fix: direct bookings could never be created ("Could not start your booking").
--
-- The booking insert (lib/bookings/createBooking.ts createBookingCore) writes
-- channel = 'vilo'  (a Wielo app / directory booking) or
-- channel = 'website' (a booking through the host's own Wielo site), but the
-- original analytics CHECK (migration 20260605135913) only permitted the OTA
-- attribution set — 'direct','airbnb','booking','expedia','other'. Every direct
-- booking therefore failed the constraint, the DB error was swallowed by
-- persistBookingAndPay, and the guest saw the generic failure.
--
-- Widen the CHECK to include the first-party channels the app actually writes.
-- Keeps the OTA values (iCal sync attribution) and 'direct' (legacy default).

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_channel_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_channel_check
  CHECK (channel IN ('direct','vilo','website','airbnb','booking','expedia','other'));
