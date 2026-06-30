-- Standard theme page-set kinds (THEME_CONTRACT.md — "The canonical page set
-- every theme MUST ship", 2026-06-30).
--
-- Every theme now ships a fixed page set. Three of those pages did not have a
-- first-class `kind` yet:
--   • 'experiences'    — Class 1 marketing page (activities / things to do)
--   • 'gallery'        — Class 1 marketing page (full photo gallery)
--   • 'search_results' — Class 2 system template (booking_search routes here,
--                        then Results → Checkout). NOT shown in nav.
--
-- Making them real kinds lets the Pages manager group them (Site pages vs System
-- templates), the nav auto-builder treat 'search_results' as a non-nav system
-- page, and theme blueprints seed them deterministically. No data backfill — the
-- pages are seeded per website by the app (seedWebsiteContent / theme templates).
ALTER TABLE public.website_pages
  DROP CONSTRAINT IF EXISTS website_pages_kind_check;

-- Keep every kind already allowed by 20260625000000_website_room_detail_page_kind
-- (home/about/rooms/contact/custom/specials/blog/checkout/thank-you/room_detail)
-- and add 'experiences', 'gallery', 'search_results'. Dropping any would violate
-- existing rows.
ALTER TABLE public.website_pages
  ADD CONSTRAINT website_pages_kind_check
  CHECK (kind IN (
    'home', 'about', 'rooms', 'contact', 'custom',
    'specials', 'blog', 'checkout', 'thank-you',
    'room_detail',
    'experiences', 'gallery', 'search_results'
  ));
