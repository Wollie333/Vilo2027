-- Migration: schedule an hourly job to expire lapsed quotes
--
-- BUG THIS FIXES (leaked calendar holds):
--   When a host sends a quote, trigger_quote_status_change lays per-night
--   soft holds into blocked_dates (reason='quote_pending', owned by quote_id).
--   Those holds are ONLY released when the quote moves to a terminal status
--   ('declined' / 'converted' / 'expired'). But nothing ever set 'expired':
--   quote expiry was enforced lazily in app code (valid_until < now() at
--   read/accept time) while the persisted status stayed 'sent' forever.
--   Result: every quote a guest simply ignores holds those nights on the
--   host's calendar PERMANENTLY, silently eating availability.
--
--   Bookings already have expire-pending / expire-eft crons; specials got
--   expire-specials (20260713110000). Quotes had none. This adds the missing
--   one, mirroring looking_for_auto_expire.
--
-- WHAT IT DOES:
--   Hourly, flip any live 'sent' quote whose valid_until has passed to
--   'expired'. That single UPDATE fires trigger_quote_status_change, whose
--   terminal branch DELETEs the quote's blocked_dates rows — so the hold is
--   released the moment the quote lapses. previous_status is stamped so the
--   detail-page/timeline reads consistently with the other status writers.
--
-- Hourly (not daily): a lapsed quote should free the host's calendar promptly
-- so other guests can book those nights. cron.schedule upserts by name, so
-- this migration is idempotent.

SELECT cron.schedule(
  'expire-quotes',
  '5 * * * *',  -- hourly at minute 5 (offset from other jobs)
  $$
    UPDATE public.quotes
    SET previous_status = status,
        status          = 'expired',
        updated_at       = now()
    WHERE status = 'sent'
      AND valid_until IS NOT NULL
      AND valid_until < now()
      AND deleted_at IS NULL;
  $$
);
