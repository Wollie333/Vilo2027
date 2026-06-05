-- Fix stub functions to match expected structure

DROP FUNCTION IF EXISTS fetch_primary_kpis(uuid, date, date, uuid, text);
DROP FUNCTION IF EXISTS fetch_secondary_metrics(uuid, date, date, uuid, text);
DROP FUNCTION IF EXISTS fetch_conversion_funnel(uuid, date, date, uuid);
DROP FUNCTION IF EXISTS fetch_time_to_book(uuid, date, date, uuid);

-- fetch_primary_kpis with correct structure
CREATE FUNCTION fetch_primary_kpis(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_listing_id uuid DEFAULT NULL,
  p_channel text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'revenue', jsonb_build_object(
      'current', 0,
      'prior', 0,
      'delta', 0,
      'sparkline', '[]'::jsonb
    ),
    'revpar', jsonb_build_object(
      'current', 0,
      'prior', 0,
      'delta', 0
    ),
    'adr', jsonb_build_object(
      'current', 0,
      'prior', 0,
      'delta', 0
    ),
    'occupancy', jsonb_build_object(
      'current', 0,
      'prior', 0,
      'delta', 0,
      'occupied_nights', 0,
      'available_nights', 0
    )
  );
$$;

-- fetch_secondary_metrics with correct structure
CREATE FUNCTION fetch_secondary_metrics(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_listing_id uuid DEFAULT NULL,
  p_channel text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'net_value', 0,
    'commission_saved', 0,
    'avg_rating', 0,
    'cancellation_rate', 0,
    'refund_rate', 0,
    'quotes_sent', 0,
    'acceptance_rate', 0,
    'listing_views', 0,
    'avg_session', 0
  );
$$;

-- fetch_conversion_funnel with correct structure
CREATE FUNCTION fetch_conversion_funnel(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_listing_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'views', 0,
    'inquiries', 0,
    'quotes', 0,
    'bookings', 0,
    'views_to_inquiries', 0,
    'inquiries_to_quotes', 0,
    'quotes_to_bookings', 0
  );
$$;

-- fetch_time_to_book with correct structure
CREATE FUNCTION fetch_time_to_book(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_listing_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'median_days', 0,
    'inquiry_to_quote_days', 0,
    'quote_to_booking_days', 0,
    'touchpoints', 0,
    'avg_session_seconds', 0
  );
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fetch_primary_kpis(uuid, date, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_secondary_metrics(uuid, date, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_conversion_funnel(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_time_to_book(uuid, date, date, uuid) TO authenticated;
