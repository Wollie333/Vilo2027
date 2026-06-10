-- Migration: materialise the booking party as soon as it's named — not only on
-- confirmation.
--
-- The lead booker already appears in the Guests directory the moment a booking
-- exists (the directory UNIONs bookings), so party members should too. Gating on
-- confirmation left party guests on a pending/EFT booking invisible (no contact,
-- no relationship). This broadens the trigger to fire on INSERT and whenever the
-- party manifest changes, for any booking that carries a party — and backfills
-- existing non-cancelled bookings so already-placed bookings catch up.
--
-- Still idempotent: _materialize_booking_party upserts contacts (deduped by
-- email) and links with ON CONFLICT DO NOTHING.

-- Broaden the confirm-only trigger → fire on INSERT + party/status changes.
DROP TRIGGER IF EXISTS trg_materialize_booking_party ON public.bookings;
CREATE TRIGGER trg_materialize_booking_party
  AFTER INSERT OR UPDATE OF status, additional_guests ON public.bookings
  FOR EACH ROW
  WHEN (
    NEW.additional_guests IS NOT NULL
    AND jsonb_array_length(NEW.additional_guests) > 0
  )
  EXECUTE FUNCTION public._trg_materialize_booking_party();

-- One-time backfill: every non-cancelled booking that already carries a party.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.bookings
    WHERE additional_guests IS NOT NULL
      AND jsonb_array_length(additional_guests) > 0
      AND deleted_at IS NULL
      AND status NOT IN (
        'cancelled_by_host','cancelled_by_guest','declined','expired','no_show'
      )
  LOOP
    PERFORM public._materialize_booking_party(r.id);
  END LOOP;
END $$;
