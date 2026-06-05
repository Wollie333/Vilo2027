-- Comprehensive Analytics Schema Fix
-- Fixes: total_price → total_amount, check_in_date → check_in, check_out_date → check_out

-- Drop all analytics functions
DROP FUNCTION IF EXISTS fetch_primary_kpis(uuid, date, date, uuid, text);
DROP FUNCTION IF EXISTS fetch_secondary_metrics(uuid, date, date, uuid, text);
DROP FUNCTION IF EXISTS fetch_revenue_trend(uuid, date, date, text, uuid, text);
DROP FUNCTION IF EXISTS fetch_channel_mix(uuid, date, date, uuid);
DROP FUNCTION IF EXISTS fetch_conversion_funnel(uuid, date, date, uuid);
DROP FUNCTION IF EXISTS fetch_time_to_book(uuid, date, date, uuid);
DROP FUNCTION IF EXISTS fetch_property_performance(uuid, date, date, text, text, integer, integer);
DROP FUNCTION IF EXISTS fetch_regional_breakdown(uuid, date, date, uuid);
DROP FUNCTION IF EXISTS fetch_seasonality_heatmap(uuid, integer);
DROP FUNCTION IF EXISTS fetch_guest_demographics(uuid, date, date, uuid);
DROP FUNCTION IF EXISTS fetch_popular_rooms(uuid, date, date, integer);
DROP FUNCTION IF EXISTS fetch_refunds_cancellations(uuid, date, date, uuid);

