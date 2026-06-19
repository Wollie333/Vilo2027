-- Phase: Theme Required Pages
-- Expand theme page_templates to include all required pages:
-- home, about, contact, rooms, blog, checkout, thank-you
--
-- These are the minimum pages every theme must provide. When a host applies a
-- theme, they get all these pages as starters. Each page has sensible default
-- sections that the host can customize.

-- ── Update Warm theme with all required pages ──
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
      {"id": "warm-home-hero", "type": "hero", "enabled": true, "props": {"headline": "Welcome", "subheadline": "Book your stay with us directly.", "align": "center"}},
      {"id": "warm-home-intro", "type": "intro", "enabled": true, "props": {"heading": "Welcome", "body": "Tell guests what makes your place special — the setting, the welcome, the little touches they''ll remember."}},
      {"id": "warm-home-rooms", "type": "rooms_preview", "enabled": true, "props": {"heading": "Rooms & rates", "max": 6}},
      {"id": "warm-home-reviews", "type": "reviews", "enabled": true, "props": {"heading": "What guests say", "max": 6}},
      {"id": "warm-home-location", "type": "location", "enabled": true, "props": {"heading": "Where you''ll be", "show_map": true}},
      {"id": "warm-home-cta", "type": "cta", "enabled": true, "props": {"heading": "Ready to book?", "body": "Reserve your dates directly — no booking fees.", "button_label": "Check availability", "button_href": "/rooms"}}
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
      {"id": "warm-about-intro", "type": "intro", "enabled": true, "props": {"heading": "Our story", "body": "Share your story — who you are, why you host, and what guests can expect."}},
      {"id": "warm-about-host", "type": "host_bio", "enabled": true, "props": {"heading": "Your host", "body": "A few warm lines about you and your team."}},
      {"id": "warm-about-values", "type": "highlights", "enabled": true, "props": {"heading": "What we stand for", "items": [{"icon": "✦", "title": "Personal touch", "body": "Every stay feels like visiting friends."}, {"icon": "✦", "title": "Local roots", "body": "We know this area inside out."}, {"icon": "✦", "title": "Direct booking", "body": "No middlemen, no hidden fees."}]}}
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
      {"id": "warm-contact-intro", "type": "intro", "enabled": true, "props": {"heading": "Get in touch", "body": "Have a question about your stay? We''d love to hear from you."}},
      {"id": "warm-contact-form", "type": "contact_form", "enabled": true, "props": {"heading": "Send us a message", "body": "Fill in the form below and we''ll get back to you as soon as possible.", "submit_label": "Send message", "show_phone": true}},
      {"id": "warm-contact-location", "type": "location", "enabled": true, "props": {"heading": "Find us", "show_map": true}}
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
      {"id": "warm-rooms-intro", "type": "intro", "enabled": true, "props": {"heading": "Our rooms", "body": "Find the perfect space for your stay. Each room is designed with comfort and character in mind."}},
      {"id": "warm-rooms-list", "type": "rooms_preview", "enabled": true, "props": {"heading": "", "max": 20, "layout": "list"}},
      {"id": "warm-rooms-cta", "type": "cta", "enabled": true, "props": {"heading": "Need help choosing?", "body": "Get in touch and we''ll help you find the perfect room for your needs.", "button_label": "Contact us", "button_href": "/contact"}}
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
      {"id": "warm-blog-intro", "type": "intro", "enabled": true, "props": {"heading": "From the journal", "body": "Stories, tips, and updates from our corner of the world."}},
      {"id": "warm-blog-list", "type": "blog_preview", "enabled": true, "props": {"heading": "", "max": 12}}
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
      {"id": "warm-checkout-intro", "type": "intro", "enabled": true, "props": {"heading": "Complete your booking", "body": "You''re almost there. Review your details and confirm your reservation."}}
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
      {"id": "warm-thanks-intro", "type": "intro", "enabled": true, "props": {"heading": "Thank you!", "body": "Your booking is confirmed. We''ve sent a confirmation email with all the details. We can''t wait to welcome you."}},
      {"id": "warm-thanks-cta", "type": "cta", "enabled": true, "props": {"heading": "Questions before your stay?", "body": "Feel free to reach out — we''re here to help.", "button_label": "Contact us", "button_href": "/contact"}}
    ]
  }
]'::jsonb
WHERE slug = 'warm';

