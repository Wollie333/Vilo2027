-- Fix: allow source='special' on blocked_dates.
--
-- The block_special_dates RPC (migration 20260619250000_special_date_blocking)
-- inserts blocked_dates rows with reason='special' AND source='special' to hold
-- the calendar for an active fixed-date special. But blocked_dates_source_check
-- (migration 20260525000005_ical_feeds) only ever allowed
-- ('manual','booking','ical','quote_hold') — 'special' was never added.
--
-- Result: every activation of a fixed-date special threw a check_violation
-- (23514) inside the RPC, which the app's blockSpecialDates() helper swallowed
-- (it ignores the RPC result), so fixed-date specials silently failed to block
-- their dates on the host calendar. This adds 'special' to the allowed set.

ALTER TABLE blocked_dates DROP CONSTRAINT IF EXISTS blocked_dates_source_check;
ALTER TABLE blocked_dates
  ADD CONSTRAINT blocked_dates_source_check
  CHECK (source IN ('manual', 'booking', 'ical', 'quote_hold', 'special'));
