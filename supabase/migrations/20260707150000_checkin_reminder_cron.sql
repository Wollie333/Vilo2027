-- Migration: check-in reminder cron.
--
-- Wires the `check_in_reminder_host` notification (defined + seeded in the
-- notification registry, but never dispatched) to a scheduled worker. Follows
-- the same Vault-secret + soft-skip pattern as the notification-system workers
-- (20260525000013_notification_system_cron.sql): the cron pings the Next.js
-- worker hourly, which finds every CONFIRMED booking checking in tomorrow and
-- dispatches the host a "guest arriving tomorrow" push + in-app alert
-- (idempotent via notification_delivery_log).
--
-- One-time per env (Dashboard -> SQL Editor):
--
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/checkin-reminder-worker',
--     'checkin_reminder_worker_url', '');
--
-- Reuses the existing 'email_worker_secret' Vault entry as the bearer.

SELECT cron.unschedule('drain-checkin-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'drain-checkin-reminders'
);

-- Hourly at :10. Hourly (not daily) so the reminder still lands even if the
-- worker/host is briefly unavailable, and the worker's dedupe gate keeps it to
-- one alert per booking.
SELECT cron.schedule('drain-checkin-reminders', '10 * * * *', $cron$
  DO $body$
  DECLARE
    v_url    text;
    v_secret text;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'checkin_reminder_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'drain-checkin-reminders: vault checkin_reminder_worker_url / email_worker_secret unset — skipping';
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
