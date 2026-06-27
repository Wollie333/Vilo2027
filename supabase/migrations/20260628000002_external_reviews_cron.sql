-- Migration: External Reviews Daily Sync Cron Job
-- Schedules a daily sync of all active external review sources at 03:00 UTC (05:00 SAST).
-- The cron job calls a worker endpoint that triggers the external-reviews-sync Edge Function.

-- Note: The worker URL and secret must be stored in the Supabase vault:
--   - external_reviews_worker_url: The URL of the Next.js worker endpoint
--   - external_reviews_worker_secret: The bearer token for authentication

SELECT cron.schedule('sync-external-reviews', '0 3 * * *', $cron$
  DO $body$
  DECLARE
    v_url     text;
    v_secret  text;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'external_reviews_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'external_reviews_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_secret IS NULL THEN
      RAISE NOTICE 'sync-external-reviews: vault secrets unset — skipping';
      RETURN;
    END IF;

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_secret,
        'Content-Type',  'application/json'
      ),
      body := jsonb_build_object('sync_type', 'auto'),
      timeout_milliseconds := 120000
    );
  END;
  $body$;
$cron$);
