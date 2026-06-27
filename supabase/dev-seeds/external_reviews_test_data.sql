-- Seed: External Reviews Test Data
-- Creates mock external review sources and reviews for testing the feature.
-- Uses the first available host and property, or skips if none exist.

DO $$
DECLARE
  v_host_id uuid;
  v_property_id uuid;
  v_google_source_id uuid;
  v_facebook_source_id uuid;
BEGIN
  -- Find an existing host
  SELECT id INTO v_host_id FROM hosts WHERE deleted_at IS NULL LIMIT 1;

  IF v_host_id IS NULL THEN
    RAISE NOTICE 'No host found - skipping external reviews seed';
    RETURN;
  END IF;

  -- Find an existing property for this host
  SELECT id INTO v_property_id
  FROM properties
  WHERE host_id = v_host_id AND deleted_at IS NULL
  LIMIT 1;

  -- Generate source IDs
  v_google_source_id := gen_random_uuid();
  v_facebook_source_id := gen_random_uuid();

  -- Insert Google source (mock - no real tokens)
  INSERT INTO external_review_sources (
    id, host_id, source, external_account_id, account_name, account_url,
    access_token, refresh_token, token_expires_at,
    is_active, last_synced_at, created_at, updated_at
  ) VALUES (
    v_google_source_id,
    v_host_id,
    'google',
    'accounts/123456789/locations/987654321',
    'Test Business - Google',
    'https://www.google.com/maps/place/?q=place_id:ChIJtest123',
    'v1.mock_encrypted_token', -- Mock encrypted token
    'v1.mock_encrypted_refresh',
    NOW() + INTERVAL '30 days',
    true,
    NOW() - INTERVAL '2 hours',
    NOW(),
    NOW()
  ) ON CONFLICT DO NOTHING;

  -- Insert Facebook source (mock)
  INSERT INTO external_review_sources (
    id, host_id, source, external_account_id, account_name, account_url,
    access_token, token_expires_at,
    is_active, last_synced_at, created_at, updated_at
  ) VALUES (
    v_facebook_source_id,
    v_host_id,
    'facebook',
    'page_123456789',
    'Test Business - Facebook',
    'https://www.facebook.com/testbusiness',
    'v1.mock_fb_token',
    NOW() + INTERVAL '60 days',
    true,
    NOW() - INTERVAL '1 hour',
    NOW(),
    NOW()
  ) ON CONFLICT DO NOTHING;

  -- Insert Google reviews (varied ratings, some with replies)
  INSERT INTO external_reviews (
    id, source_id, host_id, property_id, external_review_id, external_reviewer_id,
    reviewer_name, reviewer_avatar_url, rating, body, review_url,
    host_reply, host_reply_at, reply_synced,
    reviewed_at, is_visible, is_featured, created_at, updated_at
  ) VALUES
  -- 5-star review with reply
  (
    gen_random_uuid(), v_google_source_id, v_host_id, v_property_id,
    'google_review_001', 'reviewer_001',
    'Sarah M.',
    'https://lh3.googleusercontent.com/a/default-user=s120',
    5,
    'Absolutely stunning property! The views were breathtaking and the host was incredibly welcoming. The attention to detail was remarkable - from the fresh flowers to the locally sourced breakfast items. Will definitely be back!',
    'https://www.google.com/maps/reviews/@-33.9,18.4,17z/data=!4m5!14m4!1m3!1m2!1s123!2e0',
    'Thank you so much, Sarah! We loved having you and look forward to welcoming you back soon.',
    NOW() - INTERVAL '5 days',
    true,
    NOW() - INTERVAL '12 days',
    true, true, NOW() - INTERVAL '12 days', NOW()
  ),
  -- 5-star review no reply
  (
    gen_random_uuid(), v_google_source_id, v_host_id, v_property_id,
    'google_review_002', 'reviewer_002',
    'James K.',
    NULL,
    5,
    'Perfect getaway spot. Clean, comfortable, and the pool was amazing. Host communication was top-notch.',
    'https://www.google.com/maps/reviews/@-33.9,18.4,17z/data=!4m5!14m4!1m3!1m2!1s124!2e0',
    NULL, NULL, false,
    NOW() - INTERVAL '8 days',
    true, false, NOW() - INTERVAL '8 days', NOW()
  ),
  -- 4-star review
  (
    gen_random_uuid(), v_google_source_id, v_host_id, v_property_id,
    'google_review_003', 'reviewer_003',
    'Amanda T.',
    'https://lh3.googleusercontent.com/a/default-user=s120',
    4,
    'Great location and beautiful property. Only minor issue was the wifi being a bit slow, but otherwise a wonderful stay.',
    'https://www.google.com/maps/reviews/@-33.9,18.4,17z/data=!4m5!14m4!1m3!1m2!1s125!2e0',
    'Thanks for the feedback, Amanda! We''ve since upgraded our wifi infrastructure.',
    NOW() - INTERVAL '3 days',
    true,
    NOW() - INTERVAL '15 days',
    true, false, NOW() - INTERVAL '15 days', NOW()
  ),
  -- 4-star review
  (
    gen_random_uuid(), v_google_source_id, v_host_id, v_property_id,
    'google_review_004', 'reviewer_004',
    'Michael R.',
    NULL,
    4,
    'Lovely cottage with character. The garden was beautiful and the braai area was perfect for our family gathering.',
    'https://www.google.com/maps/reviews/@-33.9,18.4,17z/data=!4m5!14m4!1m3!1m2!1s126!2e0',
    NULL, NULL, false,
    NOW() - INTERVAL '20 days',
    true, false, NOW() - INTERVAL '20 days', NOW()
  ),
  -- 3-star review with reply
  (
    gen_random_uuid(), v_google_source_id, v_host_id, v_property_id,
    'google_review_005', 'reviewer_005',
    'Peter L.',
    NULL,
    3,
    'Decent stay but the aircon wasn''t working properly during our visit. Location is good though.',
    'https://www.google.com/maps/reviews/@-33.9,18.4,17z/data=!4m5!14m4!1m3!1m2!1s127!2e0',
    'We apologize for the aircon issue, Peter. It has been serviced and is now working perfectly. We''d love to host you again.',
    NOW() - INTERVAL '18 days',
    true,
    NOW() - INTERVAL '25 days',
    true, false, NOW() - INTERVAL '25 days', NOW()
  ),
  -- 5-star review (hidden by host)
  (
    gen_random_uuid(), v_google_source_id, v_host_id, v_property_id,
    'google_review_006', 'reviewer_006',
    'Lisa W.',
    'https://lh3.googleusercontent.com/a/default-user=s120',
    5,
    'Exceeded all expectations! The sunset views from the deck were incredible.',
    'https://www.google.com/maps/reviews/@-33.9,18.4,17z/data=!4m5!14m4!1m3!1m2!1s128!2e0',
    NULL, NULL, false,
    NOW() - INTERVAL '30 days',
    false, false, NOW() - INTERVAL '30 days', NOW()  -- Hidden
  );

  -- Insert Facebook reviews
  INSERT INTO external_reviews (
    id, source_id, host_id, property_id, external_review_id, external_reviewer_id,
    reviewer_name, reviewer_avatar_url, rating, body, review_url,
    host_reply, host_reply_at, reply_synced,
    reviewed_at, is_visible, is_featured, created_at, updated_at
  ) VALUES
  -- Facebook 5-star
  (
    gen_random_uuid(), v_facebook_source_id, v_host_id, v_property_id,
    'fb_review_001', 'fb_user_001',
    'Emma Johnson',
    'https://graph.facebook.com/123456/picture?type=square',
    5,
    'What a gem! We celebrated our anniversary here and it was perfect. The host arranged champagne and flowers - such a lovely touch!',
    'https://www.facebook.com/testbusiness/reviews/123456',
    'Happy anniversary, Emma! It was our pleasure to make your celebration special.',
    NOW() - INTERVAL '2 days',
    true,
    NOW() - INTERVAL '6 days',
    true, true, NOW() - INTERVAL '6 days', NOW()
  ),
  -- Facebook 5-star
  (
    gen_random_uuid(), v_facebook_source_id, v_host_id, v_property_id,
    'fb_review_002', 'fb_user_002',
    'David Chen',
    NULL,
    5,
    'Highly recommend! Spacious, clean, and great value for money. The host provided excellent local recommendations.',
    'https://www.facebook.com/testbusiness/reviews/123457',
    NULL, NULL, false,
    NOW() - INTERVAL '10 days',
    true, false, NOW() - INTERVAL '10 days', NOW()
  ),
  -- Facebook 4-star
  (
    gen_random_uuid(), v_facebook_source_id, v_host_id, v_property_id,
    'fb_review_003', 'fb_user_003',
    'Sophie van der Berg',
    'https://graph.facebook.com/789012/picture?type=square',
    4,
    'Really enjoyed our stay. Beautiful property with amazing mountain views. Kitchen was well-equipped for self-catering.',
    'https://www.facebook.com/testbusiness/reviews/123458',
    'Thank you, Sophie! Glad you enjoyed the views.',
    NOW() - INTERVAL '8 days',
    true,
    NOW() - INTERVAL '14 days',
    true, false, NOW() - INTERVAL '14 days', NOW()
  ),
  -- Facebook 4-star (not mapped to property)
  (
    gen_random_uuid(), v_facebook_source_id, v_host_id, NULL,  -- No property mapping
    'fb_review_004', 'fb_user_004',
    'Thomas Wright',
    NULL,
    4,
    'Good experience overall. Check-in was smooth and the place was as described.',
    'https://www.facebook.com/testbusiness/reviews/123459',
    NULL, NULL, false,
    NOW() - INTERVAL '22 days',
    true, false, NOW() - INTERVAL '22 days', NOW()
  ),
  -- Facebook 5-star (not mapped to property)
  (
    gen_random_uuid(), v_facebook_source_id, v_host_id, NULL,  -- No property mapping
    'fb_review_005', 'fb_user_005',
    'Nomsa Dlamini',
    'https://graph.facebook.com/345678/picture?type=square',
    5,
    'Wonderful hospitality! Felt like home away from home. Will definitely book again for our next Cape Town trip.',
    'https://www.facebook.com/testbusiness/reviews/123460',
    NULL, NULL, false,
    NOW() - INTERVAL '28 days',
    true, false, NOW() - INTERVAL '28 days', NOW()
  );

  -- Log sync entries for realism
  INSERT INTO external_review_sync_log (
    source_id, sync_type, status,
    reviews_fetched, reviews_added, reviews_updated,
    started_at, completed_at
  ) VALUES
  (v_google_source_id, 'manual', 'completed', 6, 6, 0, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '8 seconds'),
  (v_facebook_source_id, 'manual', 'completed', 5, 5, 0, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '5 seconds');

  RAISE NOTICE 'External reviews test data seeded for host %', v_host_id;
END $$;
