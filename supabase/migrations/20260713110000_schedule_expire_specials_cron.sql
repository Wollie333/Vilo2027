-- Migration: schedule expire_specials() daily
--
-- The specials foundation shipped expire_specials() (flips lapsed active deals
-- to 'expired') with the note "cron wired later" — but no schedule was ever
-- created. Consequences while unscheduled:
--   • lapsed deals keep status='active', so host reporting shows stale status;
--   • a fixed-date special's calendar hold (blocked_dates) is only released by
--     on_special_status_change, which never fires without a status change — so
--     expired fixed deals hold their dates forever.
-- Runtime queries already date-guard (booking + directory), so this only fixes
-- the persisted status + the calendar release, never live bookability.
--
-- Daily at 02:15 UTC (a quiet slot; deals lapse on a date boundary, so a daily
-- cadence is enough). cron.schedule upserts by name, so this is idempotent.

SELECT cron.schedule('expire-specials', '15 2 * * *', $$
  SELECT expire_specials();
$$);
