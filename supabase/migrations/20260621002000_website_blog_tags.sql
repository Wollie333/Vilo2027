-- Phase 7(b): blog tags. A normalized tag catalogue per website + a post↔tag
-- join. Tags are managed inline from the post editor (typed by name, created on
-- save); archive pages list a tag's posts. Mirrors the website_blog_categories /
-- _authors owner+admin RLS pattern (get_my_host_id / is_super_admin).

CREATE TABLE IF NOT EXISTS public.website_blog_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE,
  name       text NOT NULL,
  slug       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_blog_tags_website
  ON public.website_blog_tags (website_id);

ALTER TABLE public.website_blog_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_blog_tags_owner_all ON public.website_blog_tags
  FOR ALL TO authenticated
  USING (
    website_id IN (
      SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()
    )
  )
  WITH CHECK (
    website_id IN (
      SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()
    )
  );

CREATE POLICY website_blog_tags_admin_all ON public.website_blog_tags
  FOR ALL USING (is_super_admin());

-- ── Post ↔ tag join ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.website_blog_post_tags (
  post_id uuid NOT NULL
    REFERENCES public.website_blog_posts(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL
    REFERENCES public.website_blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_website_blog_post_tags_tag
  ON public.website_blog_post_tags (tag_id);

ALTER TABLE public.website_blog_post_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_blog_post_tags_owner_all ON public.website_blog_post_tags
  FOR ALL TO authenticated
  USING (
    post_id IN (
      SELECT p.id
      FROM public.website_blog_posts p
      JOIN public.host_websites w ON w.id = p.website_id
      WHERE w.host_id = get_my_host_id()
    )
  )
  WITH CHECK (
    post_id IN (
      SELECT p.id
      FROM public.website_blog_posts p
      JOIN public.host_websites w ON w.id = p.website_id
      WHERE w.host_id = get_my_host_id()
    )
  );

CREATE POLICY website_blog_post_tags_admin_all ON public.website_blog_post_tags
  FOR ALL USING (is_super_admin());
