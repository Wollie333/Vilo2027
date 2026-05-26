-- Migration: Notification system cron jobs.
--
-- Three workers follow the email-worker pattern from
-- 20260525000007_email_worker_use_vault.sql (Vault secrets, soft-skip on
-- missing config, 55s timeout). A fourth job runs entirely in-DB.
--
-- One-time per env (Dashboard → SQL Editor):
--
--   SELECT vault.create_secret('https://vilo2027.vercel.app/api/push-worker',
--     'push_worker_url', '');
--   SELECT vault.create_secret('https://vilo2027.vercel.app/api/digest-worker',
--     'digest_worker_url', '');
--   SELECT vault.create_secret('https://vilo2027.vercel.app/api/broadcast-fanout-worker',
--     'broadcast_worker_url', '');
--
-- All three share the existing 'email_worker_secret' Vault entry as the
-- bearer (one secret, three workers — simpler ops).

-- ─── drain-push-queue (every minute) ──────────────────────────────────────

SELECT cron.unschedule('drain-push-queue')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-push-queue');

SELECT cron.schedule('drain-push-queue', '* * * * *', $cron$
  DO $body$
  DECLARE
    v_url     text;
    v_secret  text;
    v_pending int;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'push_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'drain-push-queue: vault push_worker_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    SELECT COUNT(*) INTO v_pending
    FROM public.pending_push_queue
    WHERE sent_at IS NULL
      AND failed_at IS NULL
      AND release_at <= now();

    IF v_pending = 0 THEN RETURN; END IF;

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

-- ─── drain-digest-queue (hourly at :05) ──────────────────────────────────
-- Worker filters by per-user digest_send_hour vs current local hour.

SELECT cron.unschedule('drain-digest-queue')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-digest-queue');

SELECT cron.schedule('drain-digest-queue', '5 * * * *', $cron$
  DO $body$
  DECLARE
    v_url    text;
    v_secret text;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'digest_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'drain-digest-queue: vault digest_worker_url / email_worker_secret unset — skipping';
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

-- ─── broadcast-fanout (every minute) ─────────────────────────────────────
-- Fires only when at least one critical broadcast needs email fan-out.
-- Idempotent via broadcast_announcements.email_fanout_completed_at.

SELECT cron.unschedule('broadcast-fanout')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'broadcast-fanout');

SELECT cron.schedule('broadcast-fanout', '* * * * *', $cron$
  DO $body$
  DECLARE
    v_url     text;
    v_secret  text;
    v_pending int;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'broadcast_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'broadcast-fanout: vault broadcast_worker_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    SELECT COUNT(*) INTO v_pending
    FROM public.broadcast_announcements
    WHERE severity = 'critical'
      AND email_fanout_completed_at IS NULL
      AND cancelled_at IS NULL
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at > now());

    IF v_pending = 0 THEN RETURN; END IF;

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

-- ─── deactivate-expired-broadcasts (hourly at :15, pure SQL) ─────────────

SELECT cron.unschedule('deactivate-expired-broadcasts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deactivate-expired-broadcasts');

SELECT cron.schedule('deactivate-expired-broadcasts', '15 * * * *', $cron$
  UPDATE public.broadcast_announcements
     SET cancelled_at = ends_at
   WHERE cancelled_at IS NULL
     AND ends_at IS NOT NULL
     AND ends_at < now();
$cron$);
