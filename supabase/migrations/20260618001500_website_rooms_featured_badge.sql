-- Website CMS Rooms tab — featured + badge controls (enterprise build-out Phase 7).
--
-- Per-room cosmetic flags for the website rooms section: mark a room "featured"
-- (highlighted card) and/or attach a short custom badge ("Best for couples").
-- Cosmetic only — booking always re-prices server-side, so these never touch the
-- ledger. Property-level group heading/intro/hero live in the existing
-- website_properties.display_overrides jsonb (no new column needed there).

ALTER TABLE public.website_rooms
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS badge text;

COMMENT ON COLUMN public.website_rooms.featured IS
  'Cosmetic: highlight this room on the website rooms section.';
COMMENT ON COLUMN public.website_rooms.badge IS
  'Cosmetic: short custom label shown on the room card (e.g. "Best for couples").';
