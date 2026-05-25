-- Migration: Email worker cron — drain notification_queue every minute.
--
-- The worker itself lives in apps/web at /api/email-worker (Next.js
-- route handler, Node runtime). pg_cron POSTs to it with the bearer
-- secret stored in two DB-level settings:
--   app.email_worker_url    e.g. https://vilo2027.vercel.app/api/email-worker
--   app.email_worker_secret matches EMAIL_WORKER_SECRET in Vercel
--
-- Set them post-apply via the Supabase SQL Editor (one-time per env):
--   ALTER DATABASE postgres SET app.email_worker_url = 'https://…';
--   ALTER DATABASE postgres SET app.email_worker_secret = '…';
--
-- If either setting is missing the cron tick is a no-op (NOTICE
-- logged). Local dev: leave both unset and the job stays inert.
--
-- The decision to use a Next.js route instead of a Deno Edge Function
-- is documented in DECISIONS.md (2026-05-25 entry).

CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('drain-email-queue')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-email-queue');

SELECT cron.schedule('drain-email-queue', '* * * * *', $cron$
  DO $body$
  DECLARE
    v_url    text := current_setting('app.email_worker_url', true);
    v_secret text := current_setting('app.email_worker_secret', true);
    v_pending int;
  BEGIN
    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'drain-email-queue: app.email_worker_url / app.email_worker_secret unset — skipping tick';
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
