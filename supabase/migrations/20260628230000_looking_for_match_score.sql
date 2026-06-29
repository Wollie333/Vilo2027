-- Migration: Looking For post match score calculation
-- Calculates how well a Looking For post matches a host's properties

CREATE OR REPLACE FUNCTION public.calculate_looking_for_match_score(
  p_post_id UUID,
  p_host_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post RECORD;
  v_best_match_score INT := 0;
  v_best_property_id UUID;
  v_best_property_name TEXT;
  v_match_reasons JSONB := '[]'::jsonb;
  v_property RECORD;
  v_score INT;
  v_reasons JSONB;
BEGIN
  -- Fetch the Looking For post
  SELECT
    id,
    category,
    location_region,
    location_text,
    adults,
    children,
    infants,
    check_in_date,
    check_out_date,
    budget_min,
    budget_max,
    budget_per
  INTO v_post
  FROM looking_for_posts
  WHERE id = p_post_id
    AND status = 'active';

  IF v_post IS NULL THEN
    RETURN jsonb_build_object(
      'score', 0,
      'property_id', NULL,
      'property_name', NULL,
      'reasons', '[]'::jsonb,
      'error', 'Post not found or inactive'
    );
  END IF;

  -- Loop through host's properties and find best match
  FOR v_property IN
    SELECT
      p.id,
      p.name,
      p.city,
      p.region,
      p.max_guests,
      p.base_price,
      p.currency,
      p.booking_mode,
      p.allow_children,
      p.allow_infants
    FROM properties p
    WHERE p.host_id = p_host_id
      AND p.is_active = TRUE
      AND p.deleted_at IS NULL
  LOOP
    v_score := 0;
    v_reasons := '[]'::jsonb;

    -- Region match (30 points)
    IF v_post.location_region IS NOT NULL AND v_property.region IS NOT NULL THEN
      IF LOWER(v_property.region) = LOWER(v_post.location_region) THEN
        v_score := v_score + 30;
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type', 'region', 'label', 'Region match'));
      END IF;
    END IF;

    -- City/location text match (20 points)
    IF v_post.location_text IS NOT NULL AND v_property.city IS NOT NULL THEN
      IF LOWER(v_property.city) LIKE '%' || LOWER(v_post.location_text) || '%'
         OR LOWER(v_post.location_text) LIKE '%' || LOWER(v_property.city) || '%' THEN
        v_score := v_score + 20;
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type', 'location', 'label', 'Location match'));
      END IF;
    END IF;

    -- Guest capacity (25 points)
    DECLARE
      total_guests INT := COALESCE(v_post.adults, 0) + COALESCE(v_post.children, 0);
    BEGIN
      IF v_property.max_guests >= total_guests THEN
        v_score := v_score + 25;
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type', 'capacity', 'label', 'Fits ' || total_guests || ' guests'));
      END IF;
    END;

    -- Children/infants compatibility (10 points)
    IF COALESCE(v_post.children, 0) > 0 THEN
      IF v_property.allow_children = TRUE THEN
        v_score := v_score + 5;
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type', 'children', 'label', 'Child-friendly'));
      END IF;
    END IF;

    IF COALESCE(v_post.infants, 0) > 0 THEN
      IF v_property.allow_infants = TRUE THEN
        v_score := v_score + 5;
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type', 'infants', 'label', 'Infant-friendly'));
      END IF;
    END IF;

    -- Budget compatibility (15 points)
    IF v_post.budget_max IS NOT NULL AND v_property.base_price IS NOT NULL THEN
      IF v_property.base_price <= v_post.budget_max THEN
        v_score := v_score + 15;
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type', 'budget', 'label', 'Within budget'));
      END IF;
    ELSIF v_post.budget_min IS NOT NULL AND v_property.base_price IS NOT NULL THEN
      IF v_property.base_price >= v_post.budget_min THEN
        v_score := v_score + 10;
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('type', 'budget', 'label', 'Meets min budget'));
      END IF;
    END IF;

    -- Update best match if this property scores higher
    IF v_score > v_best_match_score THEN
      v_best_match_score := v_score;
      v_best_property_id := v_property.id;
      v_best_property_name := v_property.name;
      v_match_reasons := v_reasons;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'score', v_best_match_score,
    'max_score', 100,
    'percentage', ROUND((v_best_match_score::NUMERIC / 100) * 100),
    'property_id', v_best_property_id,
    'property_name', v_best_property_name,
    'reasons', v_match_reasons
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.calculate_looking_for_match_score(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.calculate_looking_for_match_score IS 'Calculates how well a Looking For post matches a host''s best property';
