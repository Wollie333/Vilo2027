-- ============================================================================
-- EMERGENCY FIX: Analytics Schema Mismatch
-- ============================================================================
-- Run this in Supabase SQL Editor to fix all analytics functions immediately
--
-- Issues fixed:
-- - total_price → total_amount
-- - check_in_date → check_in
-- - check_out_date → check_out
--
-- THIS WILL DROP AND RECREATE ALL 12 ANALYTICS FUNCTIONS
-- ============================================================================

-- Step 1: Drop all existing analytics functions
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

-- Step 2: Recreate with correct column names
-- (The migration system will handle this via db push)

-- Step 3: Verify functions exist
SELECT
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname LIKE 'fetch_%'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- If you see 0 rows, the functions were dropped successfully
-- Now run: supabase db push --linked --include-all
-- to recreate them with correct schema
