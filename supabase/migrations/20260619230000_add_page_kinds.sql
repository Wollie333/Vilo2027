-- Add additional page kinds required by theme page templates
-- These were missing from the original constraint: blog, checkout, thank-you

ALTER TABLE public.website_pages DROP CONSTRAINT IF EXISTS website_pages_kind_check;
ALTER TABLE public.website_pages ADD CONSTRAINT website_pages_kind_check
  CHECK (kind IN ('home', 'about', 'rooms', 'contact', 'custom', 'specials', 'blog', 'checkout', 'thank-you'));
