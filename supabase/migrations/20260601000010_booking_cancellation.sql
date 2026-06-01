-- Migration: Release the calendar (and counters) when a booking is cancelled
--
-- on_booking_confirmed() blocks dates when a booking confirms, but nothing
-- un-blocks them on cancellation/decline — so cancelled dates stayed
-- unavailable. This adds on_booking_cancelled(): when a booking moves INTO a
-- cancelled/declined/expired/no_show state, free its blocked_dates and (if it
-- had been counted) decrement the host/listing booking counts.

CREATE OR REPLACE FUNCTION on_booking_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_terminal text[] := ARRAY[
    'cancelled_by_host', 'cancelled_by_guest', 'declined', 'expired', 'no_show'
  ];
BEGIN
  IF NEW.status = ANY(v_terminal) AND COALESCE(OLD.status, '') <> NEW.status THEN
    -- Free every calendar block this booking placed.
    DELETE FROM blocked_dates WHERE booking_id = NEW.id;

    -- If the booking had been counted (it was confirmed/checked_in), roll the
    -- counters back so dashboards stay accurate.
    IF COALESCE(OLD.status, '') IN ('confirmed', 'checked_in') THEN
      UPDATE hosts
        SET total_bookings = GREATEST(0, total_bookings - 1)
        WHERE id = NEW.host_id;
      UPDATE listings
        SET total_bookings = GREATEST(0, total_bookings - 1)
        WHERE id = NEW.listing_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_on_booking_cancelled ON public.bookings;
CREATE TRIGGER trigger_on_booking_cancelled
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION on_booking_cancelled();

COMMENT ON FUNCTION on_booking_cancelled IS
  'Releases blocked_dates + decrements booking counters when a booking enters a cancelled/declined/expired/no_show state.';
