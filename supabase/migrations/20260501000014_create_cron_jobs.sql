-- Migration: pg_cron Scheduled Jobs + Realtime publication (v1.0)
-- Per supabase_database.md §18 and §19

-- ─── Realtime publication ────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- ─── pg_cron jobs ─────────────────────────────────────────────

-- 1. Expire unpaid pending bookings (30 min timeout)
SELECT cron.schedule('expire-pending-bookings', '*/5 * * * *', $$
  UPDATE bookings SET status = 'expired', cancelled_by = 'system'
  WHERE status = 'pending' AND payment_method IN ('paystack','paypal')
    AND created_at < now() - interval '30 minutes';
$$);

-- 2. Expire EFT bookings with no proof (48 hours)
SELECT cron.schedule('expire-eft-bookings', '0 * * * *', $$
  UPDATE bookings SET status = 'expired', cancelled_by = 'system',
    cancellation_reason = 'eft_proof_not_uploaded'
  WHERE status = 'pending_eft' AND created_at < now() - interval '48 hours';
$$);

-- 3. Auto-cancel booking requests with no host response (24 hours)
SELECT cron.schedule('cancel-unresponded-requests', '0 * * * *', $$
  UPDATE bookings SET status = 'cancelled_by_host', cancelled_by = 'system',
    cancellation_reason = 'host_no_response'
  WHERE status = 'pending' AND payment_method IN ('paystack','paypal')
    AND created_at < now() - interval '24 hours';
$$);

-- 4. Auto-publish reviews after 48-hour moderation window
SELECT cron.schedule('auto-publish-reviews', '*/15 * * * *', $$
  UPDATE reviews SET is_published = true
  WHERE is_published = false AND flagged = false
    AND publish_at IS NOT NULL AND publish_at <= now();
$$);

-- 5. Queue review request emails (24h after check-out, once per booking)
SELECT cron.schedule('queue-review-requests', '0 9 * * *', $$
  INSERT INTO review_request_queue (booking_id, guest_id)
  SELECT b.id, b.guest_id FROM bookings b
  LEFT JOIN reviews r ON r.booking_id = b.id
  LEFT JOIN review_request_queue q ON q.booking_id = b.id
  WHERE b.status = 'completed'
    AND b.checked_out_at < now() - interval '24 hours'
    AND r.id IS NULL AND q.booking_id IS NULL;
$$);

-- 6. Restrict accounts after grace period expires
SELECT cron.schedule('restrict-overdue-subscriptions', '0 * * * *', $$
  UPDATE subscriptions SET status = 'restricted'
  WHERE status = 'past_due'
    AND grace_period_ends_at IS NOT NULL
    AND grace_period_ends_at < now();
$$);

-- 7. Remove expired host feature overrides
SELECT cron.schedule('expire-host-overrides', '0 * * * *', $$
  DELETE FROM host_feature_overrides
  WHERE expires_at IS NOT NULL AND expires_at < now();
$$);

-- 8. Recalculate directory ranking scores (all published listings)
SELECT cron.schedule('recalculate-rankings', '*/15 * * * *', $$
  SELECT recalculate_listing_ranking(id)
  FROM listings WHERE is_published = true AND deleted_at IS NULL;
$$);

-- 9. Queue subscription expiry warnings (7 days before renewal)
SELECT cron.schedule('subscription-expiry-warnings', '0 8 * * *', $$
  INSERT INTO notification_queue (host_id, type, payload)
  SELECT host_id, 'subscription_expiring', jsonb_build_object('days_remaining', 7)
  FROM subscriptions
  WHERE status = 'active'
    AND current_period_end BETWEEN now() AND now() + interval '7 days'
    AND cancel_at_period_end = false;
$$);

-- 10. Recalculate host response rates (daily, rolling 90 days)
SELECT cron.schedule('update-response-rates', '0 3 * * *', $$
  UPDATE hosts h SET response_rate = stats.rate
  FROM (
    SELECT host_id,
      COUNT(*) FILTER (WHERE confirmed_at IS NOT NULL OR declined_at IS NOT NULL)::numeric /
      NULLIF(COUNT(*), 0) AS rate
    FROM bookings
    WHERE created_at > now() - interval '90 days' AND status != 'expired'
    GROUP BY host_id
  ) stats
  WHERE h.id = stats.host_id;
$$);

-- 11. Clean up expired staff invites (daily)
SELECT cron.schedule('clean-expired-invites', '0 2 * * *', $$
  DELETE FROM staff_invites WHERE expires_at < now() AND accepted_at IS NULL;
$$);

-- 12. Clean up old search logs (retain 90 days)
SELECT cron.schedule('clean-search-logs', '0 1 * * *', $$
  DELETE FROM directory_search_logs WHERE created_at < now() - interval '90 days';
$$);
