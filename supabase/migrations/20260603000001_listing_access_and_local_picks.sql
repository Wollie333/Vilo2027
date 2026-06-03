-- Migration: guest access details + host local picks for the Trip Details page.
--
-- Two new host-owned surfaces that the guest's Trip Details page renders:
--
--   * listing_access      — self check-in method, instructions, door code and
--     Wi-Fi credentials. These are SENSITIVE (a door code is a physical key),
--     so they deliberately live OUTSIDE the listings table: listings has a
--     `public_read_published` RLS policy that returns ALL columns to anon, and
--     Postgres RLS is row- not column-level — putting a door code on listings
--     would leak it to the whole internet. This table has host-manage RLS only
--     and NO public/guest read policy; the guest Trip page reads it via the
--     service role after verifying the booking is the guest's own, and gates
--     the code/Wi-Fi password to <=24h before check-in in app code.
--
--   * listing_local_picks — the host's nearby recommendations (eat / do / see).
--     Non-sensitive marketing, so it is public-readable (also reusable on the
--     public listing page later) and host-manage.
--
-- Pre-MVP data policy (CLAUDE.md): purely additive.

-- ─── 1. listing_access (one row per listing) ─────────────────
CREATE TABLE IF NOT EXISTS public.listing_access (
  listing_id           uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  check_in_method      text,
  check_in_instructions text,
  door_code            text,
  wifi_network         text,
  wifi_password        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_access ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_listing_access
  BEFORE UPDATE ON public.listing_access
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Host manages access rows for their own listings only. No anon/guest SELECT —
-- secrets reach the guest only through the server (service role) on their own
-- booking's Trip page.
DROP POLICY IF EXISTS listing_access_host_manage ON public.listing_access;
CREATE POLICY listing_access_host_manage ON public.listing_access
  FOR ALL TO authenticated
  USING (listing_id IN (SELECT id FROM public.listings WHERE host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid())))
  WITH CHECK (listing_id IN (SELECT id FROM public.listings WHERE host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid())));

COMMENT ON TABLE public.listing_access IS
  'Sensitive guest access details (door code, Wi-Fi, self check-in). Host-manage RLS only; NEVER publicly readable. Guests receive it server-side on their own confirmed booking, code/password gated to <=24h before check-in.';

-- ─── 2. listing_local_picks (nearby recommendations) ─────────
CREATE TABLE IF NOT EXISTS public.listing_local_picks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id     uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  category       text NOT NULL DEFAULT 'do'
                   CHECK (category IN ('eat', 'do', 'see', 'drink', 'shop', 'other')),
  title          text NOT NULL,
  blurb          text,
  image_path     text,
  distance_label text,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_local_picks_listing
  ON public.listing_local_picks(listing_id, sort_order);

ALTER TABLE public.listing_local_picks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_listing_local_picks
  BEFORE UPDATE ON public.listing_local_picks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS listing_local_picks_host_manage ON public.listing_local_picks;
CREATE POLICY listing_local_picks_host_manage ON public.listing_local_picks
  FOR ALL TO authenticated
  USING (listing_id IN (SELECT id FROM public.listings WHERE host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid())))
  WITH CHECK (listing_id IN (SELECT id FROM public.listings WHERE host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid())));

-- Non-sensitive marketing — readable by anyone (guest Trip page + public listing).
DROP POLICY IF EXISTS listing_local_picks_public_read ON public.listing_local_picks;
CREATE POLICY listing_local_picks_public_read ON public.listing_local_picks
  FOR SELECT TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.listing_local_picks IS
  'Host nearby recommendations (eat/do/see) shown on the guest Trip Details page. Public-readable, host-manage.';
