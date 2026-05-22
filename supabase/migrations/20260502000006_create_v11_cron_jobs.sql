-- Migration: v1.1 pg_cron jobs (Refund + Policy Manager)
-- Per supabase_database.md §13.8 and §14.10

-- Alert hosts about refund requests pending > 24 hours
SELECT cron.schedule('alert-pending-refunds', '0 9 * * *', $$
  INSERT INTO notification_queue (host_id, type, payload)
  SELECT host_id,
    'refund_awaiting_action',
    jsonb_build_object(
      'count', COUNT(*),
      'oldest_request', MIN(created_at)
    )
  FROM refund_requests
  WHERE status = 'pending'
    AND created_at < now() - interval '24 hours'
  GROUP BY host_id;
$$);

-- Auto-escalate refund requests not actioned within 72 hours
SELECT cron.schedule('auto-escalate-refunds', '0 10 * * *', $$
  UPDATE refund_requests
  SET status = 'escalated',
      escalated_at = now(),
      escalation_note = 'Auto-escalated: no host response within 72 hours'
  WHERE status = 'pending'
    AND initiated_by = 'guest'
    AND created_at < now() - interval '72 hours';
$$);

-- Daily: alert hosts who have published listings with no cancellation policy
SELECT cron.schedule('alert-missing-policies', '0 10 * * *', $$
  INSERT INTO notification_queue (host_id, type, payload)
  SELECT DISTINCT l.host_id,
    'listing_missing_policy',
    jsonb_build_object(
      'listing_id',   l.id,
      'listing_name', l.name,
      'missing_type', 'cancellation'
    )
  FROM listings l
  WHERE l.is_published = true
    AND l.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM listing_policies lp
      WHERE lp.listing_id = l.id AND lp.policy_type = 'cancellation'
    );
$$);
