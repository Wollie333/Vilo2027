-- ════════════════════════════════════════════════════════════════════════
--  Rename R1 — leaf tables: listing_* → property_*
-- ════════════════════════════════════════════════════════════════════════
-- Part of the listings→properties rename (see RENAME_LISTINGS_TO_PROPERTIES.md).
-- R1 renames the self-contained "leaf" tables — those touched only by small,
-- isolated functions and by RLS policies that reference `listings` (which a
-- table rename carries automatically). Pre-MVP: no data to migrate; Docker is
-- unavailable so affected functions are recreated from their LATEST definitions
-- in the migration history, swapping only the renamed table references.
--
-- Scope decisions:
--   * Column renames (listing_id → property_id) stay in R3 — only table NAMES
--     change here.
--   * `listing_view_events` is DEFERRED to R3: it is consumed only by the large
--     analytics RPC suite, which R3 already recreates for the listing_id→
--     property_id column change. Renaming it here would force recreating that
--     whole suite twice for zero benefit. Renamed alongside its column in R3.
--   * Indexes / constraints keep their existing (listing_*) names — purely
--     internal labels; renaming them is cosmetic and adds typo risk. The FKs,
--     indexes, triggers and RLS policies all follow the table rename and keep
--     working (PostgREST resolves embeds by FK existence, not name).
--
-- Tables renamed (8):
--   listing_rankings            → property_rankings
--   listing_counters            → property_counters
--   listing_categories          → property_categories
--   listing_review_themes       → property_review_themes
--   listing_local_picks         → property_local_picks
--   listing_access              → property_access
--   listing_room_access         → property_room_access
--   listing_points_of_interest  → property_points_of_interest

-- ─── 1. Table renames ─────────────────────────────────────────────
ALTER TABLE public.listing_rankings           RENAME TO property_rankings;
ALTER TABLE public.listing_counters           RENAME TO property_counters;
ALTER TABLE public.listing_categories         RENAME TO property_categories;
ALTER TABLE public.listing_review_themes      RENAME TO property_review_themes;
ALTER TABLE public.listing_local_picks        RENAME TO property_local_picks;
ALTER TABLE public.listing_access             RENAME TO property_access;
ALTER TABLE public.listing_room_access        RENAME TO property_room_access;
ALTER TABLE public.listing_points_of_interest RENAME TO property_points_of_interest;

-- ─── 2. Recreate functions that reference renamed tables ──────────
-- Only the renamed table references change; all other table/column references
-- (listings, listing_rooms, bookings, the listing_id columns, etc.) stay as-is
-- — they belong to later rename phases.