-- ── Update Coastal theme with all required pages ──
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
      {"id": "coastal-home-hero", "type": "hero", "enabled": true, "props": {"headline": "Welcome", "subheadline": "Book your stay with us directly.", "align": "center"}},
      {"id": "coastal-home-intro", "type": "intro", "enabled": true, "props": {"heading": "Welcome", "body": "Tell guests what makes your place special — the setting, the welcome, the little touches they''ll remember."}},
      {"id": "coastal-home-rooms", "type": "rooms_preview", "enabled": true, "props": {"heading": "Rooms & rates", "max": 6}},
      {"id": "coastal-home-reviews", "type": "reviews", "enabled": true, "props": {"heading": "What guests say", "max": 6}},
      {"id": "coastal-home-location", "type": "location", "enabled": true, "props": {"heading": "Where you''ll be", "show_map": true}},
      {"id": "coastal-home-cta", "type": "cta", "enabled": true, "props": {"heading": "Ready to book?", "body": "Reserve your dates directly — no booking fees.", "button_label": "Check availability", "button_href": "/rooms"}}
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
      {"id": "coastal-about-intro", "type": "intro", "enabled": true, "props": {"heading": "Our story", "body": "Share your story — who you are, why you host, and what guests can expect."}},
      {"id": "coastal-about-host", "type": "host_bio", "enabled": true, "props": {"heading": "Your host", "body": "A few warm lines about you and your team."}},
      {"id": "coastal-about-values", "type": "highlights", "enabled": true, "props": {"heading": "What we stand for", "items": [{"icon": "✦", "title": "Personal touch", "body": "Every stay feels like visiting friends."}, {"icon": "✦", "title": "Local roots", "body": "We know this area inside out."}, {"icon": "✦", "title": "Direct booking", "body": "No middlemen, no hidden fees."}]}}
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
      {"id": "coastal-contact-intro", "type": "intro", "enabled": true, "props": {"heading": "Get in touch", "body": "Have a question about your stay? We''d love to hear from you."}},
      {"id": "coastal-contact-form", "type": "contact_form", "enabled": true, "props": {"heading": "Send us a message", "body": "Fill in the form below and we''ll get back to you as soon as possible.", "submit_label": "Send message", "show_phone": true}},
      {"id": "coastal-contact-location", "type": "location", "enabled": true, "props": {"heading": "Find us", "show_map": true}}
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
      {"id": "coastal-rooms-intro", "type": "intro", "enabled": true, "props": {"heading": "Our rooms", "body": "Find the perfect space for your stay. Each room is designed with comfort and character in mind."}},
      {"id": "coastal-rooms-list", "type": "rooms_preview", "enabled": true, "props": {"heading": "", "max": 20, "layout": "list"}},
      {"id": "coastal-rooms-cta", "type": "cta", "enabled": true, "props": {"heading": "Need help choosing?", "body": "Get in touch and we''ll help you find the perfect room for your needs.", "button_label": "Contact us", "button_href": "/contact"}}
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
      {"id": "coastal-blog-intro", "type": "intro", "enabled": true, "props": {"heading": "From the journal", "body": "Stories, tips, and updates from our corner of the world."}},
      {"id": "coastal-blog-list", "type": "blog_preview", "enabled": true, "props": {"heading": "", "max": 12}}
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
      {"id": "coastal-checkout-intro", "type": "intro", "enabled": true, "props": {"heading": "Complete your booking", "body": "You''re almost there. Review your details and confirm your reservation."}}
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
      {"id": "coastal-thanks-intro", "type": "intro", "enabled": true, "props": {"heading": "Thank you!", "body": "Your booking is confirmed. We''ve sent a confirmation email with all the details. We can''t wait to welcome you."}},
      {"id": "coastal-thanks-cta", "type": "cta", "enabled": true, "props": {"heading": "Questions before your stay?", "body": "Feel free to reach out — we''re here to help.", "button_label": "Contact us", "button_href": "/contact"}}
    ]
  }
]'::jsonb
WHERE slug = 'coastal';

-- ── Verify ──
-- SELECT slug, jsonb_array_length(page_templates) as page_count
-- FROM public.site_themes
-- WHERE deleted_at IS NULL AND is_active = true;
-- Expected: warm (7), coastal (7)
