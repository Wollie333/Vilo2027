-- Add the Sabela Lodge theme — a dark-first, editorial safari-lodge look (deep
-- ebony ground, brand-gold accent, Cormorant Garamond display headings). The
-- founder's second pre-designed theme, converted onto the standardised theme
-- foundation. Added alongside Safari as a SECOND selectable theme
-- (is_active = true, is_default = false). loadActiveThemes offers every active
-- theme, so both appear in the Brand Studio gallery.
--
-- `base` is copied into host_websites.theme on apply (buildSiteVars → --site-*):
--   Ebony palette + Cormorant Garamond display (font "elegant") + sharp (sm)
--   corners. The scoped render layer (.wielo-sabela) carries the rest.
-- `page_templates` seed website_pages on apply; props are terse because
-- parseSectionsLoose fills every default on read. Idempotent (upsert on slug).
insert into public.site_themes
  (slug, name, description, preview_image_path, base, page_templates,
   is_active, is_premium, is_default, sort_order)
values
  ('sabela', 'Sabela Lodge',
   'Dark-first editorial safari lodge — deep ebony ground, brand-gold accent, and Cormorant Garamond headlines under a private-reserve sky.',
   'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNTAwIiB2aWV3Qm94PSIwIDAgODAwIDUwMCIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsICdUaW1lcyBOZXcgUm9tYW4nLCBzZXJpZiI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImVib255IiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzJBMjQxOCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNTUiIHN0b3AtY29sb3I9IiMxQzE5MTMiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMEMwQTA2Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjUwMCIgZmlsbD0iIzE0MTIwRCIvPgogIDxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI4MDAiIGhlaWdodD0iNTYiIGZpbGw9IiMwQzBBMDYiLz4KICA8cmVjdCB4PSIwIiB5PSI1NiIgd2lkdGg9IjgwMCIgaGVpZ2h0PSIxIiBmaWxsPSIjMkIyNjE4Ii8+CiAgPGNpcmNsZSBjeD0iNDgiIGN5PSIyOCIgcj0iOCIgZmlsbD0iI0M5QTI0QSIvPgogIDx0ZXh0IHg9IjY0IiB5PSIzMyIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI0YxRUFEQiIgbGV0dGVyLXNwYWNpbmc9IjIiPlNBQkVMQTwvdGV4dD4KICA8dGV4dCB4PSI0ODYiIHk9IjMyIiBmb250LXNpemU9IjExIiBmaWxsPSIjQTk5QjdGIj5TdWl0ZXM8L3RleHQ+CiAgPHRleHQgeD0iNTQ2IiB5PSIzMiIgZm9udC1zaXplPSIxMSIgZmlsbD0iI0E5OUI3RiI+RXhwZXJpZW5jZXM8L3RleHQ+CiAgPHRleHQgeD0iNjMwIiB5PSIzMiIgZm9udC1zaXplPSIxMSIgZmlsbD0iI0E5OUI3RiI+Sm91cm5hbDwvdGV4dD4KICA8cmVjdCB4PSI3MDAiIHk9IjE1IiB3aWR0aD0iNjYiIGhlaWdodD0iMjYiIHJ4PSIzIiBmaWxsPSIjQzlBMjRBIi8+CiAgPHRleHQgeD0iNzMzIiB5PSIzMiIgZm9udC1zaXplPSIxMC41IiBmaWxsPSIjMTUxMjBCIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iNjAwIj5FbnF1aXJlPC90ZXh0PgogIDxyZWN0IHg9IjQzMCIgeT0iODgiIHdpZHRoPSIzMzAiIGhlaWdodD0iMzIwIiByeD0iNCIgZmlsbD0idXJsKCNlYm9ueSkiLz4KICA8cGF0aCBkPSJNNDcwIDQwOCBWMzQwIHEwIC0yMCAxOCAtMjggcS0yNiAzIC0zOCAtMTAgcTE4IDUgMzggLTUgcS0xMCAtMTggMyAtMzMgcTUgMTggMjMgMjAgcTE4IC0xMyAzOCAtMyBxLTE1IDggLTEzIDIzIHEyMCAtNSAzMCAxMCBxLTIzIDAgLTI4IDE1IFY0MDggWiIgZmlsbD0iIzBDMEEwNiIgb3BhY2l0eT0iMC42Ii8+CiAgPHRleHQgeD0iNDAiIHk9IjE1MCIgZm9udC1zaXplPSI0MCIgZm9udC1zdHlsZT0iaXRhbGljIiBmaWxsPSIjRjFFQURCIj5XaGVyZSB0aGUgd2lsZCBzdGlsbDwvdGV4dD4KICA8dGV4dCB4PSI0MCIgeT0iMjAwIiBmb250LXNpemU9IjQwIiBmb250LXN0eWxlPSJpdGFsaWMiIGZpbGw9IiNGMUVBREIiPmtlZXBzIGl0cyBzZWNyZXRzPC90ZXh0PgogIDxyZWN0IHg9IjQwIiB5PSIyMjYiIHdpZHRoPSIzMDAiIGhlaWdodD0iOCIgcng9IjQiIGZpbGw9IiMyQjI2MTgiLz4KICA8cmVjdCB4PSI0MCIgeT0iMjQ2IiB3aWR0aD0iMjQwIiBoZWlnaHQ9IjgiIHJ4PSI0IiBmaWxsPSIjMkIyNjE4Ii8+CiAgPHJlY3QgeD0iNDAiIHk9IjI4MCIgd2lkdGg9IjE2MCIgaGVpZ2h0PSIzOCIgcng9IjMiIGZpbGw9IiNDOUEyNEEiLz4KICA8dGV4dCB4PSIxMjAiIHk9IjMwNCIgZm9udC1zaXplPSIxMi41IiBmaWxsPSIjMTUxMjBCIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iNjAwIj5QbGFuIHlvdXIgc2FmYXJpPC90ZXh0PgogIDxnPgogICAgPHJlY3QgeD0iNDAiIHk9IjM1MCIgd2lkdGg9IjIyNiIgaGVpZ2h0PSIxMTgiIHJ4PSI0IiBmaWxsPSIjMUMxOTEzIiBzdHJva2U9IiMyQjI2MTgiLz4KICAgIDxyZWN0IHg9IjUyIiB5PSIzNjIiIHdpZHRoPSIyMDIiIGhlaWdodD0iNTgiIHJ4PSIzIiBmaWxsPSIjMkEyNDE4Ii8+CiAgICA8cmVjdCB4PSI1MiIgeT0iNDMwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgiIHJ4PSI0IiBmaWxsPSIjQzlBMjRBIi8+CiAgPC9nPgogIDxnPgogICAgPHJlY3QgeD0iMjg3IiB5PSIzNTAiIHdpZHRoPSIyMjYiIGhlaWdodD0iMTE4IiByeD0iNCIgZmlsbD0iIzFDMTkxMyIgc3Ryb2tlPSIjMkIyNjE4Ii8+CiAgICA8cmVjdCB4PSIyOTkiIHk9IjM2MiIgd2lkdGg9IjIwMiIgaGVpZ2h0PSI1OCIgcng9IjMiIGZpbGw9IiMyQTI0MTgiLz4KICAgIDxyZWN0IHg9IjI5OSIgeT0iNDMwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgiIHJ4PSI0IiBmaWxsPSIjQzlBMjRBIi8+CiAgPC9nPgo8L3N2Zz4K',
   '{"label":"Sabela Lodge","palette":{"bg":"#14120D","surface":"#1C1913","ink":"#F1EADB","mute":"#A99B7F","line":"#2B2618","accent":"#C9A24A","accentInk":"#15120B","secondary":"#E7DCC4"},"font":"elegant","radius":"sm"}'::jsonb,
   '[
     {
       "kind": "home", "slug": "home", "title": "Home",
       "nav_label": "Home", "nav_order": 0, "show_in_nav": true,
       "sections": [
         {"id": "sabela-home-hero", "type": "hero", "enabled": true, "tone": "dark", "props": {"headline": "Where the wild still keeps its secrets", "subheadline": "An intimate, design-led safari lodge on a private reserve. Eight suites, twice-daily game drives, and nothing between you and the bush.", "cta_label": "Plan your safari", "cta_href": "/rooms", "cta2_label": "Our story", "cta2_href": "/about", "align": "left", "variant": "fullscreen", "overlay": "strong", "textTone": "light", "height": "tall"}},
         {"id": "sabela-home-intro", "type": "intro", "enabled": true, "props": {"eyebrow": "The Sabela experience", "heading": "A safari measured in moments, not checklists", "body": "Some places you pass through. This one stays with you. Days here move to the rhythm of the reserve: first light on the riverbed, long drives, the slow hush of the afternoon, and a fire under more stars than you have ever seen.", "variant": "lead"}},
         {"id": "sabela-home-exp", "type": "highlights", "enabled": true, "tone": "dark", "props": {"heading": "The reserve, unhurried", "variant": "grid", "items": [{"icon": "Sunrise", "title": "Twice-daily game drives", "body": "Dawn and dusk on open vehicles with an expert guide and tracker."}, {"icon": "Moon", "title": "Eight suites, nothing more", "body": "A small camp by design, so the bush stays quiet and yours."}, {"icon": "Flame", "title": "The table & the fire", "body": "Long dinners under the stars, the boma fire, and stories that run late."}]}},
         {"id": "sabela-home-rooms", "type": "rooms_preview", "enabled": true, "props": {"heading": "Eight suites along the riverbed", "max": 6}},
         {"id": "sabela-home-gallery", "type": "gallery", "enabled": true, "props": {"heading": "The reserve, in fragments"}},
         {"id": "sabela-home-reviews", "type": "reviews", "enabled": true, "props": {"heading": "Guests arrive curious. They leave changed.", "max": 6}},
         {"id": "sabela-home-location", "type": "location", "enabled": true, "tone": "dark", "props": {"heading": "Closer than you think", "show_map": true, "variant": "split"}},
         {"id": "sabela-home-cta", "type": "cta", "enabled": true, "tone": "dark", "props": {"heading": "Your safari begins with a single message", "body": "Book direct for the best rate and first pick of the season. We will take care of the rest.", "button_label": "Plan your safari", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "about", "slug": "about", "title": "About",
       "nav_label": "About", "nav_order": 1, "show_in_nav": true,
       "sections": [
         {"id": "sabela-about-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "About", "headline": "A camp built to disappear into the bush", "subheadline": "Low, quiet, and shaped around the land it sits on. Eight suites, one table, and a reserve we have spent years giving back to the wild.", "cta_label": "See the suites", "cta_href": "/rooms", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "sabela-about-intro", "type": "intro", "enabled": true, "props": {"eyebrow": "Our story", "heading": "The land came first", "body": "Sabela began with a single idea: take the fences down and let the bush decide what it wanted to be. Tell guests who you are and why you host, the welcome, and why people make the journey. A paragraph or two is plenty.", "variant": "lead"}},
         {"id": "sabela-about-stats", "type": "stats", "enabled": true, "props": {"items": [{"value": "12,000", "label": "Hectares of wilderness"}, {"value": "8", "label": "Suites only"}, {"value": "340+", "label": "Species recorded"}, {"value": "0", "label": "Internal fences"}]}},
         {"id": "sabela-about-host", "type": "host_bio", "enabled": true, "props": {"heading": "Your team in the bush", "name": "Themba Nkosi & the Sabela guides", "body": "A few warm lines about the people who will share the reserve with you, and what they love most about this corner of the bush."}},
         {"id": "sabela-about-values", "type": "values", "enabled": true, "props": {"heading": "Three commitments behind every stay", "items": [{"title": "Space, not crowds", "body": "Never more than a handful of guests in the vehicle, and often it is just you and your ranger under the whole sky."}, {"title": "Honest pricing", "body": "One inclusive rate, booked direct. No agents, no booking fees, no commission. The price you are quoted is the price you pay."}, {"title": "People of this place", "body": "Our guides, trackers and cooks were raised here. Their knowledge is not trained, it is inherited."}]}},
         {"id": "sabela-about-cta", "type": "cta", "enabled": true, "tone": "dark", "props": {"heading": "Come see it for yourself", "body": "Book direct for the best rate and first pick of the season.", "button_label": "Plan your safari", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "rooms", "slug": "rooms", "title": "Suites",
       "nav_label": "Suites", "nav_order": 2, "show_in_nav": true,
       "sections": [
         {"id": "sabela-rooms-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "The suites", "headline": "Eight suites along the riverbed", "subheadline": "Each opens onto the reserve, each fully inclusive of meals, game drives and transfers. Choose the one that fits your stay.", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "sabela-rooms-included", "type": "amenities", "enabled": true, "props": {"variant": "inline", "items": [{"label": "All meals & house wines"}, {"label": "Two daily game drives"}, {"label": "Airstrip transfers"}, {"label": "0% booking fees"}]}},
         {"id": "sabela-rooms-rooms", "type": "rooms_preview", "enabled": true, "props": {"display": "showcase", "heading": "Where you will stay", "max": 8}},
         {"id": "sabela-rooms-pricing", "type": "pricing", "enabled": true, "props": {"heading": "Rates", "items": [{"label": "Suite, full-board", "price": "R7 500", "note": "per person / night"}, {"label": "Take the whole lodge", "price": "On request", "note": ""}], "footnote": "Rates are indicative and include meals and daily activities. Your final price is confirmed at booking."}},
         {"id": "sabela-rooms-cta", "type": "cta", "enabled": true, "tone": "dark", "props": {"heading": "Your safari begins with a single message", "body": "Book direct for the best rate and first pick of the season.", "button_label": "Plan your safari", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "contact", "slug": "contact", "title": "Contact",
       "nav_label": "Contact", "nav_order": 3, "show_in_nav": true,
       "sections": [
         {"id": "sabela-contact-hero", "type": "hero", "enabled": true, "props": {"compact": true, "eyebrow": "Contact", "headline": "Let''s plan your safari", "subheadline": "Tell us who is travelling and when. A real person at the lodge replies within a day, often the same one who will meet you at the airstrip.", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "sabela-contact-form", "type": "contact_form", "enabled": true, "props": {"heading": "Send an enquiry", "body": "We usually reply within a few hours.", "variant": "split"}},
         {"id": "sabela-contact-location", "type": "location", "enabled": true, "tone": "dark", "props": {"heading": "Closer than you think", "show_map": true, "variant": "split"}},
         {"id": "sabela-contact-faq", "type": "faq", "enabled": true, "props": {"heading": "Good to know", "variant": "accordion", "items": [{"q": "How do we get there?", "a": "A 45-minute charter from Johannesburg, or scheduled flights to Hoedspruit and Skukuza. Our airstrip is a 15-minute transfer from camp."}, {"q": "Is it malaria-free?", "a": "Yes, the reserve sits in a malaria-free region, so it is an easy choice for families."}, {"q": "What is included?", "a": "Rates are full-board with twice-daily guided game drives. Replace this with your own inclusions."}]}}
       ]
     },
     {
       "kind": "blog", "slug": "blog", "title": "Journal",
       "nav_label": "Journal", "nav_order": 4, "show_in_nav": true,
       "sections": [
         {"id": "sabela-blog-intro", "type": "intro", "enabled": true, "props": {"eyebrow": "The journal", "heading": "Field notes from the reserve", "body": "Notes from the bush: sightings, the seasons, and life on the reserve, written by the people who live and work here.", "variant": "centered"}},
         {"id": "sabela-blog-list", "type": "blog_preview", "enabled": true, "props": {"heading": "Latest from the journal", "max": 6}}
       ]
     },
     {
       "kind": "checkout", "slug": "checkout", "title": "Book",
       "nav_label": null, "nav_order": 800, "show_in_nav": false,
       "sections": [
         {"id": "sabela-checkout-intro", "type": "intro", "enabled": true, "props": {"heading": "Complete your booking", "body": "You are almost there. Review your details below and confirm your stay. We cannot wait to welcome you to the bush.", "variant": "centered"}}
       ]
     },
     {
       "kind": "thank-you", "slug": "thank-you", "title": "Thank you",
       "nav_label": null, "nav_order": 810, "show_in_nav": false,
       "sections": [
         {"id": "sabela-thankyou-intro", "type": "intro", "enabled": true, "props": {"heading": "Thank you", "body": "Your booking is confirmed. We have sent an email with all the details. We look forward to welcoming you to Sabela, under wide skies and the call of the bush.", "variant": "centered"}}
       ]
     }
   ]'::jsonb,
   true, false, false, 3)
on conflict (slug) do update set
  name               = excluded.name,
  description        = excluded.description,
  preview_image_path = excluded.preview_image_path,
  base               = excluded.base,
  page_templates     = excluded.page_templates,
  is_active          = true,
  is_premium         = false,
  is_default         = false,
  sort_order         = 3,
  deleted_at         = null;
