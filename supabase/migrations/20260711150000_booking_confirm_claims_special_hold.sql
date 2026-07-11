-- Fix: on confirmation, a special/deal booking must OWN its calendar dates.
--
-- Problem: on_booking_confirmed() inserts blocked_dates(reason='booking',
-- booking_id) with ON CONFLICT DO NOTHING. For a fixed-date special the dates are
-- already held by the special (source='special', special_id set, booking_id NULL)
-- on the SAME (property_id, room_id, date) scope, so the insert collides and does
-- nothing — the confirmed booking never gets a booking-owned block. Then when the
-- host later ends/deletes the special, release_special_dates DELETEs those holds
-- and silently frees a LIVE confirmed booking's dates -> double-booking.
--
-- Two things also fixed here:
--  * the plain (non-conflicting) insert never set `source`, so a normal booking's
--    block ended up source='manual' (the column default) instead of 'booking'.
--  * the special hold is now CLAIMED by the booking on conflict (converted to a
--    booking-owned block: booking_id set, source='booking', special_id cleared),
--    but only when it is THIS booking's own special hold — never stealing an iCal
--    feed's or another special's block.
--
-- Uses the existing unique index unique_blocked_date_per_scope
--   (property_id, COALESCE(room_id, '00000000-0000-0000-0000-000000000000'::uuid), date)
-- as the ON CONFLICT arbiter.

CREATE OR REPLACE FUNCTION on_booking_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_date date;
  v_room record;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
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
$$;

-- Backfill: convert any EXISTING confirmed special bookings whose dates are still
-- held only by the special (booking_id NULL) into booking-owned blocks, so live
-- bookings are protected retroactively.
UPDATE blocked_dates bd
SET booking_id = b.id,
    reason     = 'booking',
    source     = 'booking',
    special_id = NULL
FROM bookings b
WHERE bd.booking_id IS NULL
  AND bd.special_id IS NOT NULL
  AND bd.special_id = b.special_id
  AND b.status = 'confirmed'
  AND b.property_id = bd.property_id
  AND bd.date >= b.check_in
  AND bd.date <  b.check_out
  AND (b.scope <> 'rooms' OR bd.room_id IN (
        SELECT room_id FROM booking_rooms WHERE booking_id = b.id
      ));
