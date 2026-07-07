-- Migration: hands-off calendar sync — re-import every active iCal feed on a
-- schedule so hosts never have to click "Sync now".
--
-- The worker itself lives in apps/web at /api/ical-sync-worker (Next.js route
-- handler, Node runtime). pg_cron POSTs to it every 15 min with the bearer
-- secret. URL + secret come from two DB-level settings (mirrors the email
-- worker, migration 20260525000006):
--   app.ical_sync_worker_url    e.g. https://vilo2027.vercel.app/api/ical-sync-worker
--   app.ical_sync_worker_secret matches ICAL_SYNC_WORKER_SECRET in Vercel
--
-- Set them post-apply via the Supabase SQL Editor (one-time per env):
--   ALTER DATABASE postgres SET app.ical_sync_worker_url    = 'https://…/api/ical-sync-worker';
--   ALTER DATABASE postgres SET app.ical_sync_worker_secret = '…';
--
-- If either setting is missing the tick is a no-op (NOTICE logged) — so the job
-- stays inert in local dev / until prod is wired. The worker itself only re-syncs
-- feeds whose last sync is older than 3 hours, so a 15-min cron simply means new
-- and stale feeds are picked up within ~15 min without over-fetching any OTA.

CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('sync-ical-feeds')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-ical-feeds');

SELECT cron.schedule('sync-ical-feeds', '*/15 * * * *', $cron$
  DO $body$
  DECLARE
    v_url    text := current_setting('app.ical_sync_worker_url', true);
    v_secret text := current_setting('app.ical_sync_worker_secret', true);
    v_due    int;
  BEGIN
    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'sync-ical-feeds: app.ical_sync_worker_url / app.ical_sync_worker_secret unset — skipping tick';
      RETURN;
    END IF;

    -- Only wake the worker when at least one feed is actually due (matches the
    -- worker's own 3-hour min-interval). Keeps idle ticks free.
    SELECT COUNT(*) INTO v_due
    FROM public.ical_feeds
    WHERE status IN ('active', 'error')
      AND (last_sync_at IS NULL OR last_sync_at < now() - interval '3 hours');

    IF v_due = 0 THEN
      RETURN;
    END IF;

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_secret,
        'Content-Type',  'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  END;
  $body$;
$cron$);
