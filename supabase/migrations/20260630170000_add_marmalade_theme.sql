-- Add the Marmalade House theme — a warm, photographic guesthouse look (butter-
-- cream ground, marmalade-orange accent, berry secondary, a floating pill menu
-- and tilted "postcard" cards). The founder's fourth pre-designed theme,
-- converted onto the standardised foundation. Added alongside Safari + Sabela +
-- Oceans View as another active theme (is_active = true, is_default = false).
--
-- `base` is copied into host_websites.theme on apply (buildSiteVars → --site-*):
--   Marmalade palette + homely font (Gloock heading / Karla body) + md corners.
--   The scoped render layer (.wielo-marmalade) carries the postcard look. The
--   page_templates seed website_pages on apply; props are terse because
--   parseSectionsLoose fills every default on read. Idempotent (upsert).
insert into public.site_themes
  (slug, name, description, preview_image_path, base, page_templates,
   is_active, is_premium, is_default, sort_order)
values
  ('marmalade', 'Marmalade House',
   'A warm, photographic guesthouse — butter-cream and marmalade, a floating pill menu, full-bleed photo heroes with an overlapping white postcard, and tilted, taped postcard cards throughout.',
   null,
   '{"label":"Marmalade House","palette":{"bg":"#F4ECDB","surface":"#FFFFFF","ink":"#2C2620","mute":"#6F6354","line":"#E4D6BE","accent":"#C8702E","accentInk":"#FFFFFF","secondary":"#9C3B52"},"font":"homely","radius":"md"}'::jsonb,
   '[
     {
       "kind": "home", "slug": "home", "title": "Home",
       "nav_label": "Home", "nav_order": 0, "show_in_nav": true,
       "sections": [
         {"id": "mh-home-hero", "type": "hero", "enabled": true, "props": {"eyebrow": "A guesthouse in the Karoo", "headline": "A little house that feeds you well.", "subheadline": "Five sunny rooms in a restored 1873 parsonage, a garden full of figs, and a breakfast worth setting an alarm for.", "cta_label": "See the rooms", "cta_href": "/rooms", "cta2_label": "Meet the house", "cta2_href": "/about", "align": "center", "variant": "fullscreen", "overlay": "medium", "textTone": "light", "height": "tall"}},
         {"id": "mh-home-availbar", "type": "booking_search", "enabled": true, "props": {}},
         {"id": "mh-home-intro", "type": "intro", "enabled": true, "props": {"eyebrow": "Welcome in", "heading": "It''s less a hotel, more a home with spare rooms.", "body": "We''re a five-room guesthouse in the old parsonage on Church Street — pressed ceilings, deep baths, a long table, and a garden the kitchen raids every morning.\n\nThere''s no front desk, no piped music, and no fee for booking straight with us. Just a key, a cup of tea on arrival, and whichever room suits you best.", "variant": "lead"}},
         {"id": "mh-home-rooms", "type": "rooms_preview", "enabled": true, "props": {"heading": "Pick a room, any room", "max": 6}},
         {"id": "mh-home-highlights", "type": "highlights", "enabled": true, "props": {"heading": "Small house, big mornings", "variant": "grid", "items": [{"title": "Breakfast in the garden", "body": "Fig jam, fresh bread and eggs from the hens out back, under the vine until ten."}, {"title": "Five rooms, all different", "body": "Each one named, each its own colour and quirk. The Fig Room is everyone''s favourite."}, {"title": "The village & the stars", "body": "A two-minute amble to dinner, and a Karoo sky that does the rest after dark."}]}},
         {"id": "mh-home-gallery", "type": "gallery", "enabled": true, "props": {"heading": "The house, in snapshots"}},
         {"id": "mh-home-reviews", "type": "reviews", "enabled": true, "props": {"heading": "What people write home", "max": 6}},
         {"id": "mh-home-location", "type": "location", "enabled": true, "props": {"heading": "34 Church Street, Prince Albert", "show_map": true, "variant": "split"}},
         {"id": "mh-home-cta", "type": "cta", "enabled": true, "props": {"heading": "Come stay a night or three", "body": "Booked direct with the house — the price you see is the price you pay, with breakfast and 0% booking fees.", "button_label": "Check availability", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "rooms", "slug": "rooms", "title": "Rooms",
       "nav_label": "Rooms", "nav_order": 1, "show_in_nav": true,
       "sections": [
         {"id": "mh-rooms-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "Rooms", "headline": "Five rooms, no two alike", "subheadline": "Each one named, each its own colour and quirk — and every one with breakfast, the garden, and a key that''s yours for the stay.", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "mh-rooms-included", "type": "amenities", "enabled": true, "props": {"variant": "inline", "items": [{"label": "Breakfast included"}, {"label": "Garden & stoep"}, {"label": "Free Wi-Fi & parking"}, {"label": "0% booking fees"}]}},
         {"id": "mh-rooms-rooms", "type": "rooms_preview", "enabled": true, "props": {"display": "showcase", "heading": "Where you''ll sleep", "max": 8}},
         {"id": "mh-rooms-pricing", "type": "pricing", "enabled": true, "props": {"heading": "Rates & seasons", "items": [{"label": "The Little Room", "price": "R980", "note": "per night, sleeps 1 · incl. breakfast"}, {"label": "The Fig Room", "price": "R1,450", "note": "per night, sleeps 2 · incl. breakfast"}, {"label": "The Stoep Suite", "price": "R2,300", "note": "per night, sleeps 4 · incl. breakfast"}], "footnote": "Every rate includes breakfast and all taxes — exactly what you pay when you book direct."}},
         {"id": "mh-rooms-cta", "type": "cta", "enabled": true, "props": {"heading": "Not sure which room?", "body": "Tell us who''s coming and when, and we''ll pick the right one and hold it for you.", "button_label": "Check availability", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "specials", "slug": "specials", "title": "Offers",
       "nav_label": "Offers", "nav_order": 2, "show_in_nav": true,
       "sections": [
         {"id": "mh-sp-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "Booked direct · 0% fees", "headline": "A few good reasons to stay longer", "subheadline": "Small offers for the unhurried, the spontaneous and the midweek wanderers. Every one booked straight with the house.", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "mh-sp-list", "type": "specials_preview", "enabled": true, "props": {"heading": "Current offers", "max": 12}},
         {"id": "mh-sp-cta", "type": "cta", "enabled": true, "props": {"heading": "Hear the next offer first", "body": "Our best rates rarely last a week. Leave your email and we''ll let you know the moment one opens.", "button_label": "Join the list", "button_href": "/contact", "variant": "banner"}}
       ]
     },
     {
       "kind": "experiences", "slug": "experiences", "title": "Things to do",
       "nav_label": "Things to do", "nav_order": 3, "show_in_nav": true,
       "sections": [
         {"id": "mh-ex-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "Things to do", "headline": "Slow days, full ones", "subheadline": "Do as little or as much as you like. Most of it begins at the breakfast table and ends on the stoep — but the Karoo''s right there when you want it.", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "mh-ex-cards", "type": "highlights", "enabled": true, "props": {"heading": "What there is to do", "variant": "grid", "items": [
           {"title": "Breakfast & the garden", "body": "Long, lazy breakfasts under the vine, then a wander through the fig and herb beds.", "image_path": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1100&q=80"},
           {"title": "The Swartberg Pass", "body": "One of the world''s great mountain drives, an hour from the door. We''ll pack you a picnic.", "image_path": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1100&q=80"},
           {"title": "Stargazing", "body": "Some of the darkest skies in the country. Pieter sets up the telescope on clear nights.", "image_path": "https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=1100&q=80"},
           {"title": "The village", "body": "Galleries, a bookshop and the best dinner in town — a two-minute amble from the door.", "image_path": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1100&q=80"},
           {"title": "Olive & wine tastings", "body": "A handful of small farms nearby pour beautifully. We''ll book you in and point the way.", "image_path": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1100&q=80"},
           {"title": "Just resting", "body": "A book, the hammock, the cat. Nobody will mind if you never leave the garden.", "image_path": "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1100&q=80"}
         ]}},
         {"id": "mh-ex-gallery", "type": "gallery", "enabled": true, "props": {"heading": "A few of the days"}},
         {"id": "mh-ex-cta", "type": "cta", "enabled": true, "props": {"heading": "Make a weekend of it", "body": "Tell us what you''re after — or nothing at all — and we''ll shape the days around you.", "button_label": "Book a room", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "gallery", "slug": "gallery", "title": "Gallery",
       "nav_label": "Gallery", "nav_order": 4, "show_in_nav": true,
       "sections": [
         {"id": "mh-gl-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "In pictures", "headline": "The album", "subheadline": "The rooms, the garden, the table and the village beyond.", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "mh-gl-grid", "type": "gallery", "enabled": true, "props": {"heading": ""}},
         {"id": "mh-gl-cta", "type": "cta", "enabled": true, "props": {"heading": "Better in person", "body": "Pictures only get you so far. Come see the house for yourself — booked direct, the price you see is the price you pay.", "button_label": "Book a room", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "about", "slug": "about", "title": "The House",
       "nav_label": "The House", "nav_order": 5, "show_in_nav": true,
       "sections": [
         {"id": "mh-about-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "The House", "headline": "A house with stories", "subheadline": "We didn''t set out to run a guesthouse. We set out to save an old house — and couldn''t bear to keep it to ourselves.", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "mh-about-host", "type": "host_bio", "enabled": true, "props": {"heading": "Your hosts", "name": "Hannah & Pieter, and a very old kitchen", "body": "We found the parsonage in 2019 — pressed ceilings sagging, a fig tree gone wild, and a kitchen built for feeding a congregation. Hannah cooks; Pieter pours the coffee and knows every walk in the Swartberg. It''s just us — which is rather the point."}},
         {"id": "mh-about-values", "type": "values", "enabled": true, "props": {"heading": "Four house rules we keep", "items": [{"title": "Breakfast comes first", "body": "Made from scratch, from the garden where we can. The heart of the house, not an add-on."}, {"title": "Stay small", "body": "Five rooms is exactly enough to know your name and still get the bread out on time."}, {"title": "Gentle on the village", "body": "Solar where we can, water we''re careful with, everything bought down the road."}, {"title": "Honest pricing", "body": "Book direct and pay what you see. No agents, no surcharges, no fee at checkout."}]}},
         {"id": "mh-about-stats", "type": "stats", "enabled": true, "props": {"items": [{"value": "1873", "label": "The old parsonage"}, {"value": "5", "label": "Rooms, all different"}, {"value": "2", "label": "Hens (and Biscuit)"}, {"value": "4.97", "label": "From 240 stays"}]}},
         {"id": "mh-about-gallery", "type": "gallery", "enabled": true, "props": {"heading": "Bits and pieces of home"}},
         {"id": "mh-about-cta", "type": "cta", "enabled": true, "props": {"heading": "There''s a room with your name on it", "body": "Five rooms, one very good breakfast, booked direct with the house.", "button_label": "See the rooms", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "blog", "slug": "journal", "title": "Journal",
       "nav_label": "Journal", "nav_order": 6, "show_in_nav": true,
       "sections": [
         {"id": "mh-blog-intro", "type": "intro", "enabled": true, "props": {"eyebrow": "Notes from the kitchen", "heading": "The journal", "body": "Recipes, the garden, the village and the odd strong opinion — little stories from our corner of the Karoo.", "variant": "centered"}},
         {"id": "mh-blog-list", "type": "blog_preview", "enabled": true, "props": {"display": "journal", "heading": "From the journal", "max": 9}}
       ]
     },
     {
       "kind": "contact", "slug": "contact", "title": "Contact",
       "nav_label": "Contact", "nav_order": 7, "show_in_nav": true,
       "sections": [
         {"id": "mh-contact-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "Say hello", "headline": "Drop us a line", "subheadline": "Booking, a special request, or just a question — a real person at the house replies within a day.", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "mh-contact-form", "type": "contact_form", "enabled": true, "props": {"heading": "Tell us about your stay", "body": "A real person at the house replies within a day.", "variant": "split"}},
         {"id": "mh-contact-location", "type": "location", "enabled": true, "props": {"heading": "Finding us", "show_map": true, "variant": "split"}},
         {"id": "mh-contact-faq", "type": "faq", "enabled": true, "props": {"heading": "Frequently asked", "variant": "accordion", "items": [{"q": "Check-in & check-out?", "a": "Check-in from 2pm, check-out by 10am. Arriving early or leaving late? Tell us — we''ll mind your bags and the garden''s always open to you."}, {"q": "Is breakfast included?", "a": "Always. A proper made-from-scratch breakfast under the vine, 7 to 10, from the garden where we can. Dietary things are no trouble — just tell us."}, {"q": "Cancellation policy?", "a": "Free cancellation up to 48 hours before arrival on every direct booking, with a full refund. Because you book straight with us, there''s nothing layered on top."}]}}
       ]
     },
     {
       "kind": "checkout", "slug": "checkout", "title": "Book",
       "nav_label": null, "nav_order": 800, "show_in_nav": false,
       "sections": [
         {"id": "mh-checkout-intro", "type": "intro", "enabled": true, "props": {"heading": "Complete your booking", "body": "Almost there. Review your details below and confirm your stay — we''ll have the kettle on and your room ready.", "variant": "centered"}}
       ]
     },
     {
       "kind": "thank-you", "slug": "thank-you", "title": "Thank you",
       "nav_label": null, "nav_order": 810, "show_in_nav": false,
       "sections": [
         {"id": "mh-thankyou-intro", "type": "intro", "enabled": true, "props": {"heading": "You''re booked", "body": "A confirmation''s on its way to your inbox. We''ll have the kettle on and your room ready. See you soon.", "variant": "centered"}}
       ]
     }
   ]'::jsonb,
   true, false, false, 5)
on conflict (slug) do update set
  name               = excluded.name,
  description        = excluded.description,
  preview_image_path = excluded.preview_image_path,
  base               = excluded.base,
  page_templates     = excluded.page_templates,
  is_active          = true,
  is_premium         = false,
  is_default         = false,
  sort_order         = 5,
  deleted_at         = null;
