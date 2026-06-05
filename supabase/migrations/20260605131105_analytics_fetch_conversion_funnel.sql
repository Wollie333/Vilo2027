-- =====================================================
-- Analytics RPC: fetch_conversion_funnel
-- =====================================================
-- Returns conversion funnel data:
-- Views → Inquiries → Quotes → Bookings
-- With conversion rates at each step
--
-- Pre-MVP: See AGENT_RULES.md §3.4 - all features temporarily unlocked
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_conversion_funnel(
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
