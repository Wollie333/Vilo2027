-- scheduled-reports-hourly has NEVER run. Port it to Vault.
--
-- THE BUG
--   The job read its config from `current_setting('app.settings.supabase_url')`,
--   `current_setting('app.settings.supabase_anon_key')` and
--   `current_setting('app.report_scheduler_secret')`. Setting those requires
--   `ALTER DATABASE ... SET`, which hosted Supabase refuses:
--
--     ERROR: 42501: permission denied to set parameter
--
--   So they were never set, the job's own guard hit `RAISE NOTICE ... skipping
--   tick` and returned, every hour, silently. It was written against a mechanism
--   this platform does not permit — it could never have worked here.
--
--   Every cron that DOES work reads from Vault (drain-email-queue, sync-ical-feeds,
--   broadcast-fanout, …). This makes the odd one out match them.
--
-- The three Vault secrets are created OUT OF BAND, deliberately: putting a secret
-- in a migration would commit it to git. They are `report_scheduler_url`,
-- `report_scheduler_secret` and `supabase_anon_key`. The job keeps its own guard,
-- so a missing secret still degrades to a skipped tick rather than an error.
--
-- Note the two different credentials: the Bearer only has to satisfy the platform's
-- verify_jwt gate (anon is enough, and is least-privilege), while
-- `x-report-scheduler-secret` is the real authentication the function checks.

SELECT cron.unschedule('scheduled-reports-hourly')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-reports-hourly');

SELECT cron.schedule(
  'scheduled-reports-hourly',
  '0 * * * *',
  $cron$
  DO $body$
  DECLARE
    v_url    text;
    v_anon   text;
    v_secret text;
  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'report_scheduler_url' LIMIT 1;

    SELECT decrypted_secret INTO v_anon
      FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'report_scheduler_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'scheduled-reports-hourly: report_scheduler_url / report_scheduler_secret missing from Vault — skipping tick';
      RETURN;
    END IF;

    PERFORM net.http_post(
      url := v_url,
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
  $cron$
);
