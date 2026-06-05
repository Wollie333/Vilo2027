-- =====================================================
-- Analytics RPC: fetch_channel_mix
-- =====================================================
-- Returns booking revenue breakdown by channel
-- For pie chart visualization
--
-- Pre-MVP: See AGENT_RULES.md §3.4 - all features temporarily unlocked
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_channel_mix(
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
      SUM(b.total_price) AS revenue,
      COUNT(*) AS booking_count,
      SUM(SUM(b.total_price)) OVER () AS total_revenue
    FROM bookings b
    WHERE b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.check_in_date >= p_start_date
      AND b.check_in_date <= p_end_date
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
