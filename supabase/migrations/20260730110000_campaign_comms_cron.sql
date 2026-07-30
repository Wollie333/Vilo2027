-- Migration: campaign comms cron (P2b — SoT §10.7).
--
-- Wires the three clock-/state-driven competition emails (milestone_hit,
-- standings digest, ending-soon) to a scheduled worker, following the same
-- Vault-secret + soft-skip pattern as drain-checkin-reminders. The cron pings
-- the Next.js /api/campaign-comms-worker once daily; the worker sweeps every
-- ACTIVE competition and dispatches each due message through the notification
-- override layer (idempotent via notification_delivery_log dedupe keys).
--
-- Daily (not hourly): the digest cadence and ending-soon window are day-grained,
-- and milestone detection reads the nightly daily-score history — so a single
-- morning run after that snapshot is the right cadence. The per-user + global
-- dedupe keys make a re-run within the same day a no-op.
--
-- One-time per env (Dashboard -> SQL Editor):
--
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/campaign-comms-worker',
--     'campaign_comms_worker_url', '');
--
-- Reuses the existing 'email_worker_secret' Vault entry as the bearer.

SELECT cron.unschedule('drain-campaign-comms')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'drain-campaign-comms'
);

-- Daily at 06:20 (SA morning). Runs after snapshot-campaign-scores (01:15) so the
-- milestone winner is picked from a fresh daily-score history.
SELECT cron.schedule('drain-campaign-comms', '20 4 * * *', $cron$
  DO $body$
  DECLARE
    v_url    text;
    v_secret text;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'campaign_comms_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'drain-campaign-comms: vault campaign_comms_worker_url / email_worker_secret unset — skipping';
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
