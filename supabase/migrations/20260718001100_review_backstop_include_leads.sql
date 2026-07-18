-- The checkout enqueue of a review request is wrapped in a try/catch that
-- swallows errors and delegates recovery to this daily backstop. But the
-- backstop filtered `b.guest_id IS NOT NULL`, so an account-less (manual-EFT /
-- lead) guest whose enqueue failed was NEVER recovered — the swallow's promise
-- was false for them. sendReviewRequest fully supports email-only guests, and
-- review_request_queue.guest_id is nullable, so widen the filter to also pick up
-- stays whose guest has an email on file.
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
    AND (b.guest_id IS NOT NULL OR b.guest_email IS NOT NULL)
    AND b.checked_out_at < now() - interval '24 hours'
    AND r.id IS NULL
    AND q.booking_id IS NULL;
$cron$);
