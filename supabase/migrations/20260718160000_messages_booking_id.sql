-- Link a system message to a booking so booking system-cards (payment received,
-- and future ones) can render a rich, self-contained card without guessing which
-- booking they belong to.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS booking_id uuid
  REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Backfill existing payment-received cards from their conversation's booking so
-- the already-sent cards (e.g. the BK-0067 test) render enriched immediately.
UPDATE public.messages m
SET booking_id = c.booking_id
FROM public.conversations c
WHERE m.conversation_id = c.id
  AND m.booking_id IS NULL
  AND c.booking_id IS NOT NULL
  AND m.system_event IN ('payment_received', 'payment_pending', 'payment_link');
