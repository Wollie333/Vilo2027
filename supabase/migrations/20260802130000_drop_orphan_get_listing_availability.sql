-- Orphan cleanup (wiring audit sweep 2): get_listing_availability(uuid,int,int)
-- has NO caller in the app, cron, edge functions, or any other DB function. It
-- returned a month's blocked dates from blocked_dates; every live path reads
-- blocked_dates directly instead (e.g. lib/bookings/createBooking.ts and the
-- booking calendar). It was left orphaned when a later migration renamed columns
-- around it — the exact "rename orphaned it" pattern this repo has been burned by.
-- A dead SECURITY DEFINER function is also a needless RLS-bypassing surface.
DROP FUNCTION IF EXISTS public.get_listing_availability(uuid, integer, integer);
