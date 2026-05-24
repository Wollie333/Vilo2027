-- Migration: Per-room drill-in editor fields
--
-- Adds the fields used by the /dashboard/listings/[id]/edit/rooms/[roomId]
-- drill-in editor: room size, bed type, view, free-form experience tags,
-- and a featured-photo pointer (cover image for the room card).
--
-- Pre-MVP data policy (CLAUDE.md): destructive reshape OK, no backfill.

ALTER TABLE public.listing_rooms
  ADD COLUMN room_size_sqm     numeric CHECK (room_size_sqm IS NULL OR room_size_sqm >= 0),
  ADD COLUMN bed_type          text    CHECK (bed_type IS NULL OR char_length(bed_type) <= 40),
  ADD COLUMN view_type         text    CHECK (view_type IS NULL OR char_length(view_type) <= 40),
  ADD COLUMN experiences       text[]  NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN featured_photo_id uuid    REFERENCES listing_photos(id) ON DELETE SET NULL;

COMMENT ON COLUMN listing_rooms.room_size_sqm IS
  'Optional room size in square metres. Surfaced on the public room detail card.';
COMMENT ON COLUMN listing_rooms.bed_type IS
  'Free-text bed configuration (King / Queen / Twin / Bunk / Sofa bed / etc).';
COMMENT ON COLUMN listing_rooms.view_type IS
  'Free-text view (Garden / Pool / Sea / Mountain / etc).';
COMMENT ON COLUMN listing_rooms.experiences IS
  'Free-form tags shown as chips on the room card (Breakfast included, Pet friendly, …). Empty array if none.';
COMMENT ON COLUMN listing_rooms.featured_photo_id IS
  'Optional pointer into listing_photos for the room cover. ON DELETE SET NULL keeps the room intact when its cover photo is removed.';

-- Fast lookup of which room each photo is the cover of (useful for the
-- listing editor when re-ordering or replacing).
CREATE INDEX idx_listing_rooms_featured_photo
  ON listing_rooms(featured_photo_id) WHERE featured_photo_id IS NOT NULL;
