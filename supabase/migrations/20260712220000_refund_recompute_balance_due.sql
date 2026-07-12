-- Fix: a partial refund leaves bookings.balance_due stale.
--
-- The refund-completion trigger (update_payment_refunded_amount, last set in
-- 20260712150000 G4) rolls payments.refunded_amount, payments.status and
-- bookings.payment_status, but it never updates bookings.balance_due. So after a
-- partial refund the booking's denormalised balance is wrong: e.g. BK-0027 —
-- captured 4830, refunded 2000, net paid 2830 — still shows balance_due = 0 when
-- the guest genuinely owes 2000 again. The live UI is correct (it derives paid
-- via sumPaidFromRows), but anything reading the denormalised column drifts.
--
-- The trigger already computes v_captured and v_refunded (net paid = the
-- difference). Set balance_due = max(0, total_amount − net_paid) from them, in
-- the same completion branch. Only the balance_due UPDATE is added.

CREATE OR REPLACE FUNCTION update_payment_refunded_amount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking_id uuid;
  v_captured   numeric;
  v_refunded   numeric;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE payments
    SET refunded_amount = COALESCE(refunded_amount, 0) + COALESCE(NEW.approved_amount, 0)
    WHERE id = NEW.payment_id;

    UPDATE payments
    SET status = CASE
      WHEN refunded_amount >= amount THEN 'refunded'
      ELSE 'partially_refunded'
    END
    WHERE id = NEW.payment_id;

    -- Roll the booking's payment_status up from ALL its payments so a booking
    -- with several payments reads refunded only when everything captured is back.
    SELECT booking_id INTO v_booking_id FROM payments WHERE id = NEW.payment_id;
    IF v_booking_id IS NOT NULL THEN
      SELECT
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(refunded_amount), 0)
      INTO v_captured, v_refunded
      FROM payments
      WHERE booking_id = v_booking_id
        AND voided_at IS NULL
        AND kind IN ('deposit','balance','addon','payment','credit')
        AND status IN ('completed','partially_refunded','refunded');

      IF v_refunded > 0 THEN
        UPDATE bookings
        SET payment_status = CASE
          WHEN v_refunded >= v_captured THEN 'refunded'
          ELSE 'partially_refunded'
        END
        WHERE id = v_booking_id;
      END IF;

      -- Keep the denormalised balance in step with the ledger: net paid is
      -- (captured − refunded); the guest owes the rest of the booking total.
      UPDATE bookings
      SET balance_due = round(GREATEST(0, total_amount - (v_captured - v_refunded)), 2)
      WHERE id = v_booking_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
