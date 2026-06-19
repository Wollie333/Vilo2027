-- Phase: Theme Simplification
-- Reduce site_themes from 6 to 2 (warm + coastal), set warm as default,
-- and add page_templates to both themes.
--
-- Why: The 6 original presets were placeholders. Vilo now ships two real
-- production themes, each with curated starter pages. Warm is the default.

-- ── Step 1: Soft-delete the 4 themes we no longer offer ──
UPDATE public.site_themes
SET is_active = false, deleted_at = now()
WHERE slug IN ('classic', 'modern', 'minimal', 'nightfall')
  AND deleted_at IS NULL;

-- ── Step 2: Clear default from classic (was set in 20260619005000) ──
UPDATE public.site_themes
SET is_default = false
WHERE slug = 'classic';

-- ── Step 3: Set warm as the default + add page_templates ──
UPDATE public.site_themes
SET is_default = true,
    sort_order = 1,
    page_templates = '[
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
          {"id": "warm-home-cta", "type": "cta", "enabled": true, "props": {"heading": "Ready to book?", "body": "Reserve your dates directly — no booking fees.", "button_label": "Check availability", "button_href": "#rooms"}}
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
          {"id": "warm-about-host", "type": "host_bio", "enabled": true, "props": {"heading": "Your host", "body": "A few warm lines about you and your team."}}
        ]
      }
    ]'::jsonb
WHERE slug = 'warm';

-- ── Step 4: Update coastal with page_templates (same structure, different theme) ──
UPDATE public.site_themes
SET is_default = false,
    sort_order = 2,
    page_templates = '[
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
          {"id": "coastal-home-cta", "type": "cta", "enabled": true, "props": {"heading": "Ready to book?", "body": "Reserve your dates directly — no booking fees.", "button_label": "Check availability", "button_href": "#rooms"}}
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
          {"id": "coastal-about-host", "type": "host_bio", "enabled": true, "props": {"heading": "Your host", "body": "A few warm lines about you and your team."}}
        ]
      }
    ]'::jsonb
WHERE slug = 'coastal';

-- ── Verify ──
-- SELECT slug, name, is_default, is_active FROM public.site_themes WHERE deleted_at IS NULL;
-- Expected: warm (default, active), coastal (not default, active)
