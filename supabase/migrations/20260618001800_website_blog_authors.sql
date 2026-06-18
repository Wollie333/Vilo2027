-- Website CMS Blog — reusable author profiles (Phase 8 deferral).
--
-- Replaces the per-post free-text author with a reusable author profile (name +
-- avatar + bio) that posts reference by FK. The per-post author_bio /
-- author_avatar_path columns added in 20260618001700 are dropped (no data,
-- pre-MVP) — avatar/bio now live on the author row. author_name is kept as a
-- legacy fallback for any post without an author_id.

CREATE TABLE IF NOT EXISTS public.website_blog_authors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE,
  name        text NOT NULL,
  avatar_path text,
  bio         text,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_blog_authors_website
  ON public.website_blog_authors(website_id);

ALTER TABLE public.website_blog_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_blog_authors_owner_all ON public.website_blog_authors
  FOR ALL TO authenticated
  USING (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()))
  WITH CHECK (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()));
CREATE POLICY website_blog_authors_admin_all ON public.website_blog_authors
  FOR ALL USING (is_super_admin());

-- Posts reference a reusable author; SET NULL keeps the post if the author is removed.
ALTER TABLE public.website_blog_posts
  ADD COLUMN IF NOT EXISTS author_id uuid
    REFERENCES public.website_blog_authors(id) ON DELETE SET NULL,
  DROP COLUMN IF EXISTS author_bio,
  DROP COLUMN IF EXISTS author_avatar_path;
