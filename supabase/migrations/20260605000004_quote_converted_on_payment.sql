-- Migration: when a quote-converted booking is CONFIRMED (i.e. the guest has
-- paid), flip its source quote to 'converted'.
--
-- New flow: accepting a quote auto-creates a booking in 'pending' (awaiting
-- payment) and leaves the quote 'accepted' so its soft-hold keeps the dates.
-- The booking only confirms once payment lands (Paystack webhook / EFT verify /
-- success fast-path), at which point on_booking_confirmed lays the calendar
-- block. This trigger flips the quote to 'converted' at exactly that moment, so
-- on_quote_status_change clears the quote soft-hold right as the booking block
-- takes over — no gap where the dates are free.

CREATE OR REPLACE FUNCTION public.on_quote_booking_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.origin = 'quote_converted' AND NEW.quote_id IS NOT NULL THEN
    UPDATE quotes
       SET status = 'converted',
           converted_at = COALESCE(converted_at, now()),
           converted_booking_id = NEW.id
     WHERE id = NEW.quote_id
       AND status <> 'converted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_quote_booking_confirmed ON public.bookings;
CREATE TRIGGER trigger_quote_booking_confirmed
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status <> 'confirmed')
  EXECUTE FUNCTION public.on_quote_booking_confirmed();
