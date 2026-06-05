-- Migration: drain the review_request_queue → actually send the post-stay
-- review invite.
--
-- queue-review-requests (in 20260501000014) fills review_request_queue ~24h
-- after checkout, but nothing dispatched it — so guests were never nudged. This
-- cron calls the Next.js worker at /api/review-request-worker, which dispatches
-- the review_request_guest notification (email + push + in-app) per queued row
-- and stamps sent_at. Mirrors the drain-push-queue pattern.
--
-- Set the worker URL in Vault once (the shared bearer 'email_worker_secret'
-- already exists for the other workers):
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/review-request-worker',
--     'review_request_worker_url',
--     'URL the drain-review-requests cron posts to');
-- Until it's set, the job soft-skips (no error).

SELECT cron.unschedule('drain-review-requests')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-review-requests');

SELECT cron.schedule('drain-review-requests', '20 * * * *', $cron$
  DO $body$
  DECLARE
    v_url     text;
    v_secret  text;
    v_pending int;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'review_request_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'drain-review-requests: vault review_request_worker_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    SELECT COUNT(*) INTO v_pending
    FROM public.review_request_queue
    WHERE sent_at IS NULL;

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
