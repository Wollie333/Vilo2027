-- =====================================================
-- Analytics RPC: fetch_guest_demographics
-- =====================================================
-- Returns guest demographics:
-- - Returning vs new guests (donut chart)
-- - Country origins breakdown (bar chart)
--
-- Pre-MVP: See AGENT_RULES.md §3.4 - all features temporarily unlocked
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_guest_demographics(
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
      AND b.check_in_date >= p_start_date
      AND b.check_out_date <= p_end_date
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
             AND check_in_date >= p_start_date
             AND check_out_date <= p_end_date
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
      AND b.check_in_date >= p_start_date
      AND b.check_out_date <= p_end_date
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
