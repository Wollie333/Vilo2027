-- Migration: per-room guest access + a "gate code" field on both listing- and
-- room-level access.
--
-- Until now guest access (check-in method, instructions, door code, Wi-Fi)
-- lived only at the listing level (listing_access). For multi-room listings the
-- guest needs the access details for the SPECIFIC room(s) they booked — a
-- whole-listing booking shows the listing access; a room booking shows that
-- room's access (two booked rooms → two access blocks). Room access falls back
-- to the listing access per field where a room leaves something blank.
--
-- Like listing_access, room access is SENSITIVE (codes are physical keys), so
-- it lives outside any public-readable table, with host-manage RLS only and NO
-- anon/guest read — the guest's Trip page reads it server-side for their own
-- confirmed booking, gating the codes/Wi-Fi password to shortly before check-in.
--
-- Pre-MVP data policy (CLAUDE.md): purely additive.

-- ─── 1. Gate code on listing_access ─────────────────────────
ALTER TABLE public.listing_access
  ADD COLUMN IF NOT EXISTS gate_code text;

COMMENT ON COLUMN public.listing_access.gate_code IS
  'Sensitive — estate/complex gate code. Gated to shortly before check-in like door_code.';

-- ─── 2. listing_room_access (one row per room) ───────────────
CREATE TABLE IF NOT EXISTS public.listing_room_access (
  room_id               uuid PRIMARY KEY REFERENCES public.listing_rooms(id) ON DELETE CASCADE,
  check_in_method       text,
  check_in_instructions text,
  gate_code             text,
  door_code             text,
  wifi_network          text,
  wifi_password         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_room_access ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_listing_room_access
  BEFORE UPDATE ON public.listing_room_access
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Host manages access for rooms in their own listings only. No anon/guest SELECT
-- — secrets reach the guest only server-side on their own booking's Trip page.
DROP POLICY IF EXISTS listing_room_access_host_manage ON public.listing_room_access;
CREATE POLICY listing_room_access_host_manage ON public.listing_room_access
  FOR ALL TO authenticated
  USING (
    room_id IN (
      SELECT lr.id FROM public.listing_rooms lr
      JOIN public.listings l ON l.id = lr.listing_id
      WHERE l.host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    room_id IN (
      SELECT lr.id FROM public.listing_rooms lr
      JOIN public.listings l ON l.id = lr.listing_id
      WHERE l.host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid())
    )
  );

COMMENT ON TABLE public.listing_room_access IS
  'Sensitive per-room guest access (gate/door code, Wi-Fi, self check-in). Host-manage RLS only; NEVER publicly readable. Falls back to listing_access per field. Guests receive it server-side on their own confirmed booking, codes gated to shortly before check-in.';
