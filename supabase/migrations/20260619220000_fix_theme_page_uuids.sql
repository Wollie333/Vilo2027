-- Fix: Theme page_templates section IDs must be valid UUIDs
-- The sections schema validates id: z.string().uuid()

-- ── Update Warm theme with valid UUID section IDs ──
UPDATE public.site_themes
SET page_templates = '[
  {
    "kind": "home",
    "slug": "home",
    "title": "Home",
    "nav_label": "Home",
    "nav_order": 0,
    "show_in_nav": true,
    "sections": [
      {"id": "a0000001-0001-4000-8000-000000000001", "type": "hero", "enabled": true, "props": {"headline": "Welcome", "subheadline": "Book your stay with us directly.", "align": "center"}},
      {"id": "a0000001-0001-4000-8000-000000000002", "type": "intro", "enabled": true, "props": {"heading": "Welcome", "body": "Tell guests what makes your place special — the setting, the welcome, the little touches they''ll remember."}},
      {"id": "a0000001-0001-4000-8000-000000000003", "type": "rooms_preview", "enabled": true, "props": {"heading": "Rooms & rates", "max": 6}},
      {"id": "a0000001-0001-4000-8000-000000000004", "type": "reviews", "enabled": true, "props": {"heading": "What guests say", "max": 6}},
      {"id": "a0000001-0001-4000-8000-000000000005", "type": "location", "enabled": true, "props": {"heading": "Where you''ll be", "show_map": true}},
      {"id": "a0000001-0001-4000-8000-000000000006", "type": "cta", "enabled": true, "props": {"heading": "Ready to book?", "body": "Reserve your dates directly — no booking fees.", "button_label": "Check availability", "button_href": "/rooms"}}
    ]
  },
  {
    "kind": "about",
    "slug": "about",
    "title": "About",
    "nav_label": "About",
    "nav_order": 1,
    "show_in_nav": true,
    "sections": [
      {"id": "a0000001-0002-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Our story", "body": "Share your story — who you are, why you host, and what guests can expect."}},
      {"id": "a0000001-0002-4000-8000-000000000002", "type": "host_bio", "enabled": true, "props": {"heading": "Your host", "body": "A few warm lines about you and your team."}},
      {"id": "a0000001-0002-4000-8000-000000000003", "type": "highlights", "enabled": true, "props": {"heading": "What we stand for", "items": [{"icon": "✦", "title": "Personal touch", "body": "Every stay feels like visiting friends."}, {"icon": "✦", "title": "Local roots", "body": "We know this area inside out."}, {"icon": "✦", "title": "Direct booking", "body": "No middlemen, no hidden fees."}]}}
    ]
  },
  {
    "kind": "contact",
    "slug": "contact",
    "title": "Contact",
    "nav_label": "Contact",
    "nav_order": 2,
    "show_in_nav": true,
    "sections": [
      {"id": "a0000001-0003-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Get in touch", "body": "Have a question about your stay? We''d love to hear from you."}},
      {"id": "a0000001-0003-4000-8000-000000000002", "type": "contact_form", "enabled": true, "props": {"heading": "Send us a message", "body": "Fill in the form below and we''ll get back to you as soon as possible.", "submit_label": "Send message", "show_phone": true}},
      {"id": "a0000001-0003-4000-8000-000000000003", "type": "location", "enabled": true, "props": {"heading": "Find us", "show_map": true}}
    ]
  },
  {
    "kind": "rooms",
    "slug": "rooms",
    "title": "Rooms",
    "nav_label": "Rooms",
    "nav_order": 3,
    "show_in_nav": true,
    "sections": [
      {"id": "a0000001-0004-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Our rooms", "body": "Find the perfect space for your stay. Each room is designed with comfort and character in mind."}},
      {"id": "a0000001-0004-4000-8000-000000000002", "type": "rooms_preview", "enabled": true, "props": {"heading": "", "max": 20, "layout": "list"}},
      {"id": "a0000001-0004-4000-8000-000000000003", "type": "cta", "enabled": true, "props": {"heading": "Need help choosing?", "body": "Get in touch and we''ll help you find the perfect room for your needs.", "button_label": "Contact us", "button_href": "/contact"}}
    ]
  },
  {
    "kind": "blog",
    "slug": "blog",
    "title": "Blog",
    "nav_label": "Blog",
    "nav_order": 4,
    "show_in_nav": true,
    "sections": [
      {"id": "a0000001-0005-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "From the journal", "body": "Stories, tips, and updates from our corner of the world."}},
      {"id": "a0000001-0005-4000-8000-000000000002", "type": "blog_preview", "enabled": true, "props": {"heading": "", "max": 12}}
    ]
  },
  {
    "kind": "checkout",
    "slug": "checkout",
    "title": "Book your stay",
    "nav_label": "Book",
    "nav_order": 99,
    "show_in_nav": false,
    "sections": [
      {"id": "a0000001-0006-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Complete your booking", "body": "You''re almost there. Review your details and confirm your reservation."}}
    ]
  },
  {
    "kind": "thank-you",
    "slug": "thank-you",
    "title": "Booking confirmed",
    "nav_label": "Thank you",
    "nav_order": 99,
    "show_in_nav": false,
    "sections": [
      {"id": "a0000001-0007-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Thank you!", "body": "Your booking is confirmed. We''ve sent a confirmation email with all the details. We can''t wait to welcome you."}},
      {"id": "a0000001-0007-4000-8000-000000000002", "type": "cta", "enabled": true, "props": {"heading": "Questions before your stay?", "body": "Feel free to reach out — we''re here to help.", "button_label": "Contact us", "button_href": "/contact"}}
    ]
  }
]'::jsonb
WHERE slug = 'warm';

