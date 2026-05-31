-- Migration: backfill a payment record for every existing booking that lacks
-- one, so all bookings appear in the Payments tab (the single source of truth
-- for payment records). Mirrors the booking's amount / method / status.
-- Idempotent — only inserts where no payment row exists for the booking.
--
-- Pre-MVP one-off (user-requested): existing test bookings predate the always-
-- create-a-payment flow, so they had no payment row.
--
-- DOWN: no automatic down — these are real payment rows now.

INSERT INTO public.payments (booking_id, amount, currency, method, status, created_at)
SELECT
  b.id,
  b.total_amount,
  b.currency,
  COALESCE(NULLIF(b.payment_method, ''), 'eft'),
  CASE
    WHEN b.payment_status IN ('completed', 'authorised') THEN 'completed'
    WHEN b.payment_status = 'failed'                      THEN 'failed'
    WHEN b.payment_status = 'refunded'                    THEN 'refunded'
    WHEN b.payment_status = 'partially_refunded'          THEN 'partially_refunded'
    WHEN b.payment_status = 'voided'                      THEN 'voided'
    ELSE 'pending'
  END,
  b.created_at
FROM public.bookings b
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p WHERE p.booking_id = b.id
  );
