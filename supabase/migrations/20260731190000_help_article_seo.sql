-- Migration: SEO fields for help-centre articles.
--
-- Help articles double as Wielo's public SEO/blog source (see
-- 20260618000200_help_website_seo.sql and 20260619007000_help_website_blog_public.sql),
-- so admins need first-class control over how each article appears in Google and
-- when shared on social. Slug already exists on the table; this adds the rest of
-- the standard SEO trio used by the website blog editor:
--
--   seo_title        — <title> / og:title override (falls back to `title`)
--   meta_description — meta description + og:description (falls back to `excerpt`)
--   og_image_url     — featured / social share image (og:image, twitter:image)
--
-- All nullable — a blank field means "fall back to the article's own title /
-- excerpt", matching the blog editor's behaviour.

ALTER TABLE public.help_articles
  ADD COLUMN IF NOT EXISTS seo_title        text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url     text;

COMMENT ON COLUMN public.help_articles.seo_title IS
  'SEO <title> / og:title override. Blank falls back to title.';
COMMENT ON COLUMN public.help_articles.meta_description IS
  'Meta description / og:description. Blank falls back to excerpt.';
COMMENT ON COLUMN public.help_articles.og_image_url IS
  'Featured / social share image (og:image, twitter:image). Absolute URL.';
