-- =====================================================
-- Analytics RPC: fetch_seasonality_heatmap
-- =====================================================
-- Returns revenue matrix: provinces × months
-- Shows seasonal patterns across regions
--
-- Output structure:
-- {
--   "months": ["Jan", "Feb", "Mar", ...],
--   "provinces": ["Western Cape", "Gauteng", ...],
--   "data": [
--     { "month": "Jan", "Western Cape": 45000, "Gauteng": 32000, ... },
--     { "month": "Feb", "Western Cape": 52000, "Gauteng": 38000, ... },
--     ...
--   ]
-- }
--
-- Pre-MVP: See AGENT_RULES.md §3.4 - all features temporarily unlocked
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_seasonality_heatmap(
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
      AND EXTRACT(YEAR FROM b.check_in_date) = p_year
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
      EXTRACT(MONTH FROM b.check_in_date)::integer AS month_num,
      COALESCE(l.province, 'Unknown') AS province,
      COALESCE(SUM(b.total_amount), 0) AS revenue
    FROM bookings b
    INNER JOIN listings l ON l.id = b.listing_id
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND EXTRACT(YEAR FROM b.check_in_date) = p_year
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