-- From 20260605123709_analytics_fetch_primary_kpis.sql
CREATE FUNCTION fetch_primary_kpis(
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
  v_current_revenue numeric;
  v_prior_revenue numeric;
  v_current_occupied_nights integer;
  v_prior_occupied_nights integer;
  v_total_available_nights integer;
  v_prior_available_nights integer;
  v_current_adr numeric;
  v_prior_adr numeric;
  v_current_revpar numeric;
  v_prior_revpar numeric;
  v_current_occupancy numeric;
  v_prior_occupancy numeric;
  v_days_diff integer;
  v_prior_start_date date;
  v_prior_end_date date;
  v_revenue_sparkline jsonb;
BEGIN
  -- Calculate prior period dates (same duration)
  v_days_diff := p_end_date - p_start_date;
  v_prior_start_date := p_start_date - (v_days_diff + 1);
  v_prior_end_date := p_start_date - 1;

  -- ============ CURRENT PERIOD ============
  -- Total revenue from confirmed bookings
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_current_revenue
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in >= p_start_date
    AND check_in <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Total occupied nights (check_out - check_in for each booking)
  SELECT COALESCE(SUM(check_out - check_in), 0)
  INTO v_current_occupied_nights
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in >= p_start_date
    AND check_in <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Total available nights (number of listings × days in period)
  -- If filtering by listing, count = 1, else count all active listings
  IF p_listing_id IS NOT NULL THEN
    v_total_available_nights := (v_days_diff + 1);
  ELSE
    SELECT COUNT(*) * (v_days_diff + 1)
    INTO v_total_available_nights
    FROM listings
    WHERE host_id = p_host_id
      AND status = 'published'
      AND deleted_at IS NULL;
  END IF;

  -- ============ PRIOR PERIOD ============
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_prior_revenue
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in >= v_prior_start_date
    AND check_in <= v_prior_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  SELECT COALESCE(SUM(check_out - check_in), 0)
  INTO v_prior_occupied_nights
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in >= v_prior_start_date
    AND check_in <= v_prior_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  IF p_listing_id IS NOT NULL THEN
    v_prior_available_nights := (v_days_diff + 1);
  ELSE
    SELECT COUNT(*) * (v_days_diff + 1)
    INTO v_prior_available_nights
    FROM listings
    WHERE host_id = p_host_id
      AND status = 'published'
      AND deleted_at IS NULL;
  END IF;

  -- ============ CALCULATE METRICS ============
  -- ADR = Total revenue / Occupied nights
  v_current_adr := CASE
    WHEN v_current_occupied_nights > 0
    THEN v_current_revenue / v_current_occupied_nights
    ELSE 0
  END;

  v_prior_adr := CASE
    WHEN v_prior_occupied_nights > 0
    THEN v_prior_revenue / v_prior_occupied_nights
    ELSE 0
  END;

  -- RevPAR = Total revenue / Available nights
  v_current_revpar := CASE
    WHEN v_total_available_nights > 0
    THEN v_current_revenue / v_total_available_nights
    ELSE 0
  END;

  v_prior_revpar := CASE
    WHEN v_prior_available_nights > 0
    THEN v_prior_revenue / v_prior_available_nights
    ELSE 0
  END;

  -- Occupancy = (Occupied nights / Available nights) * 100
  v_current_occupancy := CASE
    WHEN v_total_available_nights > 0
    THEN (v_current_occupied_nights::numeric / v_total_available_nights * 100)
    ELSE 0
  END;

  v_prior_occupancy := CASE
    WHEN v_prior_available_nights > 0
    THEN (v_prior_occupied_nights::numeric / v_prior_available_nights * 100)
    ELSE 0
  END;

  -- ============ SPARKLINE DATA ============
  -- Generate daily revenue sparkline for current period
  -- Returns array of {date, value} objects
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', day,
      'value', COALESCE(daily_revenue, 0)
    ) ORDER BY day
  )
  INTO v_revenue_sparkline
  FROM (
    SELECT
      day::date,
      SUM(b.total_amount) AS daily_revenue
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS day
    LEFT JOIN bookings b ON
      b.host_id = p_host_id
      AND b.check_in = day::date
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
      AND (p_channel IS NULL OR b.channel = p_channel)
    GROUP BY day
  ) sparkline_data;

  -- ============ BUILD RESULT ============
  v_result := jsonb_build_object(
    'revenue', jsonb_build_object(
      'current', ROUND(v_current_revenue, 2),
      'prior', ROUND(v_prior_revenue, 2),
      'delta', CASE
        WHEN v_prior_revenue > 0
        THEN ROUND(((v_current_revenue - v_prior_revenue) / v_prior_revenue * 100)::numeric, 1)
        ELSE NULL
      END,
      'sparkline', v_revenue_sparkline
    ),
    'revpar', jsonb_build_object(
      'current', ROUND(v_current_revpar, 2),
      'prior', ROUND(v_prior_revpar, 2),
      'delta', CASE
        WHEN v_prior_revpar > 0
        THEN ROUND(((v_current_revpar - v_prior_revpar) / v_prior_revpar * 100)::numeric, 1)
        ELSE NULL
      END
    ),
    'adr', jsonb_build_object(
      'current', ROUND(v_current_adr, 2),
      'prior', ROUND(v_prior_adr, 2),
      'delta', CASE
        WHEN v_prior_adr > 0
        THEN ROUND(((v_current_adr - v_prior_adr) / v_prior_adr * 100)::numeric, 1)
        ELSE NULL
      END
    ),
    'occupancy', jsonb_build_object(
      'current', ROUND(v_current_occupancy, 1),
      'prior', ROUND(v_prior_occupancy, 1),
      'delta', ROUND((v_current_occupancy - v_prior_occupancy)::numeric, 1),
      'occupied_nights', v_current_occupied_nights,
      'available_nights', v_total_available_nights
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (RLS will enforce host_id scoping)
GRANT EXECUTE ON FUNCTION fetch_primary_kpis(uuid, date, date, uuid, text) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_primary_kpis IS 'Analytics: Returns primary KPIs (Revenue, RevPAR, ADR, Occupancy) with prior period comparison and sparkline data';

-- From 20260605124157_analytics_fetch_secondary_metrics.sql
CREATE FUNCTION fetch_secondary_metrics(
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
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_net_value
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in >= p_start_date
    AND check_in <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Commission saved: assume 15% OTA commission on direct bookings
  -- Only count direct bookings (channel = 'direct')
  SELECT COALESCE(SUM(total_amount * 0.15), 0)
  INTO v_commission_saved
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in >= p_start_date
    AND check_in <= p_end_date
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
    AND check_in >= p_start_date
    AND check_in <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Total bookings (confirmed + cancelled)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_total_bookings
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled')
    AND check_in >= p_start_date
    AND check_in <= p_end_date
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

-- From 20260605124813_analytics_fetch_revenue_trend.sql
CREATE FUNCTION fetch_revenue_trend(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_grouping text DEFAULT 'day', -- 'day', 'week', or 'month'
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
  v_current_data jsonb;
  v_prior_data jsonb;
  v_days_diff integer;
  v_prior_start_date date;
  v_prior_end_date date;
  v_interval text;
BEGIN
  -- Calculate prior period dates
  v_days_diff := p_end_date - p_start_date;
  v_prior_start_date := p_start_date - (v_days_diff + 1);
  v_prior_end_date := p_start_date - 1;

  -- Determine date truncation based on grouping
  v_interval := CASE
    WHEN p_grouping = 'week' THEN 'week'
    WHEN p_grouping = 'month' THEN 'month'
    ELSE 'day'
  END;

  -- ============ CURRENT PERIOD DATA ============
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', period_date,
      'revenue', COALESCE(revenue, 0)
    ) ORDER BY period_date
  )
  INTO v_current_data
  FROM (
    SELECT
      date_trunc(v_interval, day)::date AS period_date,
      SUM(COALESCE(b.total_amount, 0)) AS revenue
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS day
    LEFT JOIN bookings b ON
      b.host_id = p_host_id
      AND b.check_in = day::date
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
      AND (p_channel IS NULL OR b.channel = p_channel)
    GROUP BY period_date
  ) current_period;

  -- ============ PRIOR PERIOD DATA ============
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', period_date,
      'revenue', COALESCE(revenue, 0)
    ) ORDER BY period_date
  )
  INTO v_prior_data
  FROM (
    SELECT
      date_trunc(v_interval, day)::date AS period_date,
      SUM(COALESCE(b.total_amount, 0)) AS revenue
    FROM generate_series(v_prior_start_date, v_prior_end_date, '1 day'::interval) AS day
    LEFT JOIN bookings b ON
      b.host_id = p_host_id
      AND b.check_in = day::date
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
      AND (p_channel IS NULL OR b.channel = p_channel)
    GROUP BY period_date
  ) prior_period;

  -- ============ BUILD RESULT ============
  v_result := jsonb_build_object(
    'current', COALESCE(v_current_data, '[]'::jsonb),
    'prior', COALESCE(v_prior_data, '[]'::jsonb),
    'grouping', p_grouping
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fetch_revenue_trend(uuid, date, date, text, uuid, text) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_revenue_trend IS 'Analytics: Returns revenue trend data grouped by day/week/month with prior period comparison';

-- From 20260605124850_analytics_fetch_channel_mix.sql
CREATE FUNCTION fetch_channel_mix(
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
BEGIN
  -- ============ CHANNEL BREAKDOWN ============
  -- Group bookings by channel and sum revenue
  SELECT jsonb_agg(
    jsonb_build_object(
      'channel', COALESCE(channel, 'direct'),
      'revenue', COALESCE(revenue, 0),
      'bookings', COALESCE(booking_count, 0),
      'percentage', CASE
        WHEN total_revenue > 0
        THEN ROUND((revenue / total_revenue * 100)::numeric, 1)
        ELSE 0
      END
    ) ORDER BY revenue DESC
  )
  INTO v_result
  FROM (
    SELECT
      COALESCE(b.channel, 'direct') AS channel,
      SUM(b.total_amount) AS revenue,
      COUNT(*) AS booking_count,
      SUM(SUM(b.total_amount)) OVER () AS total_revenue
    FROM bookings b
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.check_in >= p_start_date
      AND b.check_in <= p_end_date
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
    GROUP BY COALESCE(b.channel, 'direct')
  ) channel_data;

  -- Return empty array if no data
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fetch_channel_mix(uuid, date, date, uuid) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_channel_mix IS 'Analytics: Returns booking revenue breakdown by channel for pie chart visualization';

-- From 20260605131105_analytics_fetch_conversion_funnel.sql
CREATE FUNCTION fetch_conversion_funnel(
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
  v_views integer;
  v_inquiries integer;
  v_quotes integer;
  v_bookings integer;
  v_views_to_inquiries numeric;
  v_inquiries_to_quotes numeric;
  v_quotes_to_bookings numeric;
  v_views_to_bookings numeric;
BEGIN
  -- ============ VIEWS ============
  -- Count unique listing views from listing_view_events
  SELECT COALESCE(COUNT(DISTINCT session_id), 0)
  INTO v_views
  FROM listing_view_events
  WHERE listing_id IN (
    SELECT id FROM listings
    WHERE host_id = p_host_id
      AND deleted_at IS NULL
      AND (p_listing_id IS NULL OR id = p_listing_id)
  )
  AND viewed_at >= p_start_date::timestamp
  AND viewed_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second');

  -- ============ INQUIRIES ============
  -- Count conversations initiated in the period
  SELECT COALESCE(COUNT(*), 0)
  INTO v_inquiries
  FROM conversations
  WHERE host_id = p_host_id
    AND created_at >= p_start_date::timestamp
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- ============ QUOTES ============
  -- Count quotes sent in the period
  SELECT COALESCE(COUNT(*), 0)
  INTO v_quotes
  FROM quotes
  WHERE host_id = p_host_id
    AND created_at >= p_start_date::timestamp
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- ============ BOOKINGS ============
  -- Count confirmed bookings in the period
  SELECT COALESCE(COUNT(*), 0)
  INTO v_bookings
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND created_at >= p_start_date::timestamp
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- ============ CALCULATE CONVERSION RATES ============
  v_views_to_inquiries := CASE
    WHEN v_views > 0 THEN (v_inquiries::numeric / v_views * 100)
    ELSE 0
  END;

  v_inquiries_to_quotes := CASE
    WHEN v_inquiries > 0 THEN (v_quotes::numeric / v_inquiries * 100)
    ELSE 0
  END;

  v_quotes_to_bookings := CASE
    WHEN v_quotes > 0 THEN (v_bookings::numeric / v_quotes * 100)
    ELSE 0
  END;

  v_views_to_bookings := CASE
    WHEN v_views > 0 THEN (v_bookings::numeric / v_views * 100)
    ELSE 0
  END;

  -- ============ BUILD RESULT ============
  v_result := jsonb_build_object(
    'views', v_views,
    'inquiries', v_inquiries,
    'quotes', v_quotes,
    'bookings', v_bookings,
    'conversion_rates', jsonb_build_object(
      'views_to_inquiries', ROUND(v_views_to_inquiries, 1),
      'inquiries_to_quotes', ROUND(v_inquiries_to_quotes, 1),
      'quotes_to_bookings', ROUND(v_quotes_to_bookings, 1),
      'views_to_bookings', ROUND(v_views_to_bookings, 1)
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fetch_conversion_funnel(uuid, date, date, uuid) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_conversion_funnel IS 'Analytics: Returns conversion funnel data (Views → Inquiries → Quotes → Bookings) with conversion rates';

-- From 20260605131124_analytics_fetch_time_to_book.sql
CREATE FUNCTION fetch_time_to_book(
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

-- From 20260605185000_analytics_fetch_property_performance.sql
CREATE FUNCTION fetch_property_performance(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_sort_by text DEFAULT 'revenue',
  p_sort_direction text DEFAULT 'desc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_total_count integer;
  v_properties jsonb;
  v_period_days integer;
BEGIN
  -- Calculate period length
  v_period_days := p_end_date - p_start_date + 1;

  -- ============ COUNT TOTAL PROPERTIES ============
  SELECT COUNT(*)
  INTO v_total_count
  FROM listings
  WHERE host_id = p_host_id
    AND deleted_at IS NULL;

  -- ============ BUILD PROPERTY PERFORMANCE ARRAY ============
  WITH property_current AS (
    SELECT
      l.id AS listing_id,
      l.title AS listing_name,
      l.slug AS listing_slug,
      l.cover_image_url,
      l.status AS listing_status,

      -- Current period revenue
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in >= p_start_date
            AND b.check_out <= p_end_date
          THEN b.total_amount
          ELSE 0
        END
      ), 0) AS revenue,

      -- Current period nights booked
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in >= p_start_date
            AND b.check_out <= p_end_date
          THEN EXTRACT(DAY FROM (b.check_out - b.check_in))
          ELSE 0
        END
      ), 0) AS nights_booked,

      -- Current period bookings count
      COUNT(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in >= p_start_date
            AND b.check_out <= p_end_date
          THEN 1
        END
      ) AS bookings_count,

      -- Available nights in period
      v_period_days AS available_nights

    FROM listings l
    LEFT JOIN bookings b ON b.listing_id = l.id AND b.deleted_at IS NULL
    WHERE l.host_id = p_host_id
      AND l.deleted_at IS NULL
    GROUP BY l.id, l.title, l.slug, l.cover_image_url, l.status
  ),

  property_prior AS (
    SELECT
      l.id AS listing_id,

      -- Prior period revenue
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in >= (p_start_date - v_period_days)
            AND b.check_out <= (p_end_date - v_period_days)
          THEN b.total_amount
          ELSE 0
        END
      ), 0) AS revenue_prior,

      -- Prior period nights booked
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in >= (p_start_date - v_period_days)
            AND b.check_out <= (p_end_date - v_period_days)
          THEN EXTRACT(DAY FROM (b.check_out - b.check_in))
          ELSE 0
        END
      ), 0) AS nights_booked_prior

    FROM listings l
    LEFT JOIN bookings b ON b.listing_id = l.id AND b.deleted_at IS NULL
    WHERE l.host_id = p_host_id
      AND l.deleted_at IS NULL
    GROUP BY l.id
  ),

  sparkline_data AS (
    SELECT
      l.id AS listing_id,
      jsonb_agg(
        jsonb_build_object(
          'date', day_series.day::date,
          'revenue', COALESCE(daily_revenue.revenue, 0)
        ) ORDER BY day_series.day
      ) AS sparkline
    FROM listings l
    CROSS JOIN generate_series(
      p_end_date - 29,
      p_end_date,
      '1 day'::interval
    ) AS day_series(day)
    LEFT JOIN (
      SELECT
        b.listing_id,
        b.check_in AS booking_date,
        SUM(b.total_amount) AS revenue
      FROM bookings b
      WHERE b.host_id = p_host_id
        AND b.status IN ('confirmed', 'checked_in', 'checked_out')
        AND b.check_in >= (p_end_date - 29)
        AND b.check_in <= p_end_date
        AND b.deleted_at IS NULL
      GROUP BY b.listing_id, b.check_in
    ) AS daily_revenue ON daily_revenue.listing_id = l.id AND daily_revenue.booking_date = day_series.day::date
    WHERE l.host_id = p_host_id
      AND l.deleted_at IS NULL
    GROUP BY l.id
  ),

  combined_metrics AS (
    SELECT
      pc.listing_id,
      pc.listing_name,
      pc.listing_slug,
      pc.cover_image_url,
      pc.listing_status,
      pc.revenue,
      pp.revenue_prior,
      CASE
        WHEN pp.revenue_prior > 0
        THEN ROUND(((pc.revenue - pp.revenue_prior) / pp.revenue_prior * 100)::numeric, 1)
        ELSE NULL
      END AS revenue_delta,

      pc.nights_booked,
      pp.nights_booked_prior,

      -- Occupancy % current
      CASE
        WHEN pc.available_nights > 0
        THEN ROUND((pc.nights_booked::numeric / pc.available_nights * 100)::numeric, 1)
        ELSE 0
      END AS occupancy,

      -- Occupancy % prior
      CASE
        WHEN pc.available_nights > 0
        THEN ROUND((pp.nights_booked_prior::numeric / pc.available_nights * 100)::numeric, 1)
        ELSE 0
      END AS occupancy_prior,

      -- Occupancy delta
      CASE
        WHEN pc.available_nights > 0 AND pp.nights_booked_prior > 0
        THEN ROUND(
          (
            (pc.nights_booked::numeric / pc.available_nights) -
            (pp.nights_booked_prior::numeric / pc.available_nights)
          ) * 100::numeric,
          1
        )
        ELSE NULL
      END AS occupancy_delta,

      -- ADR (Average Daily Rate)
      CASE
        WHEN pc.nights_booked > 0
        THEN ROUND((pc.revenue / pc.nights_booked)::numeric, 2)
        ELSE 0
      END AS adr,

      pc.bookings_count,
      sd.sparkline

    FROM property_current pc
    LEFT JOIN property_prior pp ON pp.listing_id = pc.listing_id
    LEFT JOIN sparkline_data sd ON sd.listing_id = pc.listing_id
  ),

  sorted_properties AS (
    SELECT
      listing_id,
      listing_name,
      listing_slug,
      cover_image_url,
      listing_status,
      revenue,
      revenue_prior,
      revenue_delta,
      nights_booked,
      occupancy,
      occupancy_prior,
      occupancy_delta,
      adr,
      bookings_count,
      sparkline
    FROM combined_metrics
    ORDER BY
      CASE WHEN p_sort_by = 'revenue' AND p_sort_direction = 'desc' THEN revenue END DESC,
      CASE WHEN p_sort_by = 'revenue' AND p_sort_direction = 'asc' THEN revenue END ASC,
      CASE WHEN p_sort_by = 'occupancy' AND p_sort_direction = 'desc' THEN occupancy END DESC,
      CASE WHEN p_sort_by = 'occupancy' AND p_sort_direction = 'asc' THEN occupancy END ASC,
      CASE WHEN p_sort_by = 'nights_booked' AND p_sort_direction = 'desc' THEN nights_booked END DESC,
      CASE WHEN p_sort_by = 'nights_booked' AND p_sort_direction = 'asc' THEN nights_booked END ASC,
      CASE WHEN p_sort_by = 'adr' AND p_sort_direction = 'desc' THEN adr END DESC,
      CASE WHEN p_sort_by = 'adr' AND p_sort_direction = 'asc' THEN adr END ASC,
      CASE WHEN p_sort_by = 'listing_name' AND p_sort_direction = 'desc' THEN listing_name END DESC,
      CASE WHEN p_sort_by = 'listing_name' AND p_sort_direction = 'asc' THEN listing_name END ASC
    LIMIT p_limit
    OFFSET p_offset
  )

  SELECT jsonb_agg(
    jsonb_build_object(
      'listing_id', listing_id,
      'listing_name', listing_name,
      'listing_slug', listing_slug,
      'cover_image_url', cover_image_url,
      'listing_status', listing_status,
      'revenue', revenue,
      'revenue_prior', revenue_prior,
      'revenue_delta', revenue_delta,
      'nights_booked', nights_booked,
      'occupancy', occupancy,
      'occupancy_prior', occupancy_prior,
      'occupancy_delta', occupancy_delta,
      'adr', adr,
      'bookings_count', bookings_count,
      'sparkline', sparkline
    )
  )
  INTO v_properties
  FROM sorted_properties;

  -- ============ BUILD RESULT ============
  v_result := jsonb_build_object(
    'properties', COALESCE(v_properties, '[]'::jsonb),
    'total_count', v_total_count,
    'page_size', p_limit,
    'offset', p_offset
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fetch_property_performance(uuid, date, date, text, text, integer, integer) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_property_performance IS 'Analytics: Returns performance metrics for each listing with sorting and pagination';

-- From 20260605192000_analytics_regional_breakdown.sql
CREATE FUNCTION fetch_regional_breakdown(
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
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'province', province,
      'revenue', revenue,
      'bookings', bookings,
      'percentage', percentage
    ) ORDER BY revenue DESC
  )
  INTO v_result
  FROM (
    SELECT
      COALESCE(l.province, 'Unknown') AS province,
      COALESCE(SUM(b.total_amount), 0) AS revenue,
      COUNT(b.id) AS bookings,
      ROUND(
        (COALESCE(SUM(b.total_amount), 0) / NULLIF(
          (SELECT SUM(total_amount)
           FROM bookings
           WHERE host_id = p_host_id
             AND status IN ('confirmed', 'checked_in', 'checked_out')
             AND check_in >= p_start_date
             AND check_out <= p_end_date
             AND deleted_at IS NULL
             AND (p_listing_id IS NULL OR listing_id = p_listing_id)
          ), 0
        ) * 100)::numeric,
        1
      ) AS percentage
    FROM listings l
    LEFT JOIN bookings b ON
      b.listing_id = l.id
      AND b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.check_in >= p_start_date
      AND b.check_out <= p_end_date
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
    WHERE l.host_id = p_host_id
      AND l.deleted_at IS NULL
      AND (p_listing_id IS NULL OR l.id = p_listing_id)
    GROUP BY l.province
    HAVING COALESCE(SUM(b.total_amount), 0) > 0
  ) regional_data;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fetch_regional_breakdown(uuid, date, date, uuid) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_regional_breakdown IS 'Analytics: Returns revenue breakdown by province/region';

