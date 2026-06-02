-- Migration: mark an invoice paid when its booking's payment completes
--
-- on_booking_confirmed_create_invoice() only sets status='paid' if the payment
-- was already completed AT confirmation time. For EFT (confirmed first, paid
-- later) or any later capture, the invoice stayed 'issued'. This trigger flips
-- the invoice to 'paid' whenever the booking's payment_status becomes completed.

CREATE OR REPLACE FUNCTION on_payment_completed_mark_invoice_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.payment_status = 'completed'
     AND COALESCE(OLD.payment_status, '') <> 'completed' THEN
    UPDATE invoices
      SET status = 'paid', paid_at = COALESCE(paid_at, now())
      WHERE booking_id = NEW.id
        AND status NOT IN ('paid', 'cancelled');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_payment_completed_invoice_paid ON public.bookings;
CREATE TRIGGER trigger_payment_completed_invoice_paid
  AFTER UPDATE OF payment_status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION on_payment_completed_mark_invoice_paid();
