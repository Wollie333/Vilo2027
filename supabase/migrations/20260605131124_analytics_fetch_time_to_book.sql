-- =====================================================
-- Analytics RPC: fetch_time_to_book
-- =====================================================
-- Returns customer journey metrics:
-- - Median days from first view to booking
-- - Breakdown by time ranges
-- - Average touchpoints
-- - Average session duration
--
-- Pre-MVP: See AGENT_RULES.md §3.4 - all features temporarily unlocked
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_time_to_book(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_listing_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_median_days numeric;
  v_avg_touchpoints numeric;
  v_avg_session_duration numeric;
  v_breakdown jsonb;
BEGIN
  -- ============ MEDIAN DAYS TO BOOK ============
  -- Calculate median time from first listing view to booking creation
  WITH booking_journey AS (
    SELECT
      b.id AS booking_id,
      b.created_at AS booking_date,
      MIN(lve.viewed_at) AS first_view_date,
      EXTRACT(EPOCH FROM (b.created_at - MIN(lve.viewed_at))) / 86400 AS days_to_book
    FROM bookings b
    LEFT JOIN listing_view_events lve ON
      lve.listing_id = b.listing_id
      AND lve.viewed_at < b.created_at
      AND lve.user_id = b.guest_id
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.created_at >= p_start_date::timestamp
      AND b.created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
    GROUP BY b.id, b.created_at
    HAVING MIN(lve.viewed_at) IS NOT NULL
  )
  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_book)
  INTO v_median_days
  FROM booking_journey;

  -- ============ TIME BREAKDOWN ============
  -- Group bookings by time ranges
  WITH booking_journey AS (
    SELECT
      b.id AS booking_id,
      EXTRACT(EPOCH FROM (b.created_at - MIN(lve.viewed_at))) / 86400 AS days_to_book
    FROM bookings b
    LEFT JOIN listing_view_events lve ON
      lve.listing_id = b.listing_id
      AND lve.viewed_at < b.created_at
      AND lve.user_id = b.guest_id
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.created_at >= p_start_date::timestamp
      AND b.created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
    GROUP BY b.id, b.created_at
    HAVING MIN(lve.viewed_at) IS NOT NULL
  )
  SELECT jsonb_build_object(
    'same_day', COUNT(*) FILTER (WHERE days_to_book < 1),
    'one_to_three', COUNT(*) FILTER (WHERE days_to_book >= 1 AND days_to_book < 3),
    'three_to_seven', COUNT(*) FILTER (WHERE days_to_book >= 3 AND days_to_book < 7),
    'seven_to_fourteen', COUNT(*) FILTER (WHERE days_to_book >= 7 AND days_to_book < 14),
    'over_fourteen', COUNT(*) FILTER (WHERE days_to_book >= 14)
  )
  INTO v_breakdown
  FROM booking_journey;

  -- ============ AVERAGE TOUCHPOINTS ============
  -- Count average number of views before booking
  WITH booking_touchpoints AS (
    SELECT
      b.id AS booking_id,
      COUNT(lve.id) AS touchpoint_count
    FROM bookings b
    LEFT JOIN listing_view_events lve ON
      lve.listing_id = b.listing_id
      AND lve.viewed_at < b.created_at
      AND lve.user_id = b.guest_id
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.created_at >= p_start_date::timestamp
      AND b.created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
    GROUP BY b.id
  )
  SELECT COALESCE(AVG(touchpoint_count), 0)
  INTO v_avg_touchpoints
  FROM booking_touchpoints;

  -- ============ AVERAGE SESSION DURATION ============
  SELECT COALESCE(AVG(duration_seconds), 0)
  INTO v_avg_session_duration
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
    'median_days', COALESCE(ROUND(v_median_days, 1), 0),
    'breakdown', COALESCE(v_breakdown, jsonb_build_object(
      'same_day', 0,
      'one_to_three', 0,
      'three_to_seven', 0,
      'seven_to_fourteen', 0,
      'over_fourteen', 0
    )),
    'avg_touchpoints', ROUND(v_avg_touchpoints, 1),
    'avg_session_duration', ROUND(v_avg_session_duration, 0)
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fetch_time_to_book(uuid, date, date, uuid) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_time_to_book IS 'Analytics: Returns customer journey metrics (median days to book, touchpoints, session duration)';
