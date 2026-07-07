-- Migration: Meta Conversions API (server-side) purchase marker.
--
-- The Wielo platform fires a server-side Purchase to Meta's CAPI (deduped
-- against the browser pixel via event_id = booking.reference) when a DIRECTORY
-- booking is confirmed + paid. This timestamp makes that fire exactly once per
-- booking (the success page stamps it after a successful send). Directory only —
-- website (host-site) bookings use the host's own pixel, never Wielo's CAPI.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS capi_purchase_sent_at timestamptz;

COMMENT ON COLUMN public.bookings.capi_purchase_sent_at IS
  'When the Wielo CAPI Purchase was sent for this booking (idempotency; directory bookings only).';
