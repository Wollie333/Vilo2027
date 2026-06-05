-- =====================================================
-- Analytics RPC: fetch_property_performance
-- =====================================================
-- Returns performance metrics for each listing/property:
-- - Revenue (current + prior + delta)
-- - Occupancy % (current + prior + delta)
-- - Nights booked
-- - ADR (Average Daily Rate)
-- - Sparkline data (last 30 days revenue)
--
-- Supports sorting and pagination for large portfolios
-- Pre-MVP: See AGENT_RULES.md §3.4 - all features temporarily unlocked
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_property_performance(
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
            AND b.check_in_date >= p_start_date
            AND b.check_out_date <= p_end_date
          THEN b.total_amount
          ELSE 0
        END
      ), 0) AS revenue,

      -- Current period nights booked
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in_date >= p_start_date
            AND b.check_out_date <= p_end_date
          THEN EXTRACT(DAY FROM (b.check_out_date - b.check_in_date))
          ELSE 0
        END
      ), 0) AS nights_booked,

      -- Current period bookings count
      COUNT(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in_date >= p_start_date
            AND b.check_out_date <= p_end_date
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
            AND b.check_in_date >= (p_start_date - v_period_days)
            AND b.check_out_date <= (p_end_date - v_period_days)
          THEN b.total_amount
          ELSE 0
        END
      ), 0) AS revenue_prior,

      -- Prior period nights booked
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in_date >= (p_start_date - v_period_days)
            AND b.check_out_date <= (p_end_date - v_period_days)
          THEN EXTRACT(DAY FROM (b.check_out_date - b.check_in_date))
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
        b.check_in_date AS booking_date,
        SUM(b.total_amount) AS revenue
      FROM bookings b
      WHERE b.host_id = p_host_id
        AND b.status IN ('confirmed', 'checked_in', 'checked_out')
        AND b.check_in_date >= (p_end_date - 29)
        AND b.check_in_date <= p_end_date
        AND b.deleted_at IS NULL
      GROUP BY b.listing_id, b.check_in_date
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
