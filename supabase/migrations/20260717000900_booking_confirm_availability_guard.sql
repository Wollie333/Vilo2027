-- Close the double-booking window at confirm time.
--
-- Before: a pending booking writes no blocked_dates, and the confirm trigger
-- inserted its blocks with ON CONFLICT ... DO UPDATE whose WHERE only matched an
-- unclaimed special-hold. When a date was already held by ANOTHER booking the
-- upsert affected 0 rows and RAISED NOTHING — so two guests who both passed the
-- create-time availability check (each while the other was still pending) could
-- both pay and both confirm the same slot, the second silently with no block.
--
-- After: on_booking_confirmed now, on the pending->confirmed transition,
--   1. takes a per-property advisory xact lock so concurrent confirms for the
--      same property serialise (kills the check-then-write race), then
--   2. re-checks availability against blocked_dates using the SAME cross-scope
--      rule the availability functions use (whole-listing sees any block; a room
--      sees NULL-room or same-room blocks), EXCLUDING this booking's own rows and
--      its claimable special-hold, and RAISEs 23P01 if the dates are gone, then
--   3. writes the blocks exactly as before (the ON CONFLICT still claims a
--      matching special-hold).
--
-- The manual "insert booking already confirmed" path (createManualBookingAction)
-- does NOT fire this trigger (AFTER UPDATE OF status only) and guards itself; a
-- separate follow-up hardens that non-atomic insert. This covers every
-- payment-driven confirm: guest checkout, pay-booking, webhook, quote-convert,
-- and the manual "Mark received" / record-payment confirms.
--
-- Also pins search_path (was one of the 73 unpinned SECURITY DEFINER functions).
CREATE OR REPLACE FUNCTION public.on_booking_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_date date;
  v_room record;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN

      -- Serialise confirms for this property so two concurrent same-slot
      -- confirmations can't both pass the re-check below. Released at txn end.
      PERFORM pg_advisory_xact_lock(
        hashtext('booking_confirm:' || NEW.property_id::text)::bigint
      );

      -- Re-check availability now (the create-time check couldn't see a
      -- concurrently-pending booking). Exclude this booking's own blocks and the
      -- special-hold it is entitled to claim just below.
      IF NEW.scope = 'rooms' THEN
        IF EXISTS (
          SELECT 1
          FROM booking_rooms br
          JOIN blocked_dates bd
            ON bd.property_id = NEW.property_id
           AND (bd.room_id IS NULL OR bd.room_id = br.room_id)
           AND bd.date >= NEW.check_in
           AND bd.date <  NEW.check_out
          WHERE br.booking_id = NEW.id
            AND bd.booking_id IS DISTINCT FROM NEW.id
            AND NOT (bd.booking_id IS NULL
                     AND bd.source = 'special'
                     AND bd.special_id IS NOT DISTINCT FROM NEW.special_id)
        ) THEN
          RAISE EXCEPTION 'Those dates are no longer available.'
            USING ERRCODE = '23P01';
        END IF;
      ELSE
        IF EXISTS (
          SELECT 1
          FROM blocked_dates bd
          WHERE bd.property_id = NEW.property_id
            AND bd.date >= NEW.check_in
            AND bd.date <  NEW.check_out
            AND bd.booking_id IS DISTINCT FROM NEW.id
            AND NOT (bd.booking_id IS NULL
                     AND bd.source = 'special'
                     AND bd.special_id IS NOT DISTINCT FROM NEW.special_id)
        ) THEN
          RAISE EXCEPTION 'Those dates are no longer available.'
            USING ERRCODE = '23P01';
        END IF;
      END IF;

      v_date := NEW.check_in;
      WHILE v_date < NEW.check_out LOOP
        IF NEW.scope = 'rooms' THEN
          -- Block each booked room separately.
          FOR v_room IN
            SELECT room_id FROM booking_rooms WHERE booking_id = NEW.id
          LOOP
            INSERT INTO blocked_dates (property_id, room_id, date, reason, source, booking_id, special_id)
            VALUES (NEW.property_id, v_room.room_id, v_date, 'booking', 'booking', NEW.id, NULL)
            ON CONFLICT (property_id, COALESCE(room_id, '00000000-0000-0000-0000-000000000000'::uuid), date)
            DO UPDATE SET booking_id = NEW.id,
                          reason     = 'booking',
                          source     = 'booking',
                          special_id = NULL
            WHERE blocked_dates.booking_id IS NULL
              AND blocked_dates.source = 'special'
              AND blocked_dates.special_id = NEW.special_id;
          END LOOP;
        ELSE
          -- whole_listing scope: room_id NULL = blocks every room on that date.
          INSERT INTO blocked_dates (property_id, room_id, date, reason, source, booking_id, special_id)
          VALUES (NEW.property_id, NULL, v_date, 'booking', 'booking', NEW.id, NULL)
          ON CONFLICT (property_id, COALESCE(room_id, '00000000-0000-0000-0000-000000000000'::uuid), date)
          DO UPDATE SET booking_id = NEW.id,
                        reason     = 'booking',
                        source     = 'booking',
                        special_id = NULL
          WHERE blocked_dates.booking_id IS NULL
            AND blocked_dates.special_id IS NOT DISTINCT FROM NEW.special_id;
        END IF;
        v_date := v_date + 1;
      END LOOP;
    END IF;
    UPDATE hosts      SET total_bookings = total_bookings + 1 WHERE id = NEW.host_id;
    UPDATE properties SET total_bookings = total_bookings + 1 WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$function$;
