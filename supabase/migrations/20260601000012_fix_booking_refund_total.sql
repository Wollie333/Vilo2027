-- Migration: keep bookings.refund_total in sync with completed refunds
--
-- Bug (found by the booking-flow integration harness): nothing ever updated
-- bookings.refund_total, so the booking detail page's "Refunded − R X" line
-- stayed at 0 even after a refund completed. sync_booking_refund_flag() already
-- recomputes has_open_refund on every refund status change — extend it to also
-- total the completed refunds onto the booking.

CREATE OR REPLACE FUNCTION sync_booking_refund_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking uuid := COALESCE(NEW.booking_id, OLD.booking_id);
BEGIN
  UPDATE bookings
  SET
    has_open_refund = EXISTS (
      SELECT 1 FROM refund_requests
      WHERE booking_id = v_booking
        AND status IN ('pending','approved','processing','disputed','escalated')
    ),
    refund_total = COALESCE((
      SELECT SUM(COALESCE(approved_amount, requested_amount))
      FROM refund_requests
      WHERE booking_id = v_booking AND status = 'completed'
    ), 0)
  WHERE id = v_booking;
  RETURN COALESCE(NEW, OLD);
END;
$$;