-- recalculate_listing_ranking — writes property_rankings (was listing_rankings).
-- Latest def: 20260501000012_create_functions.sql.
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

  INSERT INTO property_rankings (
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

-- gen_booking_reference — counts per listing via property_counters (was
-- listing_counters). Latest def: 20260602000010_doc_numbering_per_listing.sql.
CREATE OR REPLACE FUNCTION gen_booking_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next integer;
BEGIN
  IF NEW.reference IS NULL THEN
    INSERT INTO property_counters (listing_id, last_booking_number)
    VALUES (NEW.listing_id, 1)
    ON CONFLICT (listing_id) DO UPDATE
      SET last_booking_number = property_counters.last_booking_number + 1,
          updated_at = now()
    RETURNING last_booking_number INTO v_next;
    NEW.reference := 'BK-' || listing_doc_code(NEW.listing_id) || '-' ||
                     lpad(v_next::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- send_due_access_cards — reads property_access / property_room_access (were
-- listing_access / listing_room_access). Latest def:
-- 20260605000003_access_card_cron_fix2.sql.
CREATE OR REPLACE FUNCTION public.send_due_access_cards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b           RECORD;
  la          RECORD;
  r           RECORD;
  v_host_user uuid;
  v_conv_id   uuid;
  v_body      text;
  v_block     text;
  v_has_rooms boolean;
  v_count     integer := 0;
BEGIN
  FOR b IN
    SELECT bk.id, bk.host_id, bk.guest_id, bk.listing_id, bk.quote_id,
           l.name AS listing_name, l.check_in_time
    FROM bookings bk
    JOIN listings l ON l.id = bk.listing_id
    WHERE bk.status IN ('confirmed', 'checked_in')
      AND bk.guest_id IS NOT NULL
      AND bk.listing_id IS NOT NULL
      AND bk.access_card_sent_at IS NULL
      AND bk.check_in IS NOT NULL
      AND bk.deleted_at IS NULL
      AND ((bk.check_in::text || ' ' || COALESCE(l.check_in_time, '00:00'))::timestamp
             AT TIME ZONE 'Africa/Johannesburg')
          BETWEEN now() - interval '12 hours' AND now() + interval '60 minutes'
  LOOP
    SELECT user_id INTO v_host_user FROM hosts WHERE id = b.host_id;
    IF v_host_user IS NULL THEN
      CONTINUE;
    END IF;

    SELECT check_in_method, check_in_instructions, gate_code, door_code,
           wifi_network, wifi_password
      INTO la
      FROM property_access WHERE listing_id = b.listing_id;

    SELECT EXISTS (SELECT 1 FROM booking_rooms WHERE booking_id = b.id)
      INTO v_has_rooms;

    v_body := '🔑 Access details for ' || b.listing_name || E'\n'
            || 'These unlock for your stay — see your trip page any time.' || E'\n\n';

    IF v_has_rooms THEN
      FOR r IN
        SELECT lr.name AS room_name,
               COALESCE(NULLIF(btrim(ra.check_in_method), ''), la.check_in_method)             AS check_in_method,
               COALESCE(NULLIF(btrim(ra.check_in_instructions), ''), la.check_in_instructions)  AS check_in_instructions,
               COALESCE(NULLIF(btrim(ra.gate_code), ''), la.gate_code)                          AS gate_code,
               COALESCE(NULLIF(btrim(ra.door_code), ''), la.door_code)                          AS door_code,
               COALESCE(NULLIF(btrim(ra.wifi_network), ''), la.wifi_network)                    AS wifi_network,
               COALESCE(NULLIF(btrim(ra.wifi_password), ''), la.wifi_password)                  AS wifi_password
        FROM booking_rooms br
        JOIN listing_rooms lr ON lr.id = br.room_id
        LEFT JOIN property_room_access ra ON ra.room_id = br.room_id
        WHERE br.booking_id = b.id
        ORDER BY lr.sort_order NULLS LAST, lr.name
      LOOP
        v_block := public._access_line('Check-in', r.check_in_method)
                 || public._access_line('Gate code', r.gate_code)
                 || public._access_line('Door code', r.door_code)
                 || public._access_line('Wi-Fi network', r.wifi_network)
                 || public._access_line('Wi-Fi password', r.wifi_password)
                 || public._access_line('Arrival', r.check_in_instructions);
        IF btrim(v_block) <> '' THEN
          v_body := v_body || '— ' || r.room_name || ' —' || E'\n' || v_block || E'\n';
        END IF;
      END LOOP;
    ELSE
      v_body := v_body
              || public._access_line('Check-in', la.check_in_method)
              || public._access_line('Gate code', la.gate_code)
              || public._access_line('Door code', la.door_code)
              || public._access_line('Wi-Fi network', la.wifi_network)
              || public._access_line('Wi-Fi password', la.wifi_password)
              || public._access_line('Arrival', la.check_in_instructions);
    END IF;

    -- Conversation: the quote's thread (converted bookings), else an existing
    -- open host↔guest thread for the listing, else a fresh one.
    v_conv_id := NULL;
    IF b.quote_id IS NOT NULL THEN
      SELECT conversation_id INTO v_conv_id FROM quotes WHERE id = b.quote_id;
    END IF;
    IF v_conv_id IS NULL THEN
      SELECT id INTO v_conv_id
      FROM conversations
      WHERE host_id = b.host_id AND guest_id = b.guest_id
        AND listing_id = b.listing_id AND status <> 'archived'
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT 1;
    END IF;
    IF v_conv_id IS NULL THEN
      INSERT INTO conversations (host_id, guest_id, listing_id, booking_id, status, is_enquiry)
      VALUES (b.host_id, b.guest_id, b.listing_id, b.id, 'open', false)
      RETURNING id INTO v_conv_id;
    END IF;

    INSERT INTO messages (conversation_id, sender_id, body, is_system_message,
                          system_event, read_by_host, read_by_guest)
    VALUES (v_conv_id, v_host_user, btrim(v_body), true,
            'access_details', true, false);

    UPDATE bookings SET access_card_sent_at = now() WHERE id = b.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
