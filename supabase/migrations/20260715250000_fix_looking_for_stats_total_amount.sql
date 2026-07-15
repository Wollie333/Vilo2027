-- Fix: fetch_looking_for_stats referenced b.total_price, which does not exist on
-- the bookings table (the column is total_amount). This made the RPC raise
-- "column b.total_price does not exist" on every call, so the entire Looking-For
-- analytics section on the host reports page silently failed to load (its data
-- came back null and the section — including the monthly trend — never rendered).
--
-- Only the revenue sub-select was wrong; the rest of the function is unchanged.
-- Recreated in full (never edit an existing migration) with total_amount.

CREATE OR REPLACE FUNCTION public.fetch_looking_for_stats(
  p_host_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date DATE := COALESCE(p_start_date, (DATE_TRUNC('year', CURRENT_DATE))::DATE);
  v_end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
  v_result JSONB;
  v_posts_viewed INT := 0;
  v_quotes_sent INT := 0;
  v_quotes_viewed INT := 0;
  v_quotes_accepted INT := 0;
  v_avg_response_hours NUMERIC := 0;
  v_revenue_from_lf NUMERIC := 0;
  v_regional_breakdown JSONB;
  v_category_breakdown JSONB;
  v_trend_data JSONB;
BEGIN
  -- Get quotes sent to Looking For posts by this host
  SELECT
    COUNT(*) FILTER (WHERE lfr.sent_at IS NOT NULL),
    COUNT(*) FILTER (WHERE lfr.viewed_at IS NOT NULL),
    COUNT(*) FILTER (WHERE q.status = 'accepted'),
    COALESCE(AVG(EXTRACT(EPOCH FROM (lfr.sent_at - lfp.created_at)) / 3600), 0)
  INTO
    v_quotes_sent,
    v_quotes_viewed,
    v_quotes_accepted,
    v_avg_response_hours
  FROM looking_for_responses lfr
  JOIN looking_for_posts lfp ON lfr.post_id = lfp.id
  LEFT JOIN quotes q ON lfr.quote_id = q.id
  WHERE lfr.host_id = p_host_id
    AND lfr.sent_at >= v_start_date
    AND lfr.sent_at <= v_end_date;

  -- Count posts viewed (from looking_for_passes or responses)
  SELECT COUNT(DISTINCT post_id)
  INTO v_posts_viewed
  FROM (
    SELECT post_id FROM looking_for_responses WHERE host_id = p_host_id AND sent_at >= v_start_date
    UNION
    SELECT post_id FROM looking_for_passes WHERE host_id = p_host_id AND passed_at >= v_start_date
  ) combined;

  -- Calculate revenue from Looking For conversions (total_amount, not total_price)
  SELECT COALESCE(SUM(b.total_amount), 0)
  INTO v_revenue_from_lf
  FROM bookings b
  JOIN quotes q ON b.quote_id = q.id
  JOIN looking_for_posts lfp ON q.looking_for_post_id = lfp.id
  WHERE b.host_id = p_host_id
    AND b.status IN ('confirmed', 'checked_in', 'checked_out')
    AND b.created_at >= v_start_date
    AND b.created_at <= v_end_date;

  -- Regional breakdown of posts host has responded to
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'region', region,
      'count', region_count
    ) ORDER BY region_count DESC),
    '[]'::jsonb
  )
  INTO v_regional_breakdown
  FROM (
    SELECT
      COALESCE(lfp.location_region, 'Unspecified') AS region,
      COUNT(*) AS region_count
    FROM looking_for_responses lfr
    JOIN looking_for_posts lfp ON lfr.post_id = lfp.id
    WHERE lfr.host_id = p_host_id
      AND lfr.sent_at >= v_start_date
      AND lfr.sent_at <= v_end_date
    GROUP BY lfp.location_region
    LIMIT 10
  ) sub;

  -- Category breakdown
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'category', category,
      'count', cat_count
    ) ORDER BY cat_count DESC),
    '[]'::jsonb
  )
  INTO v_category_breakdown
  FROM (
    SELECT
      lfp.category,
      COUNT(*) AS cat_count
    FROM looking_for_responses lfr
    JOIN looking_for_posts lfp ON lfr.post_id = lfp.id
    WHERE lfr.host_id = p_host_id
      AND lfr.sent_at >= v_start_date
      AND lfr.sent_at <= v_end_date
    GROUP BY lfp.category
  ) sub;

  -- Monthly trend data
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'month', month_start,
      'quotes_sent', month_quotes,
      'accepted', month_accepted
    ) ORDER BY month_start),
    '[]'::jsonb
  )
  INTO v_trend_data
  FROM (
    SELECT
      DATE_TRUNC('month', lfr.sent_at)::DATE AS month_start,
      COUNT(*) AS month_quotes,
      COUNT(*) FILTER (WHERE q.status = 'accepted') AS month_accepted
    FROM looking_for_responses lfr
    LEFT JOIN quotes q ON lfr.quote_id = q.id
    WHERE lfr.host_id = p_host_id
      AND lfr.sent_at >= v_start_date
      AND lfr.sent_at <= v_end_date
    GROUP BY DATE_TRUNC('month', lfr.sent_at)
  ) sub;

  -- Build result
  v_result := jsonb_build_object(
    'posts_viewed', v_posts_viewed,
    'quotes_sent', v_quotes_sent,
    'quotes_viewed', v_quotes_viewed,
    'quotes_accepted', v_quotes_accepted,
    'acceptance_rate', CASE WHEN v_quotes_sent > 0 THEN ROUND((v_quotes_accepted::NUMERIC / v_quotes_sent * 100)::NUMERIC, 1) ELSE 0 END,
    'view_rate', CASE WHEN v_quotes_sent > 0 THEN ROUND((v_quotes_viewed::NUMERIC / v_quotes_sent * 100)::NUMERIC, 1) ELSE 0 END,
    'avg_response_hours', ROUND(v_avg_response_hours::NUMERIC, 1),
    'revenue_from_looking_for', v_revenue_from_lf,
    'regional_breakdown', v_regional_breakdown,
    'category_breakdown', v_category_breakdown,
    'trend', v_trend_data
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_looking_for_stats(UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.fetch_looking_for_stats IS 'Fetches Looking For statistics for a host within a date range';
