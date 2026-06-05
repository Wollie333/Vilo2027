/**
 * Test Analytics RPC Functions
 *
 * This script tests if the analytics RPC functions exist and can be called.
 * Run with: node scripts/test-analytics-rpcs.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zlcivjgvtyeaszikqleu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.argv[2];

if (!supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not found');
  console.log('\nUsage:');
  console.log('  node scripts/test-analytics-rpcs.mjs YOUR_ANON_KEY');
  console.log('\nOr set NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  console.log('\nGet your anon key from:');
  console.log('  https://supabase.com/dashboard/project/zlcivjgvtyeaszikqleu/settings/api');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Testing Analytics RPC Functions...\n');

// Test date range
const startDate = '2024-01-01';
const endDate = '2024-12-31';

// List of functions to test
const functions = [
  'fetch_primary_kpis',
  'fetch_secondary_metrics',
  'fetch_revenue_trend',
  'fetch_channel_mix',
  'fetch_conversion_funnel',
  'fetch_time_to_book',
  'fetch_regional_breakdown',
  'fetch_seasonality_heatmap',
  'fetch_guest_demographics',
  'fetch_popular_rooms',
  'fetch_refunds_cancellations',
];

// Test with a dummy UUID (will fail on RLS but tells us if function exists)
const testHostId = '00000000-0000-0000-0000-000000000000';

console.log('Testing with dummy host_id (expecting "function does not exist" or RLS error):\n');

for (const funcName of functions) {
  try {
    const params = {
      p_host_id: testHostId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_listing_id: null,
      p_channel: null,
    };

    // Adjust params for specific functions
    if (funcName === 'fetch_seasonality_heatmap') {
      delete params.p_start_date;
      delete params.p_end_date;
      params.p_year = 2024;
    } else if (funcName === 'fetch_popular_rooms') {
      params.p_limit = 5;
    }

    const { data, error } = await supabase.rpc(funcName, params);

    if (error) {
      // Check error code
      if (error.code === '42883') {
        console.log(`❌ ${funcName}: FUNCTION DOES NOT EXIST`);
      } else if (error.message.includes('permission denied') || error.message.includes('RLS')) {
        console.log(`✅ ${funcName}: exists (RLS blocked as expected)`);
      } else {
        console.log(`⚠️  ${funcName}: ${error.message}`);
      }
    } else {
      console.log(`✅ ${funcName}: exists and returned data`);
    }
  } catch (err) {
    console.log(`❌ ${funcName}: ${err.message}`);
  }
}

console.log('\n📝 If functions show as "FUNCTION DOES NOT EXIST", run:');
console.log('   cd supabase && npx supabase db push --linked --include-all');
