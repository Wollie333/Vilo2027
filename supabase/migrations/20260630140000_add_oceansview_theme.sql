-- Add the Oceans View theme — a bright Mediterranean beach-resort look (white
-- ground, deep teal-navy ink, aqua accent, coral secondary, rounded forms,
-- Bricolage Grotesque display + Manrope body). The founder's third pre-designed
-- theme, converted onto the standardised foundation. Added alongside Safari +
-- Sabela as another active theme (is_active = true, is_default = false).
--
-- `base` is copied into host_websites.theme on apply (buildSiteVars → --site-*):
--   Lagoon palette + grotesk font (Bricolage Grotesque heading / Manrope body)
--   + rounded (lg) corners. The scoped render layer (.wielo-oceansview) carries
--   the rest. `page_templates` seed website_pages on apply; props are terse
--   because parseSectionsLoose fills every default on read. Idempotent (upsert).
insert into public.site_themes
  (slug, name, description, preview_image_path, base, page_templates,
   is_active, is_premium, is_default, sort_order)
values
  ('oceansview', 'Oceans View',
   'Bright Mediterranean beach resort — white and sand, aqua and coral, with bold grotesk headlines and soft rounded forms by the sea.',
   'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNTAwIiB2aWV3Qm94PSIwIDAgODAwIDUwMCIgZm9udC1mYW1pbHk9IidUcmVidWNoZXQgTVMnLCBzYW5zLXNlcmlmIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ic2VhIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzdGRDNERCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNiIgc3RvcC1jb2xvcj0iIzEyQTVCNSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwRTJDM0EiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNTAwIiBmaWxsPSIjRkZGRkZGIi8+CiAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjgwMCIgaGVpZ2h0PSI1NiIgZmlsbD0iI0ZGRkZGRiIvPgogIDxyZWN0IHg9IjAiIHk9IjU2IiB3aWR0aD0iODAwIiBoZWlnaHQ9IjEiIGZpbGw9IiNFOUUxRDEiLz4KICA8Y2lyY2xlIGN4PSI0OCIgY3k9IjI4IiByPSI5IiBmaWxsPSIjMTJBNUI1Ii8+CiAgPHRleHQgeD0iNjYiIHk9IjMzIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iODAwIiBmaWxsPSIjMEUyQzNBIj5PY2VhbiBMb2RnZTwvdGV4dD4KICA8dGV4dCB4PSI1MDAiIHk9IjMyIiBmb250LXNpemU9IjExIiBmaWxsPSIjNUU3ODg0Ij5Sb29tczwvdGV4dD4KICA8dGV4dCB4PSI1NTYiIHk9IjMyIiBmb250LXNpemU9IjExIiBmaWxsPSIjNUU3ODg0Ij5FeHBlcmllbmNlczwvdGV4dD4KICA8dGV4dCB4PSI2NDQiIHk9IjMyIiBmb250LXNpemU9IjExIiBmaWxsPSIjNUU3ODg0Ij5Kb3VybmFsPC90ZXh0PgogIDxyZWN0IHg9IjcwNiIgeT0iMTQiIHdpZHRoPSI2NCIgaGVpZ2h0PSIyOCIgcng9IjE0IiBmaWxsPSIjMTJBNUI1Ii8+CiAgPHRleHQgeD0iNzM4IiB5PSIzMiIgZm9udC1zaXplPSIxMC41IiBmaWxsPSIjRkZGRkZGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iNzAwIj5Cb29rPC90ZXh0PgogIDxyZWN0IHg9IjQzMCIgeT0iODYiIHdpZHRoPSIzMzAiIGhlaWdodD0iMzI2IiByeD0iMjQiIGZpbGw9InVybCgjc2VhKSIvPgogIDxjaXJjbGUgY3g9IjY5MCIgY3k9IjE1MCIgcj0iMzAiIGZpbGw9IiNGRkY0RTAiIG9wYWNpdHk9IjAuOSIvPgogIDxwYXRoIGQ9Ik00MzAgMzYwIFE1MDAgMzMwIDU2MCAzNTIgVDY5MCAzNDggVDc2MCAzNjAgVjQxMiBINDMwIFoiIGZpbGw9IiNGRkZGRkYiIG9wYWNpdHk9IjAuMjUiLz4KICA8dGV4dCB4PSI0MCIgeT0iMTUwIiBmb250LXNpemU9IjQ0IiBmb250LXdlaWdodD0iODAwIiBmaWxsPSIjMEUyQzNBIj5XYWtlIHVwIHRvPC90ZXh0PgogIDx0ZXh0IHg9IjQwIiB5PSIyMDAiIGZvbnQtc2l6ZT0iNDQiIGZvbnQtd2VpZ2h0PSI4MDAiIGZpbGw9IiMxMkE1QjUiPnRoZSBvY2VhbjwvdGV4dD4KICA8cmVjdCB4PSI0MCIgeT0iMjI2IiB3aWR0aD0iMzAwIiBoZWlnaHQ9IjkiIHJ4PSI0LjUiIGZpbGw9IiNGN0YxRTYiLz4KICA8cmVjdCB4PSI0MCIgeT0iMjQ2IiB3aWR0aD0iMjMwIiBoZWlnaHQ9IjkiIHJ4PSI0LjUiIGZpbGw9IiNGN0YxRTYiLz4KICA8cmVjdCB4PSI0MCIgeT0iMjgyIiB3aWR0aD0iMTUwIiBoZWlnaHQ9IjQwIiByeD0iMjAiIGZpbGw9IiMxMkE1QjUiLz4KICA8dGV4dCB4PSIxMTUiIHk9IjMwNyIgZm9udC1zaXplPSIxMi41IiBmaWxsPSIjRkZGRkZGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iNzAwIj5Cb29rIGEgcm9vbTwvdGV4dD4KICA8cmVjdCB4PSIyMDYiIHk9IjI4MiIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0MCIgcng9IjIwIiBmaWxsPSIjRkZGRkZGIiBzdHJva2U9IiNFOUUxRDEiLz4KICA8dGV4dCB4PSIyNjYiIHk9IjMwNyIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzBFMkMzQSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RXhwbG9yZTwvdGV4dD4KICA8Zz4KICAgIDxyZWN0IHg9IjQwIiB5PSIzNTAiIHdpZHRoPSIyMjYiIGhlaWdodD0iMTIwIiByeD0iMjIiIGZpbGw9IiNGRkZGRkYiIHN0cm9rZT0iI0U5RTFEMSIvPgogICAgPHJlY3QgeD0iNDAiIHk9IjM1MCIgd2lkdGg9IjIyNiIgaGVpZ2h0PSI2NCIgcng9IjIyIiBmaWxsPSIjN0ZEM0REIi8+CiAgICA8cmVjdCB4PSI1NiIgeT0iNDMwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkiIHJ4PSI0LjUiIGZpbGw9IiMwRTJDM0EiLz4KICAgIDxyZWN0IHg9IjU2IiB5PSI0NDciIHdpZHRoPSI3OCIgaGVpZ2h0PSI3IiByeD0iMy41IiBmaWxsPSIjRkY2QjU3Ii8+CiAgPC9nPgogIDxnPgogICAgPHJlY3QgeD0iMjg3IiB5PSIzNTAiIHdpZHRoPSIyMjYiIGhlaWdodD0iMTIwIiByeD0iMjIiIGZpbGw9IiNGRkZGRkYiIHN0cm9rZT0iI0U5RTFEMSIvPgogICAgPHJlY3QgeD0iMjg3IiB5PSIzNTAiIHdpZHRoPSIyMjYiIGhlaWdodD0iNjQiIHJ4PSIyMiIgZmlsbD0iIzEyQTVCNSIvPgogICAgPHJlY3QgeD0iMzAzIiB5PSI0MzAiIHdpZHRoPSIxMjAiIGhlaWdodD0iOSIgcng9IjQuNSIgZmlsbD0iIzBFMkMzQSIvPgogICAgPHJlY3QgeD0iMzAzIiB5PSI0NDciIHdpZHRoPSI3OCIgaGVpZ2h0PSI3IiByeD0iMy41IiBmaWxsPSIjRkY2QjU3Ii8+CiAgPC9nPgo8L3N2Zz4K',
   '{"label":"Oceans View","palette":{"bg":"#FFFFFF","surface":"#FFFFFF","ink":"#0E2C3A","mute":"#5E7884","line":"#E9E1D1","accent":"#12A5B5","accentInk":"#FFFFFF","secondary":"#FF6B57"},"font":"grotesk","radius":"lg"}'::jsonb,
   '[
     {
       "kind": "home", "slug": "home", "title": "Home",
       "nav_label": "Home", "nav_order": 0, "show_in_nav": true,
       "sections": [
         {"id": "ov-home-hero", "type": "hero", "enabled": true, "props": {"headline": "Wake up to the ocean", "subheadline": "A bright beachfront resort where the Atlantic starts at your door — sea-view rooms, three pools, a spa, and tables that watch the sun go down.", "cta_label": "Book a room", "cta_href": "/rooms", "cta2_label": "Explore the resort", "cta2_href": "/about", "align": "left", "variant": "fullscreen", "overlay": "medium", "textTone": "light", "height": "tall"}},
         {"id": "ov-home-intro", "type": "intro", "enabled": true, "props": {"eyebrow": "Barefoot luxury", "heading": "Barefoot luxury, on the bay", "body": "Days here run on ocean time — a swim before breakfast, long lunches in the shade, the slow gold of the afternoon, and the sound of the surf to fall asleep to.", "variant": "lead"}},
         {"id": "ov-home-exp", "type": "highlights", "enabled": true, "props": {"heading": "Everything taken care of", "variant": "grid", "items": [{"icon": "Waves", "title": "Three pools & the sea", "body": "Two heated pools, a lap pool and a private path straight onto the sand."}, {"icon": "Utensils", "title": "Tables by the water", "body": "Sea-to-table menus and sundowners with the best view on the bay."}, {"icon": "Sparkles", "title": "Spa & wellness", "body": "Ocean-air treatments, a sauna, and morning yoga on the deck."}]}},
         {"id": "ov-home-rooms", "type": "rooms_preview", "enabled": true, "props": {"heading": "Rooms that face the water", "max": 6}},
         {"id": "ov-home-gallery", "type": "gallery", "enabled": true, "props": {"heading": "Postcards from the bay"}},
         {"id": "ov-home-reviews", "type": "reviews", "enabled": true, "props": {"heading": "The reviews say it best", "max": 6}},
         {"id": "ov-home-location", "type": "location", "enabled": true, "props": {"heading": "Right on the bay", "show_map": true, "variant": "split"}},
         {"id": "ov-home-cta", "type": "cta", "enabled": true, "props": {"heading": "Your room by the sea is waiting", "body": "Book direct for the best rate and a free upgrade when we can. We will take care of the rest.", "button_label": "Book a room", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "about", "slug": "about", "title": "About",
       "nav_label": "About", "nav_order": 1, "show_in_nav": true,
       "sections": [
         {"id": "ov-about-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "About", "headline": "A family, and a stretch of sand", "subheadline": "Three generations on this beach, and one simple idea: a place by the sea where everything is taken care of and nothing is rushed.", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "ov-about-intro", "type": "intro", "enabled": true, "props": {"eyebrow": "Our story", "heading": "It started with the view", "body": "Tell guests who you are and why you host: the beach, the welcome, and why people come back every summer. A paragraph or two is plenty.", "variant": "lead"}},
         {"id": "ov-about-stats", "type": "stats", "enabled": true, "props": {"items": [{"value": "40", "label": "Years on the bay"}, {"value": "32", "label": "Sea-view rooms"}, {"value": "3", "label": "Pools"}, {"value": "0%", "label": "Booking fees"}]}},
         {"id": "ov-about-host", "type": "host_bio", "enabled": true, "props": {"heading": "Your hosts", "name": "The Marais family", "body": "A few warm lines about the people who will welcome you to the bay, and what they love most about life by the sea."}},
         {"id": "ov-about-values", "type": "values", "enabled": true, "props": {"heading": "What we stand for", "items": [{"title": "The sea comes first", "body": "We keep the bay clean and the beach wild, with regular clean-ups and gentle building."}, {"title": "Honest pricing", "body": "One fair rate, booked direct. No agents, no booking fees, no surprises at checkout."}, {"title": "People of the bay", "body": "Our team grew up on this coast — their warmth and know-how are the real luxury."}]}},
         {"id": "ov-about-cta", "type": "cta", "enabled": true, "props": {"heading": "Come see it for yourself", "body": "Book direct for the best rate on the bay.", "button_label": "Book a room", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "rooms", "slug": "rooms", "title": "Rooms",
       "nav_label": "Rooms", "nav_order": 2, "show_in_nav": true,
       "sections": [
         {"id": "ov-rooms-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "Rooms & suites", "headline": "Rooms & suites by the sea", "subheadline": "Every room looks out to the water, each one a little different. Choose the one that fits your stay.", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "ov-rooms-included", "type": "amenities", "enabled": true, "props": {"variant": "inline", "items": [{"label": "Sea view"}, {"label": "Breakfast included"}, {"label": "Pool & beach access"}, {"label": "0% booking fees"}]}},
         {"id": "ov-rooms-rooms", "type": "rooms_preview", "enabled": true, "props": {"display": "showcase", "heading": "Where you will stay", "max": 8}},
         {"id": "ov-rooms-pricing", "type": "pricing", "enabled": true, "props": {"heading": "Rates", "items": [{"label": "Sea-view room", "price": "R2 950", "note": "per night, incl. breakfast"}, {"label": "Ocean suite", "price": "R4 500", "note": "per night, incl. breakfast"}], "footnote": "Rates are indicative and include breakfast. Your final price is confirmed at booking."}},
         {"id": "ov-rooms-cta", "type": "cta", "enabled": true, "props": {"heading": "Your room by the sea is waiting", "body": "Book direct for the best rate on the bay.", "button_label": "Book a room", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "contact", "slug": "contact", "title": "Contact",
       "nav_label": "Contact", "nav_order": 3, "show_in_nav": true,
       "sections": [
         {"id": "ov-contact-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "Contact", "headline": "Say hello", "subheadline": "Tell us your dates and what you are hoping for. A real person on the bay replies within a day.", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "ov-contact-form", "type": "contact_form", "enabled": true, "props": {"heading": "Send a message", "body": "We usually reply within a few hours.", "variant": "split"}},
         {"id": "ov-contact-location", "type": "location", "enabled": true, "props": {"heading": "Right on the bay", "show_map": true, "variant": "split"}},
         {"id": "ov-contact-faq", "type": "faq", "enabled": true, "props": {"heading": "Good to know", "variant": "accordion", "items": [{"q": "How do we get there?", "a": "We are a short drive from the city, right on the beachfront. Full directions follow your booking."}, {"q": "Is there parking?", "a": "Yes, free secure parking for every room, plus easy drop-off at the door."}, {"q": "What is included?", "a": "Rates include breakfast, pool and beach access. Replace this with your own inclusions."}]}}
       ]
     },
     {
       "kind": "blog", "slug": "blog", "title": "Journal",
       "nav_label": "Journal", "nav_order": 4, "show_in_nav": true,
       "sections": [
         {"id": "ov-blog-intro", "type": "intro", "enabled": true, "props": {"eyebrow": "The journal", "heading": "The journal", "body": "Notes from the bay: sea-to-table recipes, what to do nearby, and life on the coast.", "variant": "centered"}},
         {"id": "ov-blog-list", "type": "blog_preview", "enabled": true, "props": {"heading": "Latest from the journal", "max": 6}}
       ]
     },
     {
       "kind": "checkout", "slug": "checkout", "title": "Book",
       "nav_label": null, "nav_order": 800, "show_in_nav": false,
       "sections": [
         {"id": "ov-checkout-intro", "type": "intro", "enabled": true, "props": {"heading": "Complete your booking", "body": "You are almost there. Review your details below and confirm your stay. We cannot wait to welcome you to the bay.", "variant": "centered"}}
       ]
     },
     {
       "kind": "thank-you", "slug": "thank-you", "title": "Thank you",
       "nav_label": null, "nav_order": 810, "show_in_nav": false,
       "sections": [
         {"id": "ov-thankyou-intro", "type": "intro", "enabled": true, "props": {"heading": "Thank you", "body": "Your booking is confirmed. We have sent an email with all the details. We look forward to welcoming you to the bay.", "variant": "centered"}}
       ]
     }
   ]'::jsonb,
   true, false, false, 4)
on conflict (slug) do update set
  name               = excluded.name,
  description        = excluded.description,
  preview_image_path = excluded.preview_image_path,
  base               = excluded.base,
  page_templates     = excluded.page_templates,
  is_active          = true,
  is_premium         = false,
  is_default         = false,
  sort_order         = 4,
  deleted_at         = null;
