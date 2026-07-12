-- Migration: email the guest their stay details alongside the inbox access card
--
-- Today send_due_access_cards() posts an inbox system card (gate/door/Wi-Fi)
-- from host → guest ~1h before check-in and stamps bookings.access_card_sent_at.
-- The guest gets NOTHING by email — the only guest emails are booking-confirmed
-- (no access details) and the review request. Founder ask: when a booking is
-- confirmed + paid, the guest should ALSO get an email just before check-in with
-- their full stay details (dates, where, and the access info — gate code, Wi-Fi).
--
-- This CREATE OR REPLACE keeps every existing behaviour of the function and adds
-- one thing: it enqueues a `stay_details_guest` email into notification_queue in
-- the same loop iteration, right where it stamps access_card_sent_at. Because the
-- loop only selects bookings with access_card_sent_at IS NULL and stamps it at
-- the end, the email is enqueued exactly once per booking (same idempotency as
-- the inbox card). The email-worker drain resolves the access details afresh with
-- the service role (RESOLVERS['stay_details_guest']) and renders the
-- StayDetailsGuest template — so no secrets travel through the queue payload.

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
    SELECT bk.id, bk.host_id, bk.guest_id, bk.property_id, bk.quote_id,
           l.name AS listing_name, l.check_in_time
    FROM bookings bk
    JOIN properties l ON l.id = bk.property_id
    WHERE bk.status IN ('confirmed', 'checked_in')
      AND bk.guest_id IS NOT NULL
      AND bk.property_id IS NOT NULL
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
      FROM property_access WHERE property_id = b.property_id;

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
        JOIN property_rooms lr ON lr.id = br.room_id
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
        AND property_id = b.property_id AND status <> 'archived'
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT 1;
    END IF;
    IF v_conv_id IS NULL THEN
      INSERT INTO conversations (host_id, guest_id, property_id, booking_id, status, is_enquiry)
      VALUES (b.host_id, b.guest_id, b.property_id, b.id, 'open', false)
      RETURNING id INTO v_conv_id;
    END IF;

    INSERT INTO messages (conversation_id, sender_id, body, is_system_message,
                          system_event, read_by_host, read_by_guest)
    VALUES (v_conv_id, v_host_user, btrim(v_body), true,
            'access_details', true, false);

    -- Also email the guest their stay details + access info. Transactional
    -- (no category_id → always sent). The drain re-resolves the access data,
    -- so nothing secret is stored in the queue payload.
    INSERT INTO notification_queue (type, guest_id, user_id, payload)
    VALUES ('stay_details_guest', b.guest_id, b.guest_id,
            jsonb_build_object('booking_id', b.id));

    UPDATE bookings SET access_card_sent_at = now() WHERE id = b.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.send_due_access_cards() IS
  'Every 15 min: ~1h before check-in, posts the inbox access card (host→guest, gate/door/Wi-Fi) AND enqueues a stay_details_guest email, once per booking (guarded by access_card_sent_at).';
