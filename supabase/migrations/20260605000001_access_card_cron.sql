-- Migration: auto-post a guest "access details" card into the inbox ~1 hour
-- before check-in (matching the trip-page unlock), for confirmed bookings.
--
-- A 15-minute pg_cron job calls send_due_access_cards(), which for each due
-- booking resolves the access (per booked room with listing fallback, or the
-- whole listing), finds-or-creates the host↔guest conversation, posts a system
-- message (system_event = 'access_details') from the host so the guest gets an
-- unread badge, and stamps access_card_sent_at so it's sent once.
--
-- Codes are sensitive but the job runs server-side (SECURITY DEFINER) and the
-- card is delivered 1h before check-in, exactly when the codes unlock — so the
-- card carries the real codes.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS access_card_sent_at timestamptz;

COMMENT ON COLUMN public.bookings.access_card_sent_at IS
  'When the automated access-details inbox card was posted (≈1h before check-in). NULL = not yet sent.';

-- One access line; empty when the value is blank.
CREATE OR REPLACE FUNCTION public._access_line(p_label text, p_val text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_val IS NULL OR btrim(p_val) = '' THEN ''
    ELSE p_label || ': ' || p_val || E'\n'
  END;
$$;

CREATE OR REPLACE FUNCTION public.send_due_access_cards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b           RECORD;
  la          RECORD;          -- listing access
  r           RECORD;          -- per booked room (with fallback applied)
  v_host_user uuid;
  v_conv_id   uuid;
  v_body      text;
  v_block     text;
  v_has_rooms boolean;
  v_count     integer := 0;
BEGIN
  FOR b IN
    SELECT bk.id, bk.host_id, bk.guest_id, bk.listing_id, bk.conversation_id,
           l.name AS listing_name, l.check_in_time
    FROM bookings bk
    JOIN listings l ON l.id = bk.listing_id
    WHERE bk.status IN ('confirmed', 'checked_in')
      AND bk.guest_id IS NOT NULL
      AND bk.listing_id IS NOT NULL
      AND bk.access_card_sent_at IS NULL
      AND bk.check_in IS NOT NULL
      AND bk.deleted_at IS NULL
      -- Check-in moment (host local time, SA) is within the next hour — and not
      -- ancient (guards against a backlog after downtime).
      AND ((bk.check_in::text || ' ' || COALESCE(bk.check_in_time, '00:00'))::timestamp
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
      FROM listing_access WHERE listing_id = b.listing_id;

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
        LEFT JOIN listing_room_access ra ON ra.room_id = br.room_id
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

    -- Resolve the conversation: the booking's own, else an existing open
    -- host↔guest thread for this listing, else a fresh one.
    v_conv_id := b.conversation_id;
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

    -- Post as the host so on_message_inserted bumps unread_guest.
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

-- Every 15 minutes. Unschedule first so re-running the migration is safe.
SELECT cron.unschedule('send-access-cards')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-access-cards');

SELECT cron.schedule(
  'send-access-cards',
  '*/15 * * * *',
  $$ SELECT public.send_due_access_cards(); $$
);
