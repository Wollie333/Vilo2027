-- Migration: marketing assets become a full content library
--
-- The affiliate marketing library started as file-only banners. Admins now
-- manage six content types — banners, social posts, email templates, AI
-- prompts, videos and blogs — and each asset may carry ANY combination of:
--   • a file   (file_path / file_url — e.g. a banner image or uploaded video)
--   • a link   (link_url — e.g. a YouTube/Vimeo video or a blog post)
--   • text     (body — e.g. an email body, social caption or AI prompt)
--
-- So file_path/file_url become optional and we add `body` + `link_url`. The
-- category column already has no CHECK, so the new category strings need no
-- constraint change. Additive + backwards-compatible: existing banner rows keep
-- their file columns untouched.

ALTER TABLE public.marketing_assets
  ALTER COLUMN file_path DROP NOT NULL,
  ALTER COLUMN file_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS link_url text;

COMMENT ON COLUMN public.marketing_assets.category IS
  'banner | social | email | prompt | video | blog | logo | other';
COMMENT ON COLUMN public.marketing_assets.body IS
  'Copy-paste text content (email body, social caption, AI prompt, blog excerpt).';
COMMENT ON COLUMN public.marketing_assets.link_url IS
  'External URL for the asset (video embed, blog post, or a call-to-action).';
