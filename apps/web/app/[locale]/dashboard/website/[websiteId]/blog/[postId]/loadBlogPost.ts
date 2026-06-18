import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

export type BlogPostEditorData = {
  websiteId: string;
  subdomain: string;
  categories: Array<{ id: string; name: string }>;
  post: {
    id: string;
    title: string;
    slug: string;
    status: string;
    categoryId: string;
    coverPath: string;
    excerpt: string;
    bodyHtml: string;
    authorName: string;
    seoTitle: string;
    seoDescription: string;
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

  const [{ data: post }, { data: cats }] = await Promise.all([
    supabase
      .from("website_blog_posts")
      .select(
        "id, title, slug, status, category_id, cover_path, excerpt, body_html, author_name, seo",
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
  ]);
  if (!post) return null;

  const seo = (post.seo ?? {}) as { title?: string; description?: string };

  return {
    websiteId: site.id,
    subdomain: site.subdomain,
    categories: (cats ?? []).map((c) => ({ id: c.id, name: c.name })),
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: post.status,
      categoryId: post.category_id ?? "",
      coverPath: post.cover_path ?? "",
      excerpt: post.excerpt ?? "",
      bodyHtml: post.body_html ?? "",
      authorName: post.author_name ?? "",
      seoTitle: seo.title ?? "",
      seoDescription: seo.description ?? "",
    },
  };
}
