-- Seed: Looking For Test Data
-- Creates test Looking For posts for testing the quote flow.
-- Uses existing users/hosts or creates mock data if needed.

DO $$
DECLARE
  v_host_id uuid;
  v_guest_id uuid;
  v_post_id uuid;
  v_guest_name text;
BEGIN
  -- Find an existing host (this will be the host who can respond)
  SELECT id INTO v_host_id FROM hosts WHERE deleted_at IS NULL LIMIT 1;

  IF v_host_id IS NULL THEN
    RAISE NOTICE 'No host found - skipping Looking For seed';
    RETURN;
  END IF;

  -- Find a user who is NOT this host (to be the guest)
  -- First try to find a user who doesn't have a host record
  SELECT up.id, up.full_name INTO v_guest_id, v_guest_name
  FROM user_profiles up
  WHERE up.id NOT IN (SELECT user_id FROM hosts WHERE deleted_at IS NULL)
    AND up.full_name IS NOT NULL
  LIMIT 1;

  -- If no non-host user found, use the host's own user (for testing)
  IF v_guest_id IS NULL THEN
    SELECT user_id INTO v_guest_id FROM hosts WHERE id = v_host_id;
    SELECT full_name INTO v_guest_name FROM user_profiles WHERE id = v_guest_id;
  END IF;

  IF v_guest_id IS NULL THEN
    RAISE NOTICE 'No user found - skipping Looking For seed';
    RETURN;
  END IF;

  RAISE NOTICE 'Creating Looking For posts for guest: % (%)', v_guest_name, v_guest_id;

  -- Post 1: Accommodation request with dates
  v_post_id := gen_random_uuid();
  INSERT INTO looking_for_posts (
    id, guest_id, title, description, category,
    check_in_date, check_out_date, adults, children, infants,
    location_text, location_region,
    budget_min, budget_max, budget_currency, budget_per,
    is_urgent, is_public, status, view_count, quote_count,
    expires_at, created_at
  ) VALUES (
    v_post_id,
    v_guest_id,
    'Romantic getaway for anniversary',
    'Looking for a cozy place with a great view for our 5th wedding anniversary. Would love somewhere with a jacuzzi or pool. Wine area preferred!',
    'accommodation',
    CURRENT_DATE + 14,
    CURRENT_DATE + 17,
    2, 0, 0,
    'Stellenbosch or Franschhoek',
    'Western Cape',
    2500, 4500, 'ZAR', 'night',
    false, true, 'active', 12, 0,
    NOW() + INTERVAL '30 days',
    NOW() - INTERVAL '2 hours'
  ) ON CONFLICT DO NOTHING;

  -- Post 2: Family holiday request
  v_post_id := gen_random_uuid();
  INSERT INTO looking_for_posts (
    id, guest_id, title, description, category,
    check_in_date, check_out_date, adults, children, infants,
    location_text, location_region,
    budget_min, budget_max, budget_currency, budget_per,
    is_urgent, is_public, status, view_count, quote_count,
    expires_at, created_at
  ) VALUES (
    v_post_id,
    v_guest_id,
    'Family beach holiday - 4 nights',
    'Need a kid-friendly place near the beach for our July school holidays. Must have at least 3 bedrooms. Pool would be great!',
    'accommodation',
    CURRENT_DATE + 30,
    CURRENT_DATE + 34,
    2, 2, 1,
    'Plettenberg Bay or Knysna',
    'Western Cape',
    3000, 6000, 'ZAR', 'night',
    false, true, 'active', 8, 1,
    NOW() + INTERVAL '30 days',
    NOW() - INTERVAL '1 day'
  ) ON CONFLICT DO NOTHING;

  -- Post 3: Urgent corporate event
  v_post_id := gen_random_uuid();
  INSERT INTO looking_for_posts (
    id, guest_id, title, description, category,
    check_in_date, check_out_date, adults, children, infants,
    location_text, location_region,
    budget_min, budget_max, budget_currency, budget_per,
    is_urgent, is_public, status, view_count, quote_count,
    expires_at, created_at
  ) VALUES (
    v_post_id,
    v_guest_id,
    'URGENT: Team building venue needed',
    'Our usual venue cancelled! Need a venue for 25 people for a 2-day team building event. Must have conference facilities and catering options.',
    'venue',
    CURRENT_DATE + 7,
    CURRENT_DATE + 9,
    25, 0, 0,
    'Within 1 hour of Cape Town',
    'Western Cape',
    15000, 30000, 'ZAR', 'total',
    true, true, 'active', 45, 3,
    NOW() + INTERVAL '7 days',
    NOW() - INTERVAL '6 hours'
  ) ON CONFLICT DO NOTHING;

  -- Post 4: Wine tasting experience
  v_post_id := gen_random_uuid();
  INSERT INTO looking_for_posts (
    id, guest_id, title, description, category,
    check_in_date, check_out_date, adults, children, infants,
    location_text, location_region,
    budget_min, budget_max, budget_currency, budget_per,
    is_urgent, is_public, status, view_count, quote_count,
    expires_at, created_at
  ) VALUES (
    v_post_id,
    v_guest_id,
    'Private wine tour for 6',
    'Looking for a guided wine tasting experience for a group of 6 friends. Ideally visiting 3-4 estates with lunch included.',
    'experience',
    CURRENT_DATE + 21,
    CURRENT_DATE + 21,
    6, 0, 0,
    'Stellenbosch Wine Route',
    'Western Cape',
    500, 1200, 'ZAR', 'person',
    false, true, 'active', 20, 0,
    NOW() + INTERVAL '30 days',
    NOW() - INTERVAL '3 days'
  ) ON CONFLICT DO NOTHING;

  -- Post 5: No quotes yet - easy opportunity
  v_post_id := gen_random_uuid();
  INSERT INTO looking_for_posts (
    id, guest_id, title, description, category,
    check_in_date, check_out_date, adults, children, infants,
    location_text, location_region,
    budget_min, budget_max, budget_currency, budget_per,
    is_urgent, is_public, status, view_count, quote_count,
    expires_at, created_at
  ) VALUES (
    v_post_id,
    v_guest_id,
    'Quiet countryside retreat - flexible dates',
    'Just need somewhere peaceful to work remotely for a week. Good WiFi essential. Happy to be flexible on exact dates.',
    'accommodation',
    NULL,
    NULL,
    1, 0, 0,
    'Anywhere in Western Cape',
    'Western Cape',
    800, 1500, 'ZAR', 'night',
    false, true, 'active', 5, 0,
    NOW() + INTERVAL '30 days',
    NOW() - INTERVAL '30 minutes'
  ) ON CONFLICT DO NOTHING;

  -- Post 6: Expiring soon
  v_post_id := gen_random_uuid();
  INSERT INTO looking_for_posts (
    id, guest_id, title, description, category,
    check_in_date, check_out_date, adults, children, infants,
    location_text, location_region,
    budget_min, budget_max, budget_currency, budget_per,
    is_urgent, is_public, status, view_count, quote_count,
    expires_at, created_at
  ) VALUES (
    v_post_id,
    v_guest_id,
    'Last minute weekend escape',
    'Need something this weekend! Anywhere nice within 2 hours of Cape Town. Budget flexible for the right place.',
    'accommodation',
    CURRENT_DATE + 2,
    CURRENT_DATE + 4,
    2, 0, 0,
    'Near Cape Town',
    'Western Cape',
    2000, 5000, 'ZAR', 'night',
    true, true, 'active', 30, 2,
    NOW() + INTERVAL '36 hours',
    NOW() - INTERVAL '2 days'
  ) ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Looking For test data created successfully!';
END $$;