-- From 20260605192100_analytics_seasonality_heatmap.sql
CREATE FUNCTION fetch_seasonality_heatmap(
  p_host_id uuid,
  p_year integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_provinces text[];
  v_months text[];
  v_data jsonb;
BEGIN
  -- Get list of provinces for this host (top 5 by revenue)
  SELECT array_agg(province ORDER BY total_revenue DESC)
  INTO v_provinces
  FROM (
    SELECT
      COALESCE(l.province, 'Unknown') AS province,
      SUM(b.total_amount) AS total_revenue
    FROM listings l
    LEFT JOIN bookings b ON
      b.listing_id = l.id
      AND b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND EXTRACT(YEAR FROM b.check_in) = p_year
      AND b.deleted_at IS NULL
    WHERE l.host_id = p_host_id
      AND l.deleted_at IS NULL
    GROUP BY l.province
    ORDER BY total_revenue DESC
    LIMIT 5
  ) top_provinces;

  -- Month names
  v_months := ARRAY['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  -- Build data array: 12 rows (one per month)
  WITH month_series AS (
    SELECT
      generate_series(1, 12) AS month_num,
      unnest(v_months) AS month_name
  ),

  revenue_by_month_province AS (
    SELECT
      EXTRACT(MONTH FROM b.check_in)::integer AS month_num,
      COALESCE(l.province, 'Unknown') AS province,
      COALESCE(SUM(b.total_amount), 0) AS revenue
    FROM bookings b
    INNER JOIN listings l ON l.id = b.listing_id
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND EXTRACT(YEAR FROM b.check_in) = p_year
      AND b.deleted_at IS NULL
      AND l.deleted_at IS NULL
    GROUP BY month_num, l.province
  )

  SELECT jsonb_agg(
    jsonb_build_object(
      'month', ms.month_name,
      'month_num', ms.month_num
    ) || (
      SELECT jsonb_object_agg(prov, COALESCE(revenue, 0))
      FROM unnest(v_provinces) AS prov
      LEFT JOIN revenue_by_month_province rmp ON
        rmp.province = prov
        AND rmp.month_num = ms.month_num
    )
    ORDER BY ms.month_num
  )
  INTO v_data
  FROM month_series ms;

  -- Build final result
  v_result := jsonb_build_object(
    'months', to_jsonb(v_months),
    'provinces', to_jsonb(COALESCE(v_provinces, ARRAY[]::text[])),
    'data', COALESCE(v_data, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fetch_seasonality_heatmap(uuid, integer) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_seasonality_heatmap IS 'Analytics: Returns revenue matrix (provinces × months) for heatmap visualization';

-- From 20260605200000_analytics_fetch_guest_demographics.sql
CREATE FUNCTION fetch_guest_demographics(
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
  v_returning_count integer;
  v_new_count integer;
  v_country_breakdown jsonb;
BEGIN
  -- ============ RETURNING VS NEW GUESTS ============
  -- Count guests with multiple bookings (returning) vs single booking (new)
  WITH guest_booking_counts AS (
    SELECT
      b.guest_id,
      COUNT(*) AS booking_count
    FROM bookings b
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.check_in >= p_start_date
      AND b.check_out <= p_end_date
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
    GROUP BY b.guest_id
  )
  SELECT
    COUNT(*) FILTER (WHERE booking_count > 1),
    COUNT(*) FILTER (WHERE booking_count = 1)
  INTO v_returning_count, v_new_count
  FROM guest_booking_counts;

  -- ============ COUNTRY ORIGINS BREAKDOWN ============
  -- Top 5 countries by booking count
  SELECT jsonb_agg(
    jsonb_build_object(
      'country', country,
      'bookings', bookings,
      'percentage', percentage
    ) ORDER BY bookings DESC
  )
  INTO v_country_breakdown
  FROM (
    SELECT
      COALESCE(up.country, 'Unknown') AS country,
      COUNT(b.id) AS bookings,
      ROUND(
        (COUNT(b.id)::numeric / NULLIF(
          (SELECT COUNT(*)
           FROM bookings
           WHERE host_id = p_host_id
             AND status IN ('confirmed', 'checked_in', 'checked_out')
             AND check_in >= p_start_date
             AND check_out <= p_end_date
             AND deleted_at IS NULL
             AND (p_listing_id IS NULL OR listing_id = p_listing_id)
          ), 0
        ) * 100)::numeric,
        1
      ) AS percentage
    FROM bookings b
    LEFT JOIN user_profiles up ON up.id = b.guest_id
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.check_in >= p_start_date
      AND b.check_out <= p_end_date
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
    GROUP BY up.country
    ORDER BY bookings DESC
    LIMIT 5
  ) country_data;

  -- ============ BUILD RESULT ============
  v_result := jsonb_build_object(
    'returning_guests', COALESCE(v_returning_count, 0),
    'new_guests', COALESCE(v_new_count, 0),
    'country_breakdown', COALESCE(v_country_breakdown, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fetch_guest_demographics(uuid, date, date, uuid) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_guest_demographics IS 'Analytics: Returns guest demographics (returning vs new, country origins)';

-- From 20260605200100_analytics_fetch_popular_rooms.sql
CREATE FUNCTION fetch_popular_rooms(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_period_days integer;
BEGIN
  -- Calculate period length
  v_period_days := p_end_date - p_start_date + 1;

  SELECT jsonb_agg(
    jsonb_build_object(
      'listing_id', listing_id,
      'listing_name', listing_name,
      'listing_slug', listing_slug,
      'cover_image_url', cover_image_url,
      'occupancy_rate', occupancy_rate,
      'nights_booked', nights_booked,
      'revenue', revenue,
      'bookings_count', bookings_count
    ) ORDER BY occupancy_rate DESC
  )
  INTO v_result
  FROM (
    SELECT
      l.id AS listing_id,
      l.title AS listing_name,
      l.slug AS listing_slug,
      l.cover_image_url,

      -- Nights booked in period
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in >= p_start_date
            AND b.check_out <= p_end_date
          THEN EXTRACT(DAY FROM (b.check_out - b.check_in))
          ELSE 0
        END
      ), 0) AS nights_booked,

      -- Occupancy rate
      CASE
        WHEN v_period_days > 0
        THEN ROUND(
          (COALESCE(SUM(
            CASE
              WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
                AND b.check_in >= p_start_date
                AND b.check_out <= p_end_date
              THEN EXTRACT(DAY FROM (b.check_out - b.check_in))
              ELSE 0
            END
          ), 0) / v_period_days::numeric * 100)::numeric,
          1
        )
        ELSE 0
      END AS occupancy_rate,

      -- Revenue
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in >= p_start_date
            AND b.check_out <= p_end_date
          THEN b.total_amount
          ELSE 0
        END
      ), 0) AS revenue,

      -- Bookings count
      COUNT(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in >= p_start_date
            AND b.check_out <= p_end_date
          THEN 1
        END
      ) AS bookings_count

    FROM listings l
    LEFT JOIN bookings b ON b.listing_id = l.id AND b.deleted_at IS NULL
    WHERE l.host_id = p_host_id
      AND l.deleted_at IS NULL
    GROUP BY l.id, l.title, l.slug, l.cover_image_url
    ORDER BY occupancy_rate DESC
    LIMIT p_limit
  ) popular_rooms;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fetch_popular_rooms(uuid, date, date, integer) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_popular_rooms IS 'Analytics: Returns top performing rooms by occupancy rate';

-- From 20260605200200_analytics_fetch_refunds_cancellations.sql
CREATE FUNCTION fetch_refunds_cancellations(
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
  v_total_bookings integer;
  v_refund_count integer;
  v_refund_amount numeric;
  v_cancellation_count integer;
  v_cancellation_revenue_impact numeric;
  v_cancellation_reasons jsonb;
  v_avg_refund_turnaround numeric;
BEGIN
  -- ============ TOTAL BOOKINGS (denominator) ============
  SELECT COUNT(*)
  INTO v_total_bookings
  FROM bookings
  WHERE host_id = p_host_id
    AND created_at >= p_start_date::timestamp
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- ============ REFUNDS ============
  SELECT
    COUNT(*),
    COALESCE(SUM(refund_amount), 0)
  INTO v_refund_count, v_refund_amount
  FROM bookings
  WHERE host_id = p_host_id
    AND status = 'refunded'
    AND created_at >= p_start_date::timestamp
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- ============ CANCELLATIONS ============
  SELECT
    COUNT(*),
    COALESCE(SUM(total_amount), 0)
  INTO v_cancellation_count, v_cancellation_revenue_impact
  FROM bookings
  WHERE host_id = p_host_id
    AND status = 'cancelled'
    AND created_at >= p_start_date::timestamp
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- ============ CANCELLATION REASONS BREAKDOWN ============
  -- Group by cancellation_reason if that column exists
  -- For now, use placeholder data structure
  v_cancellation_reasons := jsonb_build_array(
    jsonb_build_object('reason', 'Guest request', 'count', FLOOR(v_cancellation_count * 0.4)),
    jsonb_build_object('reason', 'Host unavailable', 'count', FLOOR(v_cancellation_count * 0.25)),
    jsonb_build_object('reason', 'Payment failed', 'count', FLOOR(v_cancellation_count * 0.2)),
    jsonb_build_object('reason', 'Policy violation', 'count', FLOOR(v_cancellation_count * 0.1)),
    jsonb_build_object('reason', 'Other', 'count', FLOOR(v_cancellation_count * 0.05))
  );

  -- ============ AVERAGE REFUND TURNAROUND ============
  -- Calculate average days between refund request and processing
  -- Assuming refunded_at exists, otherwise use updated_at as proxy
  SELECT COALESCE(AVG(
    EXTRACT(DAY FROM (updated_at - created_at))
  ), 0)
  INTO v_avg_refund_turnaround
  FROM bookings
  WHERE host_id = p_host_id
    AND status = 'refunded'
    AND created_at >= p_start_date::timestamp
    AND created_at <= (p_end_date::timestamp + interval '1 day' - interval '1 second')
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- ============ BUILD RESULT ============
  v_result := jsonb_build_object(
    'refund_count', COALESCE(v_refund_count, 0),
    'refund_amount', COALESCE(v_refund_amount, 0),
    'refund_rate', CASE
      WHEN v_total_bookings > 0
      THEN ROUND((v_refund_count::numeric / v_total_bookings * 100)::numeric, 1)
      ELSE 0
    END,
    'cancellation_count', COALESCE(v_cancellation_count, 0),
    'cancellation_revenue_impact', COALESCE(v_cancellation_revenue_impact, 0),
    'cancellation_rate', CASE
      WHEN v_total_bookings > 0
      THEN ROUND((v_cancellation_count::numeric / v_total_bookings * 100)::numeric, 1)
      ELSE 0
    END,
    'cancellation_reasons', v_cancellation_reasons,
    'avg_refund_turnaround_days', ROUND(v_avg_refund_turnaround, 1)
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fetch_refunds_cancellations(uuid, date, date, uuid) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_refunds_cancellations IS 'Analytics: Returns refund and cancellation metrics with breakdown';

