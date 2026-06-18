-- Website CMS Blog — enterprise enhancements (Phase 8).
--
-- Adds: a per-post "featured" flag (pin a hero post), and richer author fields
-- (avatar + bio) so a post can show a proper author profile instead of a bare
-- name. The status CHECK already allows 'scheduled' and publish_at already
-- exists (W1), so scheduled publishing needs no schema change here — only the
-- cron worker (separate migration).

ALTER TABLE public.website_blog_posts
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS author_bio text,
  ADD COLUMN IF NOT EXISTS author_avatar_path text;

COMMENT ON COLUMN public.website_blog_posts.featured IS
  'Pin this post as the blog hero (shown first / larger).';
COMMENT ON COLUMN public.website_blog_posts.author_avatar_path IS
  'website-assets storage path for the author avatar.';

-- Fast lookup of scheduled posts due to go live (cron worker).
CREATE INDEX IF NOT EXISTS website_blog_posts_scheduled_idx
  ON public.website_blog_posts (publish_at)
  WHERE status = 'scheduled' AND deleted_at IS NULL;
