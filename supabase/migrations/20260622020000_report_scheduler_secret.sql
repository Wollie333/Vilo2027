-- Migration: Gate the report-scheduler edge function behind a shared secret.
--
-- The 'scheduled-reports-hourly' cron (20260605141536) authenticated only with
-- the PUBLIC anon key (Bearer app.settings.supabase_anon_key). The anon key
-- ships to every browser, so anyone could invoke report-scheduler — which runs
-- with the service-role key and processes every host's due reports. Not auth.
--
-- The function now requires an x-report-scheduler-secret header
-- (= REPORT_SCHEDULER_SECRET in the function's env, fail-closed). Reschedule the
-- cron to send it, read from a DB-level setting. Skip the tick if the secret is
-- unset so the job stays inert until configured (no wide-open invocations) —
-- same fail-safe pattern as the email-worker cron.
--
-- Set post-apply (one-time per env), then deploy the function:
--   ALTER DATABASE postgres SET app.report_scheduler_secret = '…';   -- matches the function env
--   supabase functions deploy report-scheduler
--   (function env) REPORT_SCHEDULER_SECRET = the same value

CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('scheduled-reports-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-reports-hourly');

SELECT cron.schedule('scheduled-reports-hourly', '0 * * * *', $cron$
  DO $body$
  DECLARE
    v_url    text := current_setting('app.settings.supabase_url', true);
    v_anon   text := current_setting('app.settings.supabase_anon_key', true);
    v_secret text := current_setting('app.report_scheduler_secret', true);
  BEGIN
    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'scheduled-reports-hourly: app.settings.supabase_url / app.report_scheduler_secret unset — skipping tick';
      RETURN;
    END IF;

    PERFORM net.http_post(
      url := v_url || '/functions/v1/report-scheduler',
      headers := jsonb_build_object(
        -- Bearer satisfies the platform's verify_jwt gate; the secret header is
        -- the real authentication the function checks.
        'Authorization',             'Bearer ' || COALESCE(v_anon, ''),
        'x-report-scheduler-secret', v_secret,
        'Content-Type',              'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  END;
  $body$;
$cron$);
