-- Migration: Review-request worker cron + paid-aware backstop.
--
-- Primary path: checkout enqueues a review_request_queue row with
-- send_at = checkout + 5 min (apps/web/app/dashboard/bookings/actions.ts).
-- The drain-review-requests cron POSTs the worker once a row is due; the
-- worker (/api/review-request-worker) calls sendReviewRequest per booking.
--
-- Worker URL lives in Vault as 'review_request_worker_url'; the bearer reuses
-- the shared 'email_worker_secret' entry. Create once per env (SQL Editor):
--
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/review-request-worker',
--     'review_request_worker_url', '');
--
-- Missing secrets → the cron tick is a fail-soft no-op (NOTICE logged).

-- ─── drain-review-requests (every minute) ─────────────────────────────────
SELECT cron.unschedule('drain-review-requests')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-review-requests');

SELECT cron.schedule('drain-review-requests', '* * * * *', $cron$
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
    WHERE sent_at IS NULL AND send_at <= now();

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

-- ─── Backstop: queue review requests for paid, completed stays ────────────
-- Replaces the original 'queue-review-requests' job: only PAID stays, written
-- with send_at = now() so the worker picks them up immediately. Catches any
-- checkout whose 5-min enqueue was missed (e.g. an error during the action).
SELECT cron.unschedule('queue-review-requests')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'queue-review-requests');

SELECT cron.schedule('queue-review-requests', '0 9 * * *', $cron$
  INSERT INTO review_request_queue (booking_id, guest_id, send_at)
  SELECT b.id, b.guest_id, now()
  FROM bookings b
  LEFT JOIN reviews r              ON r.booking_id = b.id
  LEFT JOIN review_request_queue q ON q.booking_id = b.id
  WHERE b.status = 'completed'
    AND b.payment_status IN ('completed','partially_refunded','refunded')
    AND b.guest_id IS NOT NULL
    AND b.checked_out_at < now() - interval '24 hours'
    AND r.id IS NULL
    AND q.booking_id IS NULL;
$cron$);
