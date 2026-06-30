-- Keep ONLY the "Safari" theme; hard-remove every other site_themes row.
--
-- Founder decision (2026-06-30): Safari is now the sole theme offered
-- platform-wide. The other themes were stock/non-functional; only Safari is a
-- fully working, production theme. This inverts 20260625020000_keep_only_aria_theme
-- (Aria → Safari). Safe because:
--   • site_themes has no inbound foreign keys (host_websites stores the chosen
--     theme as a JSON `preset` slug, not an FK to site_themes.id).
--   • Pre-MVP: no production sites depend on the removed themes (the QA fixture is
--     re-pointed to Safari in the same change).

DELETE FROM public.site_themes
WHERE slug IS DISTINCT FROM 'safari';

-- Ensure the surviving Safari row is the active default.
UPDATE public.site_themes
SET is_default = true,
    is_active = true,
    deleted_at = NULL
WHERE slug = 'safari';
