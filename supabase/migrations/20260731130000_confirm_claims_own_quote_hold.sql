-- FIX: a quote-converted booking could not confirm after payment — it was blocked
-- by its OWN originating quote's soft-hold.
--
-- Root cause (diagnosed from a live prod error on /pay/[token]:
--   "Payment captured but booking … failed to confirm: Those dates are no longer
--    available."):
--   * on_quote_status_change lays down blocked_dates on quote 'sent'
--     (reason='quote_pending', quote_id=<quote>, booking_id=NULL) and only clears
--     them on quote 'declined'/'expired'/'converted'.
--   * acceptAndConvertQuote deliberately keeps the quote 'accepted' (NOT
--     'converted') so the soft-hold persists until the guest pays.
--   * When the guest then pays, on_booking_confirmed's availability re-check saw
--     that same quote-hold (booking_id IS DISTINCT FROM NEW.id, and it only
--     excluded a claimable special-hold) and RAISED 23P01 — the booking's own
--     quote blocking its own confirmation. The card was already captured, so the
--     guest hit a raw error page; it self-resolved only once the hold later
--     cleared (quote expiry), and a retry/reconcile confirmed.
--
-- Fix: treat the booking's originating quote hold exactly like the special-hold —
--   1. exclude it from the re-check (both scopes), and
--   2. CLAIM it in the ON CONFLICT upsert (booking_id=NEW.id, source='booking'),
--      clearing quote_id so a later quote terminal-transition clear (which deletes
--      by quote_id) can't delete the now-confirmed booking's blocks.
-- A DIFFERENT quote's hold still blocks (conservative — that quote may also pay).
-- Body otherwise byte-identical to the live 20260717000900 definition.

CREATE OR REPLACE FUNCTION public.on_booking_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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
      -- concurrently-pending booking). Exclude this booking's own blocks, the
      -- special-hold it may claim, and the soft-hold of the QUOTE it converted
      -- from (else a quote-converted booking blocks its own confirmation).
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
            AND NOT (bd.booking_id IS NULL
                     AND NEW.quote_id IS NOT NULL
                     AND bd.quote_id IS NOT DISTINCT FROM NEW.quote_id)
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
            AND NOT (bd.booking_id IS NULL
                     AND NEW.quote_id IS NOT NULL
                     AND bd.quote_id IS NOT DISTINCT FROM NEW.quote_id)
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
                          special_id = NULL,
                          quote_id   = NULL
            WHERE blocked_dates.booking_id IS NULL
              AND (
                (blocked_dates.source = 'special'
                 AND blocked_dates.special_id = NEW.special_id)
                OR (NEW.quote_id IS NOT NULL
                    AND blocked_dates.quote_id IS NOT DISTINCT FROM NEW.quote_id)
              );
          END LOOP;
        ELSE
          -- whole_listing scope: room_id NULL = blocks every room on that date.
          INSERT INTO blocked_dates (property_id, room_id, date, reason, source, booking_id, special_id)
          VALUES (NEW.property_id, NULL, v_date, 'booking', 'booking', NEW.id, NULL)
          ON CONFLICT (property_id, COALESCE(room_id, '00000000-0000-0000-0000-000000000000'::uuid), date)
          DO UPDATE SET booking_id = NEW.id,
                        reason     = 'booking',
                        source     = 'booking',
                        special_id = NULL,
                        quote_id   = NULL
          WHERE blocked_dates.booking_id IS NULL
            AND (
              blocked_dates.special_id IS NOT DISTINCT FROM NEW.special_id
              OR (NEW.quote_id IS NOT NULL
                  AND blocked_dates.quote_id IS NOT DISTINCT FROM NEW.quote_id)
            );
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
