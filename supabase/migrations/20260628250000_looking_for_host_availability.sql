-- Migration: Check host availability for Looking For posts
-- Returns availability status for a host's properties for given date range

CREATE OR REPLACE FUNCTION public.check_host_availability_for_dates(
  p_host_id UUID,
  p_check_in DATE,
  p_check_out DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_count INT := 0;
  v_total_count INT := 0;
  v_first_available_property UUID;
  v_first_available_name TEXT;
BEGIN
  -- If no dates provided, return unknown status
  IF p_check_in IS NULL OR p_check_out IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'unknown',
      'available_count', 0,
      'total_count', 0,
      'message', 'No dates specified'
    );
  END IF;

  -- Count total active properties for this host
  SELECT COUNT(*) INTO v_total_count
  FROM properties
  WHERE host_id = p_host_id
    AND is_active = TRUE
    AND deleted_at IS NULL;

  IF v_total_count = 0 THEN
    RETURN jsonb_build_object(
      'status', 'no_properties',
      'available_count', 0,
      'total_count', 0,
      'message', 'No active properties'
    );
  END IF;

  -- Check each property for availability
  SELECT
    COUNT(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM blocked_dates bd
      WHERE bd.property_id = p.id
        AND bd.date >= p_check_in
        AND bd.date < p_check_out
    )),
    (SELECT id FROM properties p2
     WHERE p2.host_id = p_host_id
       AND p2.is_active = TRUE
       AND p2.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM blocked_dates bd2
         WHERE bd2.property_id = p2.id
           AND bd2.date >= p_check_in
           AND bd2.date < p_check_out
       )
     LIMIT 1),
    (SELECT name FROM properties p3
     WHERE p3.host_id = p_host_id
       AND p3.is_active = TRUE
       AND p3.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM blocked_dates bd3
         WHERE bd3.property_id = p3.id
           AND bd3.date >= p_check_in
           AND bd3.date < p_check_out
       )
     LIMIT 1)
  INTO v_available_count, v_first_available_property, v_first_available_name
  FROM properties p
  WHERE p.host_id = p_host_id
    AND p.is_active = TRUE
    AND p.deleted_at IS NULL;

  -- Determine status
  IF v_available_count = 0 THEN
    RETURN jsonb_build_object(
      'status', 'unavailable',
      'available_count', 0,
      'total_count', v_total_count,
      'message', 'All properties booked'
    );
  ELSIF v_available_count = v_total_count THEN
    RETURN jsonb_build_object(
      'status', 'available',
      'available_count', v_available_count,
      'total_count', v_total_count,
      'first_available_property_id', v_first_available_property,
      'first_available_property_name', v_first_available_name,
      'message', 'All properties available'
    );
  ELSE
    RETURN jsonb_build_object(
      'status', 'partial',
      'available_count', v_available_count,
      'total_count', v_total_count,
      'first_available_property_id', v_first_available_property,
      'first_available_property_name', v_first_available_name,
      'message', v_available_count || ' of ' || v_total_count || ' available'
    );
  END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.check_host_availability_for_dates(UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.check_host_availability_for_dates IS
  'Checks if a host has any available properties for a given date range';
