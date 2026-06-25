-- Per-website, per-room media overrides for the room-detail page gallery.
--
-- By default a room's detail page shows ALL of that room's photos
-- (property_photos). This lets a host, PER WEBSITE, hide some of those photos
-- from the room page (without touching the room itself) and add extra images
-- uploaded to the website media library — managed from the CMS Media tab.
--
-- Shape (jsonb):
--   {
--     "hidden": ["<property_photo id>", ...],          -- hidden from the room page only
--     "extra":  [{ "path": "<website-assets path>", "alt": "..." }, ...]
--   }
ALTER TABLE public.website_rooms
  ADD COLUMN IF NOT EXISTS media_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
