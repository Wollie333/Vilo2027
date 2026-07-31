-- Migration: standard host-offer nurture cron.
--
-- Wires the host_offer_nudge (day 3) + host_offer_final (day 7) emails to a
-- scheduled worker. Stage 1 (host_offer_welcome) fires inline at host signup.
-- Same Vault-secret + soft-skip pattern as the other notification workers
-- (20260707150000_checkin_reminder_cron.sql): the cron pings the Next.js worker
-- daily, which finds free-tier hosts in the 3–30 day window and dispatches the
-- stage email (idempotent via notification_delivery_log).
--
-- One-time per env (Dashboard -> SQL Editor):
--
--   SELECT vault.create_secret(
--     'https://wielo.co.za/api/host-offer-worker',
--     'host_offer_worker_url', '');
--
-- Reuses the existing 'email_worker_secret' Vault entry as the bearer. Until the
-- URL secret is set the cron soft-skips (a no-op), so this migration is safe to
-- apply ahead of the Dashboard step.

SELECT cron.unschedule('drain-host-offers')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'drain-host-offers'
);

-- Daily at 07:00 UTC (~09:00 SA). Once a day is enough for a day-3/day-7 nudge;
-- the worker's delivery-log gate keeps it to one email per host per stage.
SELECT cron.schedule('drain-host-offers', '0 7 * * *', $cron$
  DO $body$
  DECLARE
    v_url    text;
    v_secret text;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'host_offer_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'drain-host-offers: vault host_offer_worker_url / email_worker_secret unset — skipping';
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
