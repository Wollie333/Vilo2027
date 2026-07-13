-- Brand alignment: the first-party booking channel value 'vilo' → 'wielo'.
--
-- createBooking wrote channel='vilo' for a Wielo app / directory booking (the
-- legacy brand name). Rename the stored value + the CHECK so the source is
-- accurate and brand-aligned. 'website' (host's own Wielo site), 'direct'
-- (legacy default) and the OTA attribution values are unchanged.
--
-- Drop the constraint first so existing 'vilo' rows can be migrated, then re-add
-- it with 'wielo' in place of 'vilo'.

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_channel_check;

UPDATE public.bookings SET channel = 'wielo' WHERE channel = 'vilo';

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_channel_check
  CHECK (channel IN ('direct','wielo','website','airbnb','booking','expedia','other'));
