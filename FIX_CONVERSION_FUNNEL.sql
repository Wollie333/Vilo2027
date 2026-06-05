-- Fix fetch_conversion_funnel to return correct structure

DROP FUNCTION IF EXISTS fetch_conversion_funnel(uuid, date, date, uuid);

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
    'conversion_rates', jsonb_build_object(
      'views_to_inquiries', 0,
      'inquiries_to_quotes', 0,
      'quotes_to_bookings', 0,
      'views_to_bookings', 0
    )
  );
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fetch_conversion_funnel(uuid, date, date, uuid) TO authenticated;
