-- Migration: Move email-worker cron secrets from ALTER DATABASE settings
-- into Supabase Vault.
--
-- Why: `ALTER DATABASE postgres SET app.email_worker_url = …` requires
-- superuser on managed Supabase (42501 permission denied). Vault is the
-- supported managed-instance pattern for secrets the database itself
-- needs to read.
--
-- Create the two secrets ONCE per environment (Dashboard → SQL Editor):
--
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/email-worker',
--     'email_worker_url',
--     'Public URL the drain-email-queue cron POSTs to'
--   );
--
--   SELECT vault.create_secret(
--     '<the 32-byte hex from EMAIL_WORKER_SECRET>',
--     'email_worker_secret',
--     'Shared bearer the /api/email-worker route requires'
--   );
--
-- Rotate by `vault.update_secret(<id>, <new_value>)`. Missing secrets =
-- cron no-ops with a NOTICE (same fail-soft as the previous version).

SELECT cron.unschedule('drain-email-queue')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-email-queue');

SELECT cron.schedule('drain-email-queue', '* * * * *', $cron$
  DO $body$
  DECLARE
    v_url    text;
    v_secret text;
    v_pending int;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'email_worker_url'
    LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'email_worker_secret'
    LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'drain-email-queue: vault secrets email_worker_url / email_worker_secret unset — skipping tick';
      RETURN;
    END IF;

    SELECT COUNT(*) INTO v_pending
    FROM public.notification_queue
    WHERE sent_at IS NULL AND failed_at IS NULL;

    IF v_pending = 0 THEN
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
