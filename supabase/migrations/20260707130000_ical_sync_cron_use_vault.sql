-- Migration: move the ical-sync cron secrets from ALTER DATABASE settings into
-- Supabase Vault — same fix the email worker needed (migration 20260525000007).
--
-- Why: `ALTER DATABASE postgres SET app.ical_sync_worker_url = …` requires
-- superuser on managed Supabase (42501 permission denied), so the previous
-- migration (20260707120000) reading `current_setting('app.ical_sync_worker_*')`
-- could never be configured on the cloud instance — the cron would no-op forever.
-- Vault is the supported managed-instance pattern for secrets the DB reads.
--
-- Create the two secrets ONCE per environment (Dashboard → SQL Editor):
--
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/ical-sync-worker',
--     'ical_sync_worker_url',
--     'Public URL the sync-ical-feeds cron POSTs to'
--   );
--
--   SELECT vault.create_secret(
--     '<the 32-byte hex from ICAL_SYNC_WORKER_SECRET in Vercel>',
--     'ical_sync_worker_secret',
--     'Shared bearer the /api/ical-sync-worker route requires'
--   );
--
-- Rotate with `vault.update_secret(<id>, <new_value>)`. Missing secrets = cron
-- no-ops with a NOTICE (fail-soft, same as before). Only wakes the worker when a
-- feed is actually due (matches the worker's own 3-hour min-interval).

SELECT cron.unschedule('sync-ical-feeds')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-ical-feeds');

SELECT cron.schedule('sync-ical-feeds', '*/15 * * * *', $cron$
  DO $body$
  DECLARE
    v_url    text;
    v_secret text;
    v_due    int;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'ical_sync_worker_url'
    LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'ical_sync_worker_secret'
    LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'sync-ical-feeds: vault secrets ical_sync_worker_url / ical_sync_worker_secret unset — skipping tick';
      RETURN;
    END IF;

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
