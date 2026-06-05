-- =====================================================
-- Analytics RPC: fetch_secondary_metrics
-- =====================================================
-- Calculates secondary KPIs:
-- - Net booking value & commission saved
-- - Average rating & review count
-- - Cancellation & refund rates
-- - Quote acceptance rate
-- - Listing views & avg session duration
--
-- Pre-MVP: See AGENT_RULES.md §3.4 - all features temporarily unlocked
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_secondary_metrics(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_listing_id uuid DEFAULT NULL,
  p_channel text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_net_value numeric;
  v_commission_saved numeric;
  v_avg_rating numeric;
  v_review_count integer;
  v_prior_avg_rating numeric;
  v_cancellation_count integer;
  v_total_bookings integer;
  v_cancellation_rate numeric;
  v_refund_amount numeric;
  v_refund_count integer;
  v_refund_rate numeric;
  v_quotes_sent integer;
  v_quotes_accepted integer;
  v_acceptance_rate numeric;
  v_listing_views integer;
  v_avg_session_seconds numeric;
  v_days_diff integer;
  v_prior_start_date date;
  v_prior_end_date date;
BEGIN
  -- Calculate prior period dates
  v_days_diff := p_end_date - p_start_date;
  v_prior_start_date := p_start_date - (v_days_diff + 1);
  v_prior_end_date := p_start_date - 1;

  -- ============ NET BOOKING VALUE ============
  SELECT COALESCE(SUM(total_price), 0)
  INTO v_net_value
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= p_start_date
    AND check_in_date <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Commission saved: assume 15% OTA commission on direct bookings
  -- Only count direct bookings (channel = 'direct')
  SELECT COALESCE(SUM(total_price * 0.15), 0)
  INTO v_commission_saved
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= p_start_date
    AND check_in_date <= p_end_date
    AND channel = 'direct'
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- ============ AVERAGE RATING ============
  -- Current period average
  SELECT
    COALESCE(AVG(rating), 0),
    COALESCE(COUNT(*), 0)
  INTO v_avg_rating, v_review_count
  FROM reviews
  WHERE host_id = p_host_id
    AND created_at >= p_start_date
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- Prior period average (for delta)
  SELECT COALESCE(AVG(rating), 0)
  INTO v_prior_avg_rating
  FROM reviews
  WHERE host_id = p_host_id
    AND created_at >= v_prior_start_date
    AND created_at <= (v_prior_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- ============ CANCELLATION RATE ============
  -- Count cancelled bookings
  SELECT COALESCE(COUNT(*), 0)
  INTO v_cancellation_count
  FROM bookings
  WHERE host_id = p_host_id
    AND status = 'cancelled'
    AND check_in_date >= p_start_date
    AND check_in_date <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Total bookings (confirmed + cancelled)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_total_bookings
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled')
    AND check_in_date >= p_start_date
    AND check_in_date <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  v_cancellation_rate := CASE
    WHEN v_total_bookings > 0
    THEN (v_cancellation_count::numeric / v_total_bookings * 100)
    ELSE 0
  END;

  -- ============ REFUND RATE ============
  -- Sum of refunded amounts from payments table
  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(COUNT(*), 0)
  INTO v_refund_amount, v_refund_count
  FROM payments
  WHERE host_id = p_host_id
    AND payment_type = 'refund'
    AND status = 'completed'
    AND created_at >= p_start_date
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  v_refund_rate := CASE
    WHEN v_net_value > 0
    THEN (v_refund_amount / v_net_value * 100)
    ELSE 0
  END;

  -- ============ QUOTE ACCEPTANCE ============
  -- Count quotes sent
  SELECT COALESCE(COUNT(*), 0)
  INTO v_quotes_sent
  FROM quotes
  WHERE host_id = p_host_id
    AND created_at >= p_start_date
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- Count quotes accepted (status = 'accepted' or converted to booking)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_quotes_accepted
  FROM quotes
  WHERE host_id = p_host_id
    AND status IN ('accepted', 'booked')
    AND created_at >= p_start_date
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  v_acceptance_rate := CASE
    WHEN v_quotes_sent > 0
    THEN (v_quotes_accepted::numeric / v_quotes_sent * 100)
    ELSE 0
  END;

  -- ============ LISTING VIEWS ============
  -- From listing_view_events table
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(AVG(duration_seconds), 0)
  INTO v_listing_views, v_avg_session_seconds
  FROM listing_view_events
  WHERE listing_id IN (
    SELECT id FROM listings
    WHERE host_id = p_host_id
      AND deleted_at IS NULL
      AND (p_listing_id IS NULL OR id = p_listing_id)
  )
  AND viewed_at >= p_start_date::timestamp
  AND viewed_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second');

  -- ============ BUILD RESULT ============
  v_result := jsonb_build_object(
    'net_value', ROUND(v_net_value, 2),
    'commission_saved', ROUND(v_commission_saved, 2),
    'avg_rating', ROUND(v_avg_rating, 2),
    'review_count', v_review_count,
    'rating_delta', CASE
      WHEN v_prior_avg_rating > 0
      THEN ROUND((v_avg_rating - v_prior_avg_rating)::numeric, 2)
      ELSE NULL
    END,
    'cancellation_rate', ROUND(v_cancellation_rate, 1),
    'cancellation_count', v_cancellation_count,
    'total_bookings', v_total_bookings,
    'refund_rate', ROUND(v_refund_rate, 1),
    'refund_amount', ROUND(v_refund_amount, 2),
    'refund_count', v_refund_count,
    'quotes_sent', v_quotes_sent,
    'quotes_accepted', v_quotes_accepted,
    'acceptance_rate', ROUND(v_acceptance_rate, 1),
    'listing_views', v_listing_views,
    'avg_session_seconds', ROUND(v_avg_session_seconds, 0)
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (RLS will enforce host_id scoping)
GRANT EXECUTE ON FUNCTION fetch_secondary_metrics(uuid, date, date, uuid, text) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_secondary_metrics IS 'Analytics: Returns secondary metrics (net value, ratings, cancellations, refunds, quotes, listing views)';
