-- Migration: Void a ledger transaction (audit-safe, never deleted).
--
-- Enterprise bookkeeping never deletes a posted transaction — it VOIDS it: the
-- row stays for the audit trail, its financial effect is reversed, and it's
-- hidden from the active ledger but reachable via a "Voided" filter. We mark a
-- void with a uniform `voided_at` (+ who + reason) across the money tables, so
-- one filter surfaces every void and document numbers stay gap-free.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payments', 'invoices', 'credit_notes', 'refund_requests']
  LOOP
    EXECUTE format(
      'ALTER TABLE %I
         ADD COLUMN IF NOT EXISTS voided_at  timestamptz,
         ADD COLUMN IF NOT EXISTS voided_by  uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
         ADD COLUMN IF NOT EXISTS void_reason text',
      t
    );
  END LOOP;
END $$;

COMMENT ON COLUMN payments.voided_at IS
  'When the transaction was voided. Voided rows are excluded from balances/totals and the active ledger, but kept for audit.';

-- Booking refund total must ignore voided refunds. Reproduced from
-- 20260601000012 with a voided_at guard added.
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
        AND voided_at IS NULL
        AND status IN ('pending','approved','processing','disputed','escalated')
    ),
    refund_total = COALESCE((
      SELECT SUM(COALESCE(approved_amount, requested_amount))
      FROM refund_requests
      WHERE booking_id = v_booking
        AND voided_at IS NULL
        AND status = 'completed'
    ), 0)
  WHERE id = v_booking;
  RETURN COALESCE(NEW, OLD);
END;
$$;
