-- Fix analytics functions: total_price → total_amount
--
-- The original analytics migrations incorrectly referenced bookings.total_price
-- but the actual column name is bookings.total_amount. This migration fixes
-- all 4 affected RPC functions by dropping and recreating them with the correct column name.

-- Drop existing functions first to avoid parameter default conflicts
DROP FUNCTION IF EXISTS fetch_primary_kpis(uuid, date, date, uuid, text);
DROP FUNCTION IF EXISTS fetch_secondary_metrics(uuid, date, date, uuid, text);
DROP FUNCTION IF EXISTS fetch_revenue_trend(uuid, date, date, text, uuid, text);
DROP FUNCTION IF EXISTS fetch_channel_mix(uuid, date, date, uuid);

-- ===================================================================
-- FIX 1: fetch_primary_kpis
-- ===================================================================
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
  v_period_length integer;
  v_sparkline_data jsonb;
BEGIN
  -- Calculate period length
  v_period_length := p_end_date - p_start_date;

  -- Current period revenue
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_current_revenue
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= p_start_date
    AND check_in_date <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Prior period revenue
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_prior_revenue
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= (p_start_date - v_period_length)
    AND check_in_date <= (p_end_date - v_period_length)
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Current occupied nights
  SELECT COALESCE(SUM(nights), 0)
  INTO v_current_occupied_nights
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= p_start_date
    AND check_in_date <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Prior occupied nights
  SELECT COALESCE(SUM(nights), 0)
  INTO v_prior_occupied_nights
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= (p_start_date - v_period_length)
    AND check_in_date <= (p_end_date - v_period_length)
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Available nights (total room capacity)
  SELECT COALESCE(SUM((p_end_date - p_start_date) * COALESCE(room_count, 1)), 0)
  INTO v_total_available_nights
  FROM listings
  WHERE host_id = p_host_id
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR id = p_listing_id);

  -- Prior available nights
  v_prior_available_nights := v_total_available_nights;

  -- Calculate ADR (Average Daily Rate)
  v_current_adr := CASE
    WHEN v_current_occupied_nights > 0 THEN v_current_revenue / v_current_occupied_nights
    ELSE 0
  END;

  v_prior_adr := CASE
    WHEN v_prior_occupied_nights > 0 THEN v_prior_revenue / v_prior_occupied_nights
    ELSE 0
  END;

  -- Calculate RevPAR (Revenue Per Available Room)
  v_current_revpar := CASE
    WHEN v_total_available_nights > 0 THEN v_current_revenue / v_total_available_nights
    ELSE 0
  END;

  v_prior_revpar := CASE
    WHEN v_prior_available_nights > 0 THEN v_prior_revenue / v_prior_available_nights
    ELSE 0
  END;

  -- Calculate Occupancy Rate
  v_current_occupancy := CASE
    WHEN v_total_available_nights > 0 THEN (v_current_occupied_nights::numeric / v_total_available_nights) * 100
    ELSE 0
  END;

  v_prior_occupancy := CASE
    WHEN v_prior_available_nights > 0 THEN (v_prior_occupied_nights::numeric / v_prior_available_nights) * 100
    ELSE 0
  END;

  -- Generate sparkline data (30-day daily revenue)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date_bucket::text,
      'value', COALESCE(daily_revenue, 0)
    ) ORDER BY date_bucket
  )
  INTO v_sparkline_data
  FROM (
    SELECT
      gs::date AS date_bucket,
      (SELECT COALESCE(SUM(b.total_amount), 0)
       FROM bookings b
       WHERE b.host_id = p_host_id
         AND b.status IN ('confirmed', 'checked_in', 'checked_out')
         AND b.check_in_date = gs::date
         AND b.deleted_at IS NULL
         AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
         AND (p_channel IS NULL OR b.channel = p_channel)
      ) AS daily_revenue
    FROM generate_series(
      GREATEST(p_start_date, p_end_date - 29),
      p_end_date,
      '1 day'::interval
    ) gs
  ) sparkline_query;

  -- Build result
  v_result := jsonb_build_object(
    'revenue', jsonb_build_object(
      'current', v_current_revenue,
      'prior', v_prior_revenue,
      'delta', CASE WHEN v_prior_revenue > 0 THEN ((v_current_revenue - v_prior_revenue) / v_prior_revenue) * 100 ELSE 0 END,
      'sparkline', COALESCE(v_sparkline_data, '[]'::jsonb)
    ),
    'revpar', jsonb_build_object(
      'current', v_current_revpar,
      'prior', v_prior_revpar,
      'delta', CASE WHEN v_prior_revpar > 0 THEN ((v_current_revpar - v_prior_revpar) / v_prior_revpar) * 100 ELSE 0 END
    ),
    'adr', jsonb_build_object(
      'current', v_current_adr,
      'prior', v_prior_adr,
      'delta', CASE WHEN v_prior_adr > 0 THEN ((v_current_adr - v_prior_adr) / v_prior_adr) * 100 ELSE 0 END
    ),
    'occupancy', jsonb_build_object(
      'current', v_current_occupancy,
      'prior', v_prior_occupancy,
      'delta', v_current_occupancy - v_prior_occupancy
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION fetch_primary_kpis(uuid, date, date, uuid, text) TO authenticated;

COMMENT ON FUNCTION fetch_primary_kpis IS 'Fetches primary KPIs (Revenue, RevPAR, ADR, Occupancy) with prior period comparison and 30-day sparklines. Fixed to use bookings.total_amount instead of total_price.';

-- ===================================================================
-- FIX 2: fetch_secondary_metrics
-- ===================================================================
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
  v_cancellation_rate numeric;
  v_refund_rate numeric;
  v_quotes_sent integer;
  v_acceptance_rate numeric;
  v_listing_views integer;
  v_avg_session numeric;
BEGIN
  -- Net value (total revenue - no commissions on direct bookings)
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_net_value
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= p_start_date
    AND check_in_date <= p_end_date
    AND deleted_at IS NULL
    AND channel = 'direct'
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- Commission saved (15% of direct bookings)
  v_commission_saved := v_net_value * 0.15;

  -- Average rating (from reviews)
  SELECT COALESCE(AVG(rating), 0)
  INTO v_avg_rating
  FROM reviews r
  JOIN bookings b ON b.id = r.booking_id
  WHERE b.host_id = p_host_id
    AND r.created_at >= p_start_date
    AND r.created_at <= p_end_date
    AND (p_listing_id IS NULL OR b.listing_id = p_listing_id);

  -- Cancellation rate
  WITH booking_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
      COUNT(*) AS total
    FROM bookings
    WHERE host_id = p_host_id
      AND check_in_date >= p_start_date
      AND check_in_date <= p_end_date
      AND deleted_at IS NULL
      AND (p_listing_id IS NULL OR listing_id = p_listing_id)
      AND (p_channel IS NULL OR channel = p_channel)
  )
  SELECT CASE WHEN total > 0 THEN (cancelled::numeric / total) * 100 ELSE 0 END
  INTO v_cancellation_rate
  FROM booking_counts;

  -- Refund rate
  WITH refund_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE refund_amount > 0) AS refunded,
      COUNT(*) AS total
    FROM refunds r
    JOIN bookings b ON b.id = r.booking_id
    WHERE b.host_id = p_host_id
      AND r.created_at >= p_start_date
      AND r.created_at <= p_end_date
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
  )
  SELECT CASE WHEN total > 0 THEN (refunded::numeric / total) * 100 ELSE 0 END
  INTO v_refund_rate
  FROM refund_counts;

  -- Quotes sent
  SELECT COUNT(*)
  INTO v_quotes_sent
  FROM quotes q
  WHERE q.host_id = p_host_id
    AND q.created_at >= p_start_date
    AND q.created_at <= p_end_date
    AND (p_listing_id IS NULL OR q.listing_id = p_listing_id);

  -- Acceptance rate (quotes that became bookings)
  WITH quote_conversions AS (
    SELECT
      COUNT(*) FILTER (WHERE b.id IS NOT NULL) AS accepted,
      COUNT(*) AS total
    FROM quotes q
    LEFT JOIN bookings b ON b.quote_id = q.id AND b.deleted_at IS NULL
    WHERE q.host_id = p_host_id
      AND q.created_at >= p_start_date
      AND q.created_at <= p_end_date
      AND (p_listing_id IS NULL OR q.listing_id = p_listing_id)
  )
  SELECT CASE WHEN total > 0 THEN (accepted::numeric / total) * 100 ELSE 0 END
  INTO v_acceptance_rate
  FROM quote_conversions;

  -- Listing views (from listing_view_events if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'listing_view_events') THEN
    SELECT COUNT(*)
    INTO v_listing_views
    FROM listing_view_events lve
    JOIN listings l ON l.id = lve.listing_id
    WHERE l.host_id = p_host_id
      AND lve.viewed_at >= p_start_date
      AND lve.viewed_at <= p_end_date
      AND (p_listing_id IS NULL OR lve.listing_id = p_listing_id);

    -- Average session duration
    SELECT COALESCE(AVG(duration_seconds), 0)
    INTO v_avg_session
    FROM listing_view_events lve
    JOIN listings l ON l.id = lve.listing_id
    WHERE l.host_id = p_host_id
      AND lve.viewed_at >= p_start_date
      AND lve.viewed_at <= p_end_date
      AND lve.duration_seconds > 0
      AND (p_listing_id IS NULL OR lve.listing_id = p_listing_id);
  ELSE
    v_listing_views := 0;
    v_avg_session := 0;
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'net_value', v_net_value,
    'commission_saved', v_commission_saved,
    'avg_rating', v_avg_rating,
    'cancellation_rate', v_cancellation_rate,
    'refund_rate', v_refund_rate,
    'quotes_sent', v_quotes_sent,
    'acceptance_rate', v_acceptance_rate,
    'listing_views', v_listing_views,
    'avg_session', v_avg_session
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_secondary_metrics(uuid, date, date, uuid, text) TO authenticated;

