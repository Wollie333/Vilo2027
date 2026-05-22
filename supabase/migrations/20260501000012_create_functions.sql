-- Migration: Database Functions & RPCs (v1.0)
-- Per supabase_database.md §16

-- ─── check_feature_permission ─────────────────────────────────
CREATE OR REPLACE FUNCTION check_feature_permission(
  p_host_id     uuid,
  p_feature_key text
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  -- 1. Per-host override (most specific, checked first)
  SELECT jsonb_build_object(
    'is_enabled', hfo.is_enabled,
    'limit_value', hfo.limit_value,
    'source', 'override'
  ) INTO v_result
  FROM host_feature_overrides hfo
  WHERE hfo.host_id = p_host_id
    AND hfo.feature_key = p_feature_key
    AND (hfo.expires_at IS NULL OR hfo.expires_at > now())
  LIMIT 1;

  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  -- 2. Plan-level feature (fallback)
  SELECT jsonb_build_object(
    'is_enabled', pf.is_enabled,
    'limit_value', pf.limit_value,
    'source', 'plan'
  ) INTO v_result
  FROM plan_features pf
  JOIN subscriptions s ON s.plan = pf.plan
  WHERE s.host_id = p_host_id
    AND s.status IN ('trialing','active')
    AND pf.feature_key = p_feature_key
  LIMIT 1;

  -- 3. Default: disabled
  RETURN COALESCE(v_result,
    jsonb_build_object('is_enabled', false, 'limit_value', null, 'source', 'default'));
END;
$$;

-- ─── get_listing_availability ─────────────────────────────────
CREATE OR REPLACE FUNCTION get_listing_availability(
  p_listing_id uuid,
  p_year       integer,
  p_month      integer
)
RETURNS date[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY_AGG(date ORDER BY date)
  FROM blocked_dates
  WHERE listing_id = p_listing_id
    AND EXTRACT(YEAR  FROM date) = p_year
    AND EXTRACT(MONTH FROM date) = p_month;
$$;

-- ─── calculate_booking_price ──────────────────────────────────
CREATE OR REPLACE FUNCTION calculate_booking_price(
  p_listing_id uuid,
  p_check_in   date,
  p_check_out  date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_listing      listings%ROWTYPE;
  v_current_date date;
  v_night_price  numeric;
  v_base_total   numeric := 0;
  v_nights       integer;
  v_dow          integer;
BEGIN
  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;
  v_nights := p_check_out - p_check_in;
  v_current_date := p_check_in;

  WHILE v_current_date < p_check_out LOOP
    SELECT price INTO v_night_price
    FROM listing_seasonal_pricing
    WHERE listing_id = p_listing_id
      AND v_current_date BETWEEN start_date AND end_date
    ORDER BY start_date DESC LIMIT 1;

    IF v_night_price IS NULL THEN
      v_dow := EXTRACT(DOW FROM v_current_date);
      IF v_dow IN (0, 6) AND v_listing.weekend_price IS NOT NULL THEN
        v_night_price := v_listing.weekend_price;
      ELSE
        v_night_price := v_listing.base_price;
      END IF;
    END IF;

    v_base_total := v_base_total + v_night_price;
    v_current_date := v_current_date + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'nights',       v_nights,
    'base_total',   v_base_total,
    'cleaning_fee', COALESCE(v_listing.cleaning_fee, 0),
    'total',        v_base_total + COALESCE(v_listing.cleaning_fee, 0),
    'currency',     v_listing.currency
  );
END;
$$;

-- ─── recalculate_listing_ranking ──────────────────────────────
CREATE OR REPLACE FUNCTION recalculate_listing_ranking(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_weights      jsonb;
  v_avg_rating   numeric;
  v_review_count integer;
  v_review_norm  numeric;
  v_profile      numeric;
  v_response     numeric;
  v_plan_boost   numeric;
  v_score        numeric;
BEGIN
  SELECT value INTO v_weights FROM platform_settings WHERE key = 'ranking_weights';

  SELECT avg_rating, total_reviews INTO v_avg_rating, v_review_count
  FROM listings WHERE id = p_listing_id;

  v_review_norm := LEAST(1.0, ln(1 + v_review_count) / ln(101));

  SELECT (
    CASE WHEN l.description   IS NOT NULL THEN 0.20 ELSE 0 END +
    CASE WHEN l.city          IS NOT NULL THEN 0.20 ELSE 0 END +
    CASE WHEN (SELECT COUNT(*) FROM listing_photos  WHERE listing_id = l.id) >= 5 THEN 0.30 ELSE 0 END +
    CASE WHEN l.check_in_time IS NOT NULL THEN 0.15 ELSE 0 END +
    CASE WHEN (SELECT COUNT(*) FROM listing_amenities WHERE listing_id = l.id) >= 3 THEN 0.15 ELSE 0 END
  ) INTO v_profile FROM listings l WHERE l.id = p_listing_id;

  SELECT h.response_rate INTO v_response
  FROM listings l JOIN hosts h ON h.id = l.host_id WHERE l.id = p_listing_id;

  SELECT CASE s.plan
    WHEN 'free'     THEN 0.0 WHEN 'basic'    THEN 0.3
    WHEN 'pro'      THEN 0.6 WHEN 'business' THEN 1.0 ELSE 0.0 END
  INTO v_plan_boost
  FROM listings l
  JOIN hosts h ON h.id = l.host_id
  JOIN subscriptions s ON s.host_id = h.id AND s.status IN ('trialing','active')
  WHERE l.id = p_listing_id;

  v_score :=
    (COALESCE(v_avg_rating / 5.0, 0) * (v_weights->>'rating')::numeric)   +
    (COALESCE(v_review_norm, 0)       * (v_weights->>'reviews')::numeric)  +
    (COALESCE(v_profile, 0)           * (v_weights->>'profile')::numeric)  +
    (COALESCE(v_response, 0)          * (v_weights->>'response')::numeric) +
    (COALESCE(v_plan_boost, 0)        * (v_weights->>'plan')::numeric);

  INSERT INTO listing_rankings (
    listing_id, ranking_score, component_rating, component_reviews,
    component_profile, component_response_rate, component_plan_boost, last_calculated
  ) VALUES (
    p_listing_id, v_score,
    COALESCE(v_avg_rating / 5.0, 0), v_review_norm, v_profile,
    COALESCE(v_response, 0), COALESCE(v_plan_boost, 0), now()
  )
  ON CONFLICT (listing_id) DO UPDATE SET
    ranking_score           = EXCLUDED.ranking_score,
    component_rating        = EXCLUDED.component_rating,
    component_reviews       = EXCLUDED.component_reviews,
    component_profile       = EXCLUDED.component_profile,
    component_response_rate = EXCLUDED.component_response_rate,
    component_plan_boost    = EXCLUDED.component_plan_boost,
    last_calculated         = now();
END;
$$;

-- ─── get_host_inbox_stats ─────────────────────────────────────
CREATE OR REPLACE FUNCTION get_host_inbox_stats(p_host_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'total_unread', SUM(unread_host),
    'open_threads', COUNT(*) FILTER (WHERE status = 'open'),
    'enquiries',    COUNT(*) FILTER (WHERE is_enquiry = true AND status = 'open')
  )
  FROM conversations WHERE host_id = p_host_id;
$$;
