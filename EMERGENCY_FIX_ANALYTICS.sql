-- ============================================================================
-- EMERGENCY FIX: Run this in Supabase SQL Editor
-- ============================================================================
-- This fixes ALL analytics functions to match your ACTUAL database schema
--
-- Copy-paste this entire file into Supabase SQL Editor and click "Run"
-- ============================================================================

-- First, add the channel column if it doesn't exist
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS channel text DEFAULT 'direct';
CREATE INDEX IF NOT EXISTS idx_bookings_channel ON bookings(channel);

-- Add country to user_profiles if it doesn't exist
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS country text;
CREATE INDEX IF NOT EXISTS idx_user_profiles_country ON user_profiles(country);

-- Drop all broken analytics functions
DROP FUNCTION IF EXISTS fetch_primary_kpis(uuid, date, date, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS fetch_secondary_metrics(uuid, date, date, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS fetch_revenue_trend(uuid, date, date, text, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS fetch_channel_mix(uuid, date, date, uuid) CASCADE;
DROP FUNCTION IF EXISTS fetch_conversion_funnel(uuid, date, date, uuid) CASCADE;
DROP FUNCTION IF EXISTS fetch_time_to_book(uuid, date, date, uuid) CASCADE;
DROP FUNCTION IF EXISTS fetch_property_performance(uuid, date, date, text, text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS fetch_regional_breakdown(uuid, date, date, uuid) CASCADE;
DROP FUNCTION IF EXISTS fetch_seasonality_heatmap(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS fetch_guest_demographics(uuid, date, date, uuid) CASCADE;
DROP FUNCTION IF EXISTS fetch_popular_rooms(uuid, date, date, integer) CASCADE;
DROP FUNCTION IF EXISTS fetch_refunds_cancellations(uuid, date, date, uuid) CASCADE;

-- For now, create stub functions that return empty data
-- This will make the dashboard load without errors
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
    'revenue', jsonb_build_object('current', 0, 'prior', 0, 'delta', 0, 'sparkline', '[]'::jsonb),
    'revpar', jsonb_build_object('current', 0, 'prior', 0, 'delta', 0),
    'adr', jsonb_build_object('current', 0, 'prior', 0, 'delta', 0),
    'occupancy', jsonb_build_object('current', 0, 'prior', 0, 'delta', 0)
  );
$$;

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

CREATE FUNCTION fetch_revenue_trend(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_grouping text,
  p_listing_id uuid DEFAULT NULL,
  p_channel text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'current', '[]'::jsonb,
    'prior', '[]'::jsonb
  );
$$;

CREATE FUNCTION fetch_channel_mix(
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
  SELECT '[]'::jsonb;
$$;

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

CREATE FUNCTION fetch_property_performance(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_sort_by text DEFAULT 'revenue',
  p_sort_direction text DEFAULT 'desc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'properties', '[]'::jsonb,
    'total_count', 0
  );
$$;

CREATE FUNCTION fetch_regional_breakdown(
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
  SELECT '[]'::jsonb;
$$;

CREATE FUNCTION fetch_seasonality_heatmap(
  p_host_id uuid,
  p_year integer
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT '[]'::jsonb;
$$;

CREATE FUNCTION fetch_guest_demographics(
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
    'returning_guests', 0,
    'new_guests', 0,
    'returning_percentage', 0,
    'origins', '[]'::jsonb
  );
$$;

CREATE FUNCTION fetch_popular_rooms(
  p_host_id uuid,
  p_start_date date,
  p_end_date date,
  p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT '[]'::jsonb;
$$;

CREATE FUNCTION fetch_refunds_cancellations(
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
    'cancellations', 0,
    'cancellation_rate', 0,
    'refunds', 0,
    'refund_amount', 0,
    'refund_rate', 0,
    'reasons', '[]'::jsonb,
    'avg_turnaround_days', 0
  );
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fetch_primary_kpis(uuid, date, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_secondary_metrics(uuid, date, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_revenue_trend(uuid, date, date, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_channel_mix(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_conversion_funnel(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_time_to_book(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_property_performance(uuid, date, date, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_regional_breakdown(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_seasonality_heatmap(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_guest_demographics(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_popular_rooms(uuid, date, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_refunds_cancellations(uuid, date, date, uuid) TO authenticated;

-- Done! These stub functions will return empty data but the dashboard will load
-- You can now work on fixing the functions one by one to return real data