COMMENT ON FUNCTION fetch_secondary_metrics IS 'Fetches secondary metrics (net value, ratings, cancellations, quotes, views). Fixed to use bookings.total_amount.';

-- ===================================================================
-- FIX 3: fetch_revenue_trend
-- ===================================================================
CREATE FUNCTION fetch_revenue_trend(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_grouping text,
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
  v_period_length integer;
  v_current_data jsonb;
  v_prior_data jsonb;
BEGIN
  v_period_length := p_end_date - p_start_date;

  -- Current period trend
  WITH date_buckets AS (
    SELECT
      CASE
        WHEN p_grouping = 'day' THEN gs::date
        WHEN p_grouping = 'week' THEN (date_trunc('week', gs::date))::date
        WHEN p_grouping = 'month' THEN (date_trunc('month', gs::date))::date
        ELSE gs::date
      END AS bucket_date
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) gs
  ),
  revenue_by_bucket AS (
    SELECT
      db.bucket_date,
      COALESCE(SUM(b.total_amount), 0) AS revenue
    FROM date_buckets db
    LEFT JOIN bookings b ON
      CASE
        WHEN p_grouping = 'day' THEN b.check_in_date = db.bucket_date
        WHEN p_grouping = 'week' THEN (date_trunc('week', b.check_in_date))::date = db.bucket_date
        WHEN p_grouping = 'month' THEN (date_trunc('month', b.check_in_date))::date = db.bucket_date
        ELSE b.check_in_date = db.bucket_date
      END
      AND b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
      AND (p_channel IS NULL OR b.channel = p_channel)
    GROUP BY db.bucket_date
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', bucket_date::text,
      'revenue', revenue
    ) ORDER BY bucket_date
  )
  INTO v_current_data
  FROM revenue_by_bucket;

  -- Prior period trend
  WITH date_buckets AS (
    SELECT
      CASE
        WHEN p_grouping = 'day' THEN gs::date
        WHEN p_grouping = 'week' THEN (date_trunc('week', gs::date))::date
        WHEN p_grouping = 'month' THEN (date_trunc('month', gs::date))::date
        ELSE gs::date
      END AS bucket_date
    FROM generate_series(
      p_start_date - v_period_length,
      p_end_date - v_period_length,
      '1 day'::interval
    ) gs
  ),
  revenue_by_bucket AS (
    SELECT
      db.bucket_date,
      COALESCE(SUM(b.total_amount), 0) AS revenue
    FROM date_buckets db
    LEFT JOIN bookings b ON
      CASE
        WHEN p_grouping = 'day' THEN b.check_in_date = db.bucket_date
        WHEN p_grouping = 'week' THEN (date_trunc('week', b.check_in_date))::date = db.bucket_date
        WHEN p_grouping = 'month' THEN (date_trunc('month', b.check_in_date))::date = db.bucket_date
        ELSE b.check_in_date = db.bucket_date
      END
      AND b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
      AND (p_channel IS NULL OR b.channel = p_channel)
    GROUP BY db.bucket_date
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', bucket_date::text,
      'revenue', revenue
    ) ORDER BY bucket_date
  )
  INTO v_prior_data
  FROM revenue_by_bucket;

  v_result := jsonb_build_object(
    'current', COALESCE(v_current_data, '[]'::jsonb),
    'prior', COALESCE(v_prior_data, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_revenue_trend(uuid, date, date, text, uuid, text) TO authenticated;

COMMENT ON FUNCTION fetch_revenue_trend IS 'Fetches revenue trend data grouped by day/week/month with prior period comparison. Fixed to use bookings.total_amount.';

-- ===================================================================
-- FIX 4: fetch_channel_mix
-- ===================================================================
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
  v_total_revenue numeric;
BEGIN
  -- Get total revenue for percentage calculation
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_revenue
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= p_start_date
    AND check_in_date <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id);

  -- Revenue by channel
  SELECT jsonb_agg(
    jsonb_build_object(
      'channel', channel,
      'revenue', revenue,
      'percentage', CASE WHEN v_total_revenue > 0 THEN (revenue / v_total_revenue) * 100 ELSE 0 END,
      'bookings', bookings
    ) ORDER BY revenue DESC
  )
  INTO v_result
  FROM (
    SELECT
      COALESCE(channel, 'direct') AS channel,
      COALESCE(SUM(total_amount), 0) AS revenue,
      COUNT(*) AS bookings
    FROM bookings
    WHERE host_id = p_host_id
      AND status IN ('confirmed', 'checked_in', 'checked_out')
      AND check_in_date >= p_start_date
      AND check_in_date <= p_end_date
      AND deleted_at IS NULL
      AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    GROUP BY channel
  ) channel_data;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_channel_mix(uuid, date, date, uuid) TO authenticated;

COMMENT ON FUNCTION fetch_channel_mix IS 'Fetches revenue breakdown by booking channel (direct, airbnb, booking, etc.). Fixed to use bookings.total_amount.';
