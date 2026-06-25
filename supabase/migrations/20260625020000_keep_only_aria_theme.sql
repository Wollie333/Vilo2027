-- Keep ONLY the default "Aria" theme; hard-remove every other site_themes row.
--
-- Per the founder's decision, Aria is the sole theme offered platform-wide. The
-- app already filters the gallery to the default theme; this removes the others
-- from the database entirely. Safe because:
--   • site_themes has no inbound foreign keys (host_websites stores the chosen
--     theme as a JSON `preset` slug, not an FK to site_themes.id).
--   • Pre-MVP: no production sites reference the removed themes.

DELETE FROM public.site_themes
WHERE slug IS DISTINCT FROM 'aria';

-- Defensive: ensure the surviving Aria row is the active default.
UPDATE public.site_themes
SET is_default = true,
    is_active = true,
    deleted_at = NULL
WHERE slug = 'aria';
