-- Use the Safari theme's actual high-resolution hero image as its gallery
-- preview card (replacing the schematic SVG mockup) — the same savanna-sunset
-- photo the live hero renders. An https:// URL passes through websiteAssetUrl
-- unchanged, so the Brand Studio theme card shows the real hero at full res.
UPDATE public.site_themes
SET preview_image_path =
  'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1600&q=80'
WHERE slug = 'safari';
