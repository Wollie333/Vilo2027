-- =====================================================
-- Analytics RPC: fetch_popular_rooms
-- =====================================================
-- Returns top performing rooms/listings:
-- - Room name, thumbnail
-- - Occupancy rate
-- - Nights booked
-- - Revenue generated
-- - Sorted by occupancy rate descending
--
-- Pre-MVP: See AGENT_RULES.md §3.4 - all features temporarily unlocked
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_popular_rooms(
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
            AND b.check_in_date >= p_start_date
            AND b.check_out_date <= p_end_date
          THEN EXTRACT(DAY FROM (b.check_out_date - b.check_in_date))
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
                AND b.check_in_date >= p_start_date
                AND b.check_out_date <= p_end_date
              THEN EXTRACT(DAY FROM (b.check_out_date - b.check_in_date))
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
            AND b.check_in_date >= p_start_date
            AND b.check_out_date <= p_end_date
          THEN b.total_amount
          ELSE 0
        END
      ), 0) AS revenue,

      -- Bookings count
      COUNT(
        CASE
          WHEN b.status IN ('confirmed', 'checked_in', 'checked_out')
            AND b.check_in_date >= p_start_date
            AND b.check_out_date <= p_end_date
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