-- ── Update Coastal theme with valid UUID section IDs ──
UPDATE public.site_themes
SET page_templates = '[
  {
    "kind": "home",
    "slug": "home",
    "title": "Home",
    "nav_label": "Home",
    "nav_order": 0,
    "show_in_nav": true,
    "sections": [
      {"id": "a0000002-0001-4000-8000-000000000001", "type": "hero", "enabled": true, "props": {"headline": "Welcome", "subheadline": "Book your stay with us directly.", "align": "center"}},
      {"id": "a0000002-0001-4000-8000-000000000002", "type": "intro", "enabled": true, "props": {"heading": "Welcome", "body": "Tell guests what makes your place special — the setting, the welcome, the little touches they''ll remember."}},
      {"id": "a0000002-0001-4000-8000-000000000003", "type": "rooms_preview", "enabled": true, "props": {"heading": "Rooms & rates", "max": 6}},
      {"id": "a0000002-0001-4000-8000-000000000004", "type": "reviews", "enabled": true, "props": {"heading": "What guests say", "max": 6}},
      {"id": "a0000002-0001-4000-8000-000000000005", "type": "location", "enabled": true, "props": {"heading": "Where you''ll be", "show_map": true}},
      {"id": "a0000002-0001-4000-8000-000000000006", "type": "cta", "enabled": true, "props": {"heading": "Ready to book?", "body": "Reserve your dates directly — no booking fees.", "button_label": "Check availability", "button_href": "/rooms"}}
    ]
  },
  {
    "kind": "about",
    "slug": "about",
    "title": "About",
    "nav_label": "About",
    "nav_order": 1,
    "show_in_nav": true,
    "sections": [
      {"id": "a0000002-0002-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Our story", "body": "Share your story — who you are, why you host, and what guests can expect."}},
      {"id": "a0000002-0002-4000-8000-000000000002", "type": "host_bio", "enabled": true, "props": {"heading": "Your host", "body": "A few warm lines about you and your team."}},
      {"id": "a0000002-0002-4000-8000-000000000003", "type": "highlights", "enabled": true, "props": {"heading": "What we stand for", "items": [{"icon": "✦", "title": "Personal touch", "body": "Every stay feels like visiting friends."}, {"icon": "✦", "title": "Local roots", "body": "We know this area inside out."}, {"icon": "✦", "title": "Direct booking", "body": "No middlemen, no hidden fees."}]}}
    ]
  },
  {
    "kind": "contact",
    "slug": "contact",
    "title": "Contact",
    "nav_label": "Contact",
    "nav_order": 2,
    "show_in_nav": true,
    "sections": [
      {"id": "a0000002-0003-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Get in touch", "body": "Have a question about your stay? We''d love to hear from you."}},
      {"id": "a0000002-0003-4000-8000-000000000002", "type": "contact_form", "enabled": true, "props": {"heading": "Send us a message", "body": "Fill in the form below and we''ll get back to you as soon as possible.", "submit_label": "Send message", "show_phone": true}},
      {"id": "a0000002-0003-4000-8000-000000000003", "type": "location", "enabled": true, "props": {"heading": "Find us", "show_map": true}}
    ]
  },
  {
    "kind": "rooms",
    "slug": "rooms",
    "title": "Rooms",
    "nav_label": "Rooms",
    "nav_order": 3,
    "show_in_nav": true,
    "sections": [
      {"id": "a0000002-0004-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Our rooms", "body": "Find the perfect space for your stay. Each room is designed with comfort and character in mind."}},
      {"id": "a0000002-0004-4000-8000-000000000002", "type": "rooms_preview", "enabled": true, "props": {"heading": "", "max": 20, "layout": "list"}},
      {"id": "a0000002-0004-4000-8000-000000000003", "type": "cta", "enabled": true, "props": {"heading": "Need help choosing?", "body": "Get in touch and we''ll help you find the perfect room for your needs.", "button_label": "Contact us", "button_href": "/contact"}}
    ]
  },
  {
    "kind": "blog",
    "slug": "blog",
    "title": "Blog",
    "nav_label": "Blog",
    "nav_order": 4,
    "show_in_nav": true,
    "sections": [
      {"id": "a0000002-0005-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "From the journal", "body": "Stories, tips, and updates from our corner of the world."}},
      {"id": "a0000002-0005-4000-8000-000000000002", "type": "blog_preview", "enabled": true, "props": {"heading": "", "max": 12}}
    ]
  },
  {
    "kind": "checkout",
    "slug": "checkout",
    "title": "Book your stay",
    "nav_label": "Book",
    "nav_order": 99,
    "show_in_nav": false,
    "sections": [
      {"id": "a0000002-0006-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Complete your booking", "body": "You''re almost there. Review your details and confirm your reservation."}}
    ]
  },
  {
    "kind": "thank-you",
    "slug": "thank-you",
    "title": "Booking confirmed",
    "nav_label": "Thank you",
    "nav_order": 99,
    "show_in_nav": false,
    "sections": [
      {"id": "a0000002-0007-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Thank you!", "body": "Your booking is confirmed. We''ve sent a confirmation email with all the details. We can''t wait to welcome you."}},
      {"id": "a0000002-0007-4000-8000-000000000002", "type": "cta", "enabled": true, "props": {"heading": "Questions before your stay?", "body": "Feel free to reach out — we''re here to help.", "button_label": "Contact us", "button_href": "/contact"}}
    ]
  }
]'::jsonb
WHERE slug = 'coastal';
