-- =====================================================
-- Analytics RPC: fetch_revenue_trend
-- =====================================================
-- Returns revenue data grouped by day/week/month
-- Includes both current and prior period for comparison
--
-- Pre-MVP: See AGENT_RULES.md §3.4 - all features temporarily unlocked
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_revenue_trend(
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
      SUM(COALESCE(b.total_price, 0)) AS revenue
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS day
    LEFT JOIN bookings b ON
      b.host_id = p_host_id
      AND b.check_in_date = day::date
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
      SUM(COALESCE(b.total_price, 0)) AS revenue
    FROM generate_series(v_prior_start_date, v_prior_end_date, '1 day'::interval) AS day
    LEFT JOIN bookings b ON
      b.host_id = p_host_id
      AND b.check_in_date = day::date
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
