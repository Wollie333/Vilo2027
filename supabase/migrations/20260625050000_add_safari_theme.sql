-- Add the Safari theme — an unfenced-wilderness lodge look (warm bone ground,
-- savanna-ochre accent, bushveld green, serif display headings). Modelled on the
-- NenGama Lodge design. Added alongside Aria as a SECOND selectable theme
-- (is_active = true, is_default = false). loadActiveThemes now offers every
-- active theme, so both appear in the Brand Studio gallery.
--
-- `base` is copied into host_websites.theme on apply (buildSiteVars → --site-*).
-- `page_templates` seed website_pages on apply; props are terse because
-- parseSectionsLoose fills every default on read. Idempotent (upsert on slug).
insert into public.site_themes
  (slug, name, description, preview_image_path, base, page_templates,
   is_active, is_premium, is_default, sort_order)
values
  ('safari', 'Safari',
   'Unfenced-wilderness lodge — warm bone and sand, savanna ochre, and serif headlines under wide skies.',
   'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNTAwIiB2aWV3Qm94PSIwIDAgODAwIDUwMCIgZmlsbD0ibm9uZSIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsICdUaW1lcyBOZXcgUm9tYW4nLCBzZXJpZiI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InNreSIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNFOEM2OEEiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIwLjU1IiBzdG9wLWNvbG9yPSIjQjI2QzJFIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzNDNEEzNSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI1MDAiIGZpbGw9IiNGNEVERTAiLz4KCiAgPCEtLSBoZWFkZXIgLS0+CiAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjgwMCIgaGVpZ2h0PSI1OCIgZmlsbD0iI0ZCRjZFQyIvPgogIDxyZWN0IHg9IjAiIHk9IjU4IiB3aWR0aD0iODAwIiBoZWlnaHQ9IjEiIGZpbGw9IiNEQkNGQjgiLz4KICA8cmVjdCB4PSI0MCIgeT0iMjEiIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgcng9IjMiIGZpbGw9IiNCMjZDMkUiLz4KICA8dGV4dCB4PSI2NCIgeT0iMzQiIGZvbnQtc2l6ZT0iMTciIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiMyMjFBMTEiPlNhZmFyaTwvdGV4dD4KICA8dGV4dCB4PSI0NTIiIHk9IjMzIiBmb250LXNpemU9IjExLjUiIGZpbGw9IiM2RTYwNDgiPkhvbWU8L3RleHQ+CiAgPHRleHQgeD0iNTA2IiB5PSIzMyIgZm9udC1zaXplPSIxMS41IiBmaWxsPSIjNkU2MDQ4Ij5TdWl0ZXM8L3RleHQ+CiAgPHRleHQgeD0iNTY2IiB5PSIzMyIgZm9udC1zaXplPSIxMS41IiBmaWxsPSIjNkU2MDQ4Ij5Kb3VybmFsPC90ZXh0PgogIDx0ZXh0IHg9IjYyOCIgeT0iMzMiIGZvbnQtc2l6ZT0iMTEuNSIgZmlsbD0iIzZFNjA0OCI+Q29udGFjdDwvdGV4dD4KICA8cmVjdCB4PSI2OTQiIHk9IjE2IiB3aWR0aD0iNzIiIGhlaWdodD0iMjciIHJ4PSIzIiBmaWxsPSIjQjI2QzJFIi8+CiAgPHRleHQgeD0iNzMwIiB5PSIzMy41IiBmb250LXNpemU9IjExIiBmaWxsPSIjRkZGRkZGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Cb29rIG5vdzwvdGV4dD4KCiAgPCEtLSBoZXJvIHRleHQgLS0+CiAgPHRleHQgeD0iNDAiIHk9IjE1MCIgZm9udC1zaXplPSIzNCIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzIyMUExMSI+V2hlcmUgdGhlIHdpbGQ8L3RleHQ+CiAgPHRleHQgeD0iNDAiIHk9IjE5MCIgZm9udC1zaXplPSIzNCIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzIyMUExMSI+c3RpbGwgcnVucy48L3RleHQ+CiAgPHJlY3QgeD0iNDAiIHk9IjIxNCIgd2lkdGg9IjMwMCIgaGVpZ2h0PSI5IiByeD0iNC41IiBmaWxsPSIjREJDRkI4Ii8+CiAgPHJlY3QgeD0iNDAiIHk9IjIzMyIgd2lkdGg9IjI0MCIgaGVpZ2h0PSI5IiByeD0iNC41IiBmaWxsPSIjREJDRkI4Ii8+CiAgPHJlY3QgeD0iNDAiIHk9IjI2NCIgd2lkdGg9IjE3MCIgaGVpZ2h0PSIzNiIgcng9IjMiIGZpbGw9IiNCMjZDMkUiLz4KICA8dGV4dCB4PSIxMjUiIHk9IjI4NyIgZm9udC1zaXplPSIxMi41IiBmaWxsPSIjRkZGRkZGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5DaGVjayBhdmFpbGFiaWxpdHk8L3RleHQ+CgogIDwhLS0gaGVybyBpbWFnZTogc2F2YW5uYSAtLT4KICA8cmVjdCB4PSI0MzAiIHk9Ijg4IiB3aWR0aD0iMzMwIiBoZWlnaHQ9IjIxNCIgcng9IjQiIGZpbGw9InVybCgjc2t5KSIvPgogIDxjaXJjbGUgY3g9IjY5MCIgY3k9IjE0MCIgcj0iMjYiIGZpbGw9IiNGNEVERTAiIG9wYWNpdHk9IjAuODUiLz4KICA8IS0tIGFjYWNpYSBzaWxob3VldHRlIC0tPgogIDxwYXRoIGQ9Ik00NzAgMzAyIFYyNTAgcTAgLTE2IDE0IC0yMiBxLTIwIDIgLTMwIC04IHExNCA0IDMwIC00IHEtOCAtMTQgMiAtMjYgcTQgMTQgMTggMTYgcTE0IC0xMCAzMCAtMiBxLTEyIDYgLTEwIDE4IHExNiAtNCAyNCA4IHEtMTggMCAtMjIgMTIgVjMwMiBaIiBmaWxsPSIjMjIxQTExIiBvcGFjaXR5PSIwLjQyIi8+CiAgPHBhdGggZD0iTTQzMCAyODAgUTU0MCAyMzIgNjIwIDI2OCBUNzYwIDI1NiBWMzAyIEg0MzAgWiIgZmlsbD0iIzNDNEEzNSIgb3BhY2l0eT0iMC41NSIvPgoKICA8IS0tIHJvb20gY2FyZHMgLS0+CiAgPGc+CiAgICA8cmVjdCB4PSI0MCIgeT0iMzQ0IiB3aWR0aD0iMjI2IiBoZWlnaHQ9IjEyOCIgcng9IjQiIGZpbGw9IiNGQkY2RUMiIHN0cm9rZT0iI0RCQ0ZCOCIvPgogICAgPHJlY3QgeD0iNTIiIHk9IjM1NiIgd2lkdGg9IjIwMiIgaGVpZ2h0PSI2NiIgcng9IjMiIGZpbGw9IiNEOEMzOUIiLz4KICAgIDxyZWN0IHg9IjUyIiB5PSI0MzQiIHdpZHRoPSIxMjAiIGhlaWdodD0iOSIgcng9IjQuNSIgZmlsbD0iIzIyMUExMSIvPgogICAgPHJlY3QgeD0iNTIiIHk9IjQ1MCIgd2lkdGg9Ijc4IiBoZWlnaHQ9IjciIHJ4PSIzLjUiIGZpbGw9IiM2RTYwNDgiLz4KICA8L2c+CiAgPGc+CiAgICA8cmVjdCB4PSIyODciIHk9IjM0NCIgd2lkdGg9IjIyNiIgaGVpZ2h0PSIxMjgiIHJ4PSI0IiBmaWxsPSIjRkJGNkVDIiBzdHJva2U9IiNEQkNGQjgiLz4KICAgIDxyZWN0IHg9IjI5OSIgeT0iMzU2IiB3aWR0aD0iMjAyIiBoZWlnaHQ9IjY2IiByeD0iMyIgZmlsbD0iI0MyQTA1QyIvPgogICAgPHJlY3QgeD0iMjk5IiB5PSI0MzQiIHdpZHRoPSIxMjAiIGhlaWdodD0iOSIgcng9IjQuNSIgZmlsbD0iIzIyMUExMSIvPgogICAgPHJlY3QgeD0iMjk5IiB5PSI0NTAiIHdpZHRoPSI3OCIgaGVpZ2h0PSI3IiByeD0iMy41IiBmaWxsPSIjNkU2MDQ4Ii8+CiAgPC9nPgogIDxnPgogICAgPHJlY3QgeD0iNTM0IiB5PSIzNDQiIHdpZHRoPSIyMjYiIGhlaWdodD0iMTI4IiByeD0iNCIgZmlsbD0iI0ZCRjZFQyIgc3Ryb2tlPSIjREJDRkI4Ii8+CiAgICA8cmVjdCB4PSI1NDYiIHk9IjM1NiIgd2lkdGg9IjIwMiIgaGVpZ2h0PSI2NiIgcng9IjMiIGZpbGw9IiM5QUExN0YiLz4KICAgIDxyZWN0IHg9IjU0NiIgeT0iNDM0IiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkiIHJ4PSI0LjUiIGZpbGw9IiMyMjFBMTEiLz4KICAgIDxyZWN0IHg9IjU0NiIgeT0iNDUwIiB3aWR0aD0iNzgiIGhlaWdodD0iNyIgcng9IjMuNSIgZmlsbD0iIzZFNjA0OCIvPgogIDwvZz4KPC9zdmc+Cg==',
   '{"label":"Safari","palette":{"bg":"#F4EDE0","surface":"#FBF6EC","ink":"#221A11","mute":"#6E6048","line":"#DBCFB8","accent":"#B26C2E","accentInk":"#FFFFFF"},"font":"elegant","radius":"sm"}'::jsonb,
   '[
     {
       "kind": "home", "slug": "home", "title": "Home",
       "nav_label": "Home", "nav_order": 0, "show_in_nav": true,
       "sections": [
         {"id": "safari-home-hero", "type": "hero", "enabled": true, "tone": "dark", "props": {"headline": "Where the wild still runs", "subheadline": "An unfenced lodge deep in the Waterberg with a handful of suites, wide skies, and the bush at your door.", "cta_label": "Check availability", "cta_href": "/rooms", "align": "center", "variant": "fullscreen", "overlay": "strong", "textTone": "light", "height": "tall"}},
         {"id": "safari-home-intro", "type": "intro", "enabled": true, "props": {"heading": "An unfenced wilderness", "body": "Some places you pass through. This one stays with you. Days here move to the rhythm of the reserve: early light, long drives, the slow hush of the afternoon, and a fire under more stars than you have ever seen.", "variant": "lead"}},
         {"id": "safari-home-exp", "type": "highlights", "enabled": true, "tone": "dark", "props": {"heading": "The reserve, unhurried", "variant": "grid", "items": [{"icon": "Sunrise", "title": "Game drives", "body": "Dawn and dusk on the reserve with an expert guide and tracker."}, {"icon": "Footprints", "title": "Guided walks", "body": "Read the tracks on foot, the bush at its smallest and wildest."}, {"icon": "Flame", "title": "Boma evenings", "body": "Dinner under the stars around an open fire, stories included."}]}},
         {"id": "safari-home-rooms", "type": "rooms_preview", "enabled": true, "props": {"heading": "Three suites, one horizon", "max": 6}},
         {"id": "safari-home-gallery", "type": "gallery", "enabled": true, "props": {"heading": "Moments from the reserve"}},
         {"id": "safari-home-reviews", "type": "reviews", "enabled": true, "props": {"heading": "Quiet that you can feel", "max": 6}},
         {"id": "safari-home-location", "type": "location", "enabled": true, "tone": "dark", "props": {"heading": "Deep in the Waterberg", "show_map": true, "variant": "split"}},
         {"id": "safari-home-cta", "type": "cta", "enabled": true, "tone": "dark", "props": {"heading": "Your dates, under wide skies", "body": "Book direct for the best rate and first pick of the season. We will take care of the rest.", "button_label": "Check availability", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "about", "slug": "about", "title": "About",
       "nav_label": "About", "nav_order": 1, "show_in_nav": true,
       "sections": [
         {"id": "safari-about-hero", "type": "hero", "enabled": true, "props": {"headline": "A house at the heart of the bush", "subheadline": "Twelve thousand hectares, a handful of suites, and nothing between you and the horizon.", "cta_label": "Explore the lodge", "cta_href": "/rooms", "align": "left", "variant": "split_right", "height": "medium"}},
         {"id": "safari-about-intro", "type": "intro", "enabled": true, "props": {"heading": "An unfenced wilderness", "body": "Tell guests who you are and why you host: the land, the welcome, and why people make the journey. A paragraph or two is plenty.", "variant": "lead"}},
         {"id": "safari-about-host", "type": "host_bio", "enabled": true, "props": {"heading": "Your guides", "body": "A few warm lines about the team who will share the bush with you, and what they love most about the reserve."}},
         {"id": "safari-about-exp", "type": "highlights", "enabled": true, "tone": "dark", "props": {"heading": "The reserve, unhurried", "variant": "grid", "items": [{"icon": "Sunrise", "title": "Game drives", "body": "Dawn and dusk on the reserve with an expert guide and tracker."}, {"icon": "Footprints", "title": "Guided walks", "body": "Read the tracks on foot, the bush at its smallest and wildest."}, {"icon": "Flame", "title": "Boma evenings", "body": "Dinner under the stars around an open fire."}]}}
       ]
     },
     {
       "kind": "rooms", "slug": "rooms", "title": "Suites",
       "nav_label": "Suites", "nav_order": 2, "show_in_nav": true,
       "sections": [
         {"id": "safari-rooms-intro", "type": "intro", "enabled": true, "props": {"heading": "Three suites, one horizon", "body": "Each suite opens to the wild, with quiet luxury, deep baths, and a private deck for the long light of the afternoon.", "variant": "centered"}},
         {"id": "safari-rooms-rooms", "type": "rooms_preview", "enabled": true, "props": {"heading": "Where you will rest", "max": 6}},
         {"id": "safari-rooms-amenities", "type": "amenities", "enabled": true, "props": {"heading": "At the lodge", "items": [{"icon": "🔥", "label": "Boma and fire pit"}, {"icon": "🏊", "label": "Rock pool"}, {"icon": "🍷", "label": "Sundowners"}, {"icon": "🦓", "label": "Daily game drives"}, {"icon": "🍽️", "label": "All meals"}, {"icon": "📶", "label": "Wi-Fi at the main house"}]}},
         {"id": "safari-rooms-pricing", "type": "pricing", "enabled": true, "props": {"heading": "Rates", "items": [{"label": "Suite, full-board", "price": "R6 500", "note": "per person / night"}, {"label": "Sole-use (whole lodge)", "price": "On request", "note": ""}], "footnote": "Rates are indicative and include meals and daily activities. Your final price is confirmed at booking."}},
         {"id": "safari-rooms-cta", "type": "cta", "enabled": true, "tone": "dark", "props": {"heading": "Your dates, under wide skies", "body": "Book direct for the best rate and first pick of the season.", "button_label": "Check availability", "button_href": "/rooms", "variant": "banner"}}
       ]
     },
     {
       "kind": "contact", "slug": "contact", "title": "Contact",
       "nav_label": "Contact", "nav_order": 3, "show_in_nav": true,
       "sections": [
         {"id": "safari-contact-intro", "type": "intro", "enabled": true, "props": {"heading": "Plan your stay", "body": "Tell us your dates and what you are hoping for. A guide will be in touch to shape your time in the bush.", "variant": "centered"}},
         {"id": "safari-contact-form", "type": "contact_form", "enabled": true, "props": {"heading": "Send an enquiry", "body": "We usually reply within a few hours.", "variant": "split"}},
         {"id": "safari-contact-location", "type": "location", "enabled": true, "tone": "dark", "props": {"heading": "Deep in the Waterberg", "show_map": true, "variant": "split"}},
         {"id": "safari-contact-faq", "type": "faq", "enabled": true, "props": {"heading": "Good to know", "variant": "accordion", "items": [{"q": "How do we get there?", "a": "We are a scenic drive from the nearest town, with a fly-in option to a private strip. Full directions follow your booking."}, {"q": "Is it malaria-free?", "a": "Yes, the reserve sits in a malaria-free region, so it is an easy choice for families."}, {"q": "What is included?", "a": "Rates are full-board with daily guided activities. Replace this with your own inclusions."}]}}
       ]
     },
     {
       "kind": "blog", "slug": "blog", "title": "Journal",
       "nav_label": "Journal", "nav_order": 4, "show_in_nav": true,
       "sections": [
         {"id": "safari-blog-intro", "type": "intro", "enabled": true, "props": {"heading": "From the field journal", "body": "Notes from the bush: sightings, the seasons, and life on the reserve.", "variant": "centered"}},
         {"id": "safari-blog-list", "type": "blog_preview", "enabled": true, "props": {"heading": "Latest from the journal", "max": 6}}
       ]
     },
     {
       "kind": "checkout", "slug": "checkout", "title": "Book",
       "nav_label": null, "nav_order": 800, "show_in_nav": false,
       "sections": [
         {"id": "safari-checkout-intro", "type": "intro", "enabled": true, "props": {"heading": "Complete your booking", "body": "You are almost there. Review your details below and confirm your stay. We cannot wait to welcome you to the bush.", "variant": "centered"}}
       ]
     },
     {
       "kind": "thank-you", "slug": "thank-you", "title": "Thank you",
       "nav_label": null, "nav_order": 810, "show_in_nav": false,
       "sections": [
         {"id": "safari-thankyou-intro", "type": "intro", "enabled": true, "props": {"heading": "Thank you", "body": "Your booking is confirmed. We have sent an email with all the details. We look forward to welcoming you under the wide skies of the Waterberg.", "variant": "centered"}}
       ]
     }
   ]'::jsonb,
   true, false, false, 2)
on conflict (slug) do update set
  name               = excluded.name,
  description        = excluded.description,
  preview_image_path = excluded.preview_image_path,
  base               = excluded.base,
  page_templates     = excluded.page_templates,
  is_active          = true,
  is_premium         = false,
  is_default         = false,
  sort_order         = 2,
  deleted_at         = null;
