-- C1 fix: a cancelled booking double-releases its special redemption + counters.
--
-- on_booking_cancelled() is wired to TWO identical triggers on bookings, both
-- `AFTER UPDATE OF status ... FOR EACH ROW`:
--   • trigger_booking_cancelled     (20260501000013_create_triggers)
--   • trigger_on_booking_cancelled  (20260601000010_booking_cancellation)  ← dup
-- So a single cancel runs the release logic TWICE — `specials.redemptions_used`
-- and `hosts/properties.total_bookings` each drop by 2 instead of 1 (masked only
-- when the counter is already at its GREATEST(0, …) floor). Proven live on
-- 2026-08-01: a special at 2 redemptions dropped to 0 on one cancel (should be 1).
--
-- The two triggers fire the same function on the same event — pure duplication.
-- Drop the later one; keep trigger_booking_cancelled. After this, the flow
-- harness's X2 probe (documented → check) passes: cancel drops redemptions by
-- exactly 1.

DROP TRIGGER IF EXISTS trigger_on_booking_cancelled ON public.bookings;
