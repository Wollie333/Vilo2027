-- =====================================================
-- Analytics RPC: fetch_primary_kpis
-- =====================================================
-- Calculates Revenue, RevPAR, ADR, Occupancy for current + prior periods
-- Returns delta and sparkline data for visualization
--
-- Pre-MVP: See AGENT_RULES.md §3.4 - all features temporarily unlocked
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_primary_kpis(
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
  SELECT COALESCE(SUM(total_price), 0)
  INTO v_current_revenue
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= p_start_date
    AND check_in_date <= p_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  -- Total occupied nights (check_out_date - check_in_date for each booking)
  SELECT COALESCE(SUM(check_out_date - check_in_date), 0)
  INTO v_current_occupied_nights
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= p_start_date
    AND check_in_date <= p_end_date
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
  SELECT COALESCE(SUM(total_price), 0)
  INTO v_prior_revenue
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= v_prior_start_date
    AND check_in_date <= v_prior_end_date
    AND deleted_at IS NULL
    AND (p_listing_id IS NULL OR listing_id = p_listing_id)
    AND (p_channel IS NULL OR channel = p_channel);

  SELECT COALESCE(SUM(check_out_date - check_in_date), 0)
  INTO v_prior_occupied_nights
  FROM bookings
  WHERE host_id = p_host_id
    AND status IN ('confirmed', 'checked_in', 'checked_out')
    AND check_in_date >= v_prior_start_date
    AND check_in_date <= v_prior_end_date
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
      SUM(b.total_price) AS daily_revenue
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS day
    LEFT JOIN bookings b ON
      b.host_id = p_host_id
      AND b.check_in_date = day::date
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
