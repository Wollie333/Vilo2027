-- =====================================================
-- Analytics: Regional Breakdown
-- =====================================================
-- Adds listings.province column for regional analysis
-- Creates RPC to fetch revenue by province
--
-- South African Provinces:
-- - Western Cape
-- - Gauteng
-- - KwaZulu-Natal
-- - Eastern Cape
-- - Free State
-- - Limpopo
-- - Mpumalanga
-- - Northern Cape
-- - North West
--
-- Pre-MVP: See AGENT_RULES.md §3.4 - all features temporarily unlocked
-- =====================================================

-- Add province column to listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS province text;

-- Create index for province filtering
CREATE INDEX IF NOT EXISTS idx_listings_province ON listings(province) WHERE deleted_at IS NULL;

-- Comment
COMMENT ON COLUMN listings.province IS 'South African province where the listing is located (e.g. Western Cape, Gauteng, KwaZulu-Natal)';

-- =====================================================
-- RPC: fetch_regional_breakdown
-- =====================================================
-- Returns revenue aggregated by province
-- =====================================================

CREATE OR REPLACE FUNCTION fetch_regional_breakdown(
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
  SELECT jsonb_agg(
    jsonb_build_object(
      'province', province,
      'revenue', revenue,
      'bookings', bookings,
      'percentage', percentage
    ) ORDER BY revenue DESC
  )
  INTO v_result
  FROM (
    SELECT
      COALESCE(l.province, 'Unknown') AS province,
      COALESCE(SUM(b.total_amount), 0) AS revenue,
      COUNT(b.id) AS bookings,
      ROUND(
        (COALESCE(SUM(b.total_amount), 0) / NULLIF(
          (SELECT SUM(total_amount)
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
    FROM listings l
    LEFT JOIN bookings b ON
      b.listing_id = l.id
      AND b.host_id = p_host_id
      AND b.status IN ('confirmed', 'checked_in', 'checked_out')
      AND b.check_in_date >= p_start_date
      AND b.check_out_date <= p_end_date
      AND b.deleted_at IS NULL
      AND (p_listing_id IS NULL OR b.listing_id = p_listing_id)
    WHERE l.host_id = p_host_id
      AND l.deleted_at IS NULL
      AND (p_listing_id IS NULL OR l.id = p_listing_id)
    GROUP BY l.province
    HAVING COALESCE(SUM(b.total_amount), 0) > 0
  ) regional_data;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fetch_regional_breakdown(uuid, date, date, uuid) TO authenticated;

-- Comment
COMMENT ON FUNCTION fetch_regional_breakdown IS 'Analytics: Returns revenue breakdown by province/region';
