-- Migration: per-booking welcome note from the host to the guest.
--
-- Shown as "A note from your host" on the guest's Trip Details page. This is a
-- guest-FACING personal note (distinct from bookings.internal_notes, which is
-- host/staff-only, and bookings.special_requests, which is guest -> host).
-- Editable by the host on the booking detail page.
--
-- Pre-MVP data policy (CLAUDE.md): purely additive. The booking's existing RLS
-- (guest reads own bookings, host manages own) already governs who sees it.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS host_message text;

COMMENT ON COLUMN public.bookings.host_message IS
  'Guest-facing personal welcome note from the host, shown on the Trip Details page. Distinct from internal_notes (host-only) and special_requests (guest->host).';
