import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

export type BlogAuthorRow = {
  id: string;
  name: string;
  avatarPath: string;
  bio: string;
};

export type BlogPostEditorData = {
  websiteId: string;
  subdomain: string;
  categories: Array<{ id: string; name: string }>;
  authors: BlogAuthorRow[];
  post: {
    id: string;
    title: string;
    slug: string;
    status: string;
    featured: boolean;
    publishAt: string;
    categoryId: string;
    authorId: string;
    coverPath: string;
    excerpt: string;
    bodyHtml: string;
    seoTitle: string;
    seoDescription: string;
    seoFocusKeyword: string;
  };
};

/**
 * Owner-scoped load of one blog post + the site's categories (for the picker).
 * Returns null when the post or website isn't owned by the signed-in host.
 */
export async function loadBlogPost(
  websiteId: string,
  postId: string,
): Promise<BlogPostEditorData | null> {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) return null;

  const { data: site } = await supabase
    .from("host_websites")
    .select("id, subdomain")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return null;

  const [{ data: post }, { data: cats }, { data: authors }] = await Promise.all(
    [
      supabase
        .from("website_blog_posts")
        .select(
          "id, title, slug, status, featured, publish_at, category_id, author_id, cover_path, excerpt, body_html, seo",
        )
        .eq("id", postId)
        .eq("website_id", site.id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("website_blog_categories")
        .select("id, name")
        .eq("website_id", site.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("website_blog_authors")
        .select("id, name, avatar_path, bio")
        .eq("website_id", site.id)
        .order("sort_order", { ascending: true }),
    ],
  );
  if (!post) return null;

  const seo = (post.seo ?? {}) as {
    title?: string;
    description?: string;
    focusKeyword?: string;
  };

  return {
    websiteId: site.id,
    subdomain: site.subdomain,
    categories: (cats ?? []).map((c) => ({ id: c.id, name: c.name })),
    authors: (authors ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      avatarPath: a.avatar_path ?? "",
      bio: a.bio ?? "",
    })),
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: post.status,
      featured: post.featured ?? false,
      publishAt: post.publish_at ?? "",
      categoryId: post.category_id ?? "",
      authorId: post.author_id ?? "",
      coverPath: post.cover_path ?? "",
      excerpt: post.excerpt ?? "",
      bodyHtml: post.body_html ?? "",
      seoTitle: seo.title ?? "",
      seoDescription: seo.description ?? "",
      seoFocusKeyword: seo.focusKeyword ?? "",
    },
  };
}
