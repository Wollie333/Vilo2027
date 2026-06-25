-- Room detail page template (one per website).
--
-- The website builder gains a dynamic "Room details" page: a single editable
-- layout that every individual room renders through (public route
-- /rooms/<room-slug>). It is stored like any other page in `website_pages`, but
-- with a dedicated `kind = 'room_detail'` so it is:
--   • excluded from the normal slug routing + nav (rendered only via the room route),
--   • identifiable by the Pages manager + builder as the room template.
--
-- This widens the existing kind CHECK to add 'room_detail'. No data backfill —
-- the page is created lazily per website by the app (see actions.ts).
ALTER TABLE public.website_pages
  DROP CONSTRAINT IF EXISTS website_pages_kind_check;

-- NOTE: keep every kind already allowed by 20260619230000_add_page_kinds.sql
-- (home/about/rooms/contact/custom/specials/blog/checkout/thank-you) and add
-- 'room_detail'. Dropping any would violate existing rows.
ALTER TABLE public.website_pages
  ADD CONSTRAINT website_pages_kind_check
  CHECK (kind IN (
    'home', 'about', 'rooms', 'contact', 'custom',
    'specials', 'blog', 'checkout', 'thank-you',
    'room_detail'
  ));
