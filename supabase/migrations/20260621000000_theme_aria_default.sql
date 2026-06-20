-- Aria — the new flagship default theme (modern editorial-luxe).
--
-- A beautiful, modern, immediately-working site: warm paper canvas, near-black
-- ink, a calm deep-eucalyptus accent, elegant serif display headings over a
-- clean body, soft large corners. The `base` is copied into host_websites.theme
-- on apply (pure buildSiteVars reads it at render); `page_templates` seed a full
-- 7-page site whose sections AUTO-POPULATE from the host's rooms / reviews /
-- gallery / location / blog, so a new or re-themed site is presentable with zero
-- editing. Includes the curated `trust` section (Phase 6A) on the home page.
--
-- Section props are intentionally partial — the shared sectionSchema fills every
-- default (variant/tone/etc.) on read (parseSectionsLoose), so these stay terse.
-- Idempotent: upserts on slug and (re)asserts Aria as the sole default theme.

insert into public.site_themes
  (slug, name, description, preview_image_path, base, page_templates,
   is_active, is_premium, is_default, sort_order)
values
  ('aria', 'Aria',
   'Modern editorial elegance — warm light, calm green, and beautiful serif headlines.',
   'https://picsum.photos/seed/vilo-theme-aria/800/500',
   '{"label":"Aria","palette":{"bg":"#F6F4EF","surface":"#FFFFFF","ink":"#181715","mute":"#6B655C","line":"#E6E1D8","accent":"#2F5D4F","accentInk":"#FFFFFF"},"font":"elegant","radius":"lg"}'::jsonb,
   '[
     {
       "kind": "home",
       "slug": "home",
       "title": "Home",
       "nav_label": "Home",
       "nav_order": 0,
       "show_in_nav": true,
       "sections": [
         {"id": "c0000003-0001-4000-8000-000000000001", "type": "hero", "enabled": true, "props": {"headline": "Stay somewhere worth remembering.", "subheadline": "A handful of beautiful rooms, hosted with care. Book directly for our best rate and a warmer welcome.", "image_path": "https://picsum.photos/seed/vilo-aria-hero/1920/1280", "cta_label": "Check availability", "cta_href": "/rooms", "align": "left", "variant": "split"}},
         {"id": "c0000003-0001-4000-8000-000000000002", "type": "intro", "enabled": true, "props": {"heading": "Welcome", "body": "Some places you just pass through. This is not one of them. A calm, considered space designed for slow mornings and unhurried evenings — somewhere you settle in rather than simply check in.\n\nEvery detail is here for a reason: the light, the linens, the welcome. Book direct and you deal with us, not a middleman.", "variant": "lead"}},
         {"id": "c0000003-0001-4000-8000-000000000003", "type": "amenities", "enabled": true, "props": {"heading": "Everything you need", "items": [{"icon": "📶", "label": "Fast Wi-Fi"}, {"icon": "🅿️", "label": "Free parking"}, {"icon": "☕", "label": "Breakfast included"}, {"icon": "❄️", "label": "Air-conditioning"}, {"icon": "🏊", "label": "Swimming pool"}, {"icon": "🔑", "label": "Self check-in"}]}},
         {"id": "c0000003-0001-4000-8000-000000000004", "type": "gallery", "enabled": true, "props": {"heading": "A look around", "max": 8}},
         {"id": "c0000003-0001-4000-8000-000000000005", "type": "rooms_preview", "enabled": true, "props": {"heading": "Rooms & rates", "max": 6}},
         {"id": "c0000003-0001-4000-8000-000000000006", "type": "trust", "enabled": true, "props": {"heading": "Book with confidence", "body": "Direct rates, secure payment, and a real person at the other end.", "show_review_score": true, "variant": "badges", "items": [{"icon": "🔒", "label": "Secure payments"}, {"icon": "✅", "label": "Verified host"}, {"icon": "🏷️", "label": "Best-rate guarantee"}]}},
         {"id": "c0000003-0001-4000-8000-000000000007", "type": "reviews", "enabled": true, "props": {"heading": "What guests say", "max": 6}},
         {"id": "c0000003-0001-4000-8000-000000000008", "type": "location", "enabled": true, "props": {"heading": "Where you will be", "show_map": true}},
         {"id": "c0000003-0001-4000-8000-000000000009", "type": "cta", "enabled": true, "props": {"heading": "Ready to book?", "body": "Reserve your dates directly — no booking fees, just our best rate.", "button_label": "Check availability", "button_href": "/rooms"}}
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
         {"id": "c0000003-0002-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Our story", "body": "Tell guests who you are and why you host. The setting, the building, the moment that made you fall for this place — the things that make a stay here feel personal rather than transactional.\n\nA paragraph or two is plenty. Replace this with your own words whenever you are ready.", "variant": "centered"}},
         {"id": "c0000003-0002-4000-8000-000000000002", "type": "host_bio", "enabled": true, "props": {"heading": "Your host", "name": "", "body": "A few warm lines about you and your team — what you love about hosting, and the little touches guests remember.", "photo_path": "https://picsum.photos/seed/vilo-aria-host/600/600", "variant": "side"}},
         {"id": "c0000003-0002-4000-8000-000000000003", "type": "highlights", "enabled": true, "props": {"heading": "Why book direct", "variant": "grid", "items": [{"icon": "⭐", "title": "Our best rate", "body": "No booking-site markup — the best price is always here."}, {"icon": "💬", "title": "Personal service", "body": "Message us directly. We answer, and we know the area."}, {"icon": "🔑", "title": "Easy check-in", "body": "Flexible, self-service arrival on your own schedule."}]}}
       ]
     },
     {
       "kind": "rooms",
       "slug": "rooms",
       "title": "Rooms",
       "nav_label": "Rooms",
       "nav_order": 2,
       "show_in_nav": true,
       "sections": [
         {"id": "c0000003-0003-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Rooms & rates", "body": "Each room has its own character. All come with quality linens, fast Wi-Fi, and the little comforts that make a stay feel effortless.", "variant": "centered"}},
         {"id": "c0000003-0003-4000-8000-000000000002", "type": "rooms_preview", "enabled": true, "props": {"heading": "", "max": 20, "layout": "list"}},
         {"id": "c0000003-0003-4000-8000-000000000003", "type": "cta", "enabled": true, "props": {"heading": "Need a hand choosing?", "body": "Not sure which room suits you best? Get in touch and we will help you find the perfect fit.", "button_label": "Contact us", "button_href": "/contact"}}
       ]
     },
     {
       "kind": "contact",
       "slug": "contact",
       "title": "Contact",
       "nav_label": "Contact",
       "nav_order": 3,
       "show_in_nav": true,
       "sections": [
         {"id": "c0000003-0004-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Get in touch", "body": "Have a question about your stay or need help planning your visit? Send us a message and we will get back to you — usually within a few hours.", "variant": "centered"}},
         {"id": "c0000003-0004-4000-8000-000000000002", "type": "contact_form", "enabled": true, "props": {"heading": "Send us a message", "body": "Fill in the form below and we will be in touch shortly.", "submit_label": "Send message", "success_message": "Thanks for reaching out! We will reply within 24 hours.", "show_phone": true}},
         {"id": "c0000003-0004-4000-8000-000000000003", "type": "location", "enabled": true, "props": {"heading": "Find us", "show_map": true}}
       ]
     },
     {
       "kind": "blog",
       "slug": "blog",
       "title": "Blog",
       "nav_label": "Journal",
       "nav_order": 4,
       "show_in_nav": true,
       "sections": [
         {"id": "c0000003-0005-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Journal", "body": "Stories, local tips, and the occasional recipe from our corner of the world. Whether you are planning a visit or just dreaming of one, settle in.", "variant": "centered"}},
         {"id": "c0000003-0005-4000-8000-000000000002", "type": "blog_preview", "enabled": true, "props": {"heading": "", "max": 12}}
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
         {"id": "c0000003-0006-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Complete your booking", "body": "You are almost there. Review your details below and confirm your reservation — we cannot wait to welcome you.", "variant": "centered"}}
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
         {"id": "c0000003-0007-4000-8000-000000000001", "type": "intro", "enabled": true, "props": {"heading": "Thank you!", "body": "Your booking is confirmed. We have sent a confirmation email with all the details — check your inbox (and your spam folder, just in case).\n\nWe are looking forward to welcoming you. In the meantime, reach out any time with questions about your stay.", "variant": "centered"}},
         {"id": "c0000003-0007-4000-8000-000000000002", "type": "cta", "enabled": true, "props": {"heading": "Questions before your stay?", "body": "We are here to help with anything you need.", "button_label": "Contact us", "button_href": "/contact"}}
       ]
     }
   ]'::jsonb,
   true, false, true, 0)
on conflict (slug) do update set
  name               = excluded.name,
  description        = excluded.description,
  preview_image_path = excluded.preview_image_path,
  base               = excluded.base,
  page_templates     = excluded.page_templates,
  is_active          = true,
  is_premium         = false,
  is_default         = true,
  sort_order         = 0,
  deleted_at         = null,
  updated_at         = now();

-- Aria is now THE default — demote every other theme.
update public.site_themes
set is_default = false
where slug <> 'aria' and is_default = true;
