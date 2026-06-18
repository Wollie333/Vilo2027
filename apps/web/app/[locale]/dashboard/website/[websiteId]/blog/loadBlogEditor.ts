import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

export type BlogCategoryRow = { id: string; name: string };

export type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  categoryId: string | null;
  categoryName: string | null;
  publishAt: string | null;
  updatedAt: string;
};

export type BlogEditorData = {
  websiteId: string;
  subdomain: string;
  categories: BlogCategoryRow[];
  posts: BlogPostRow[];
};

/**
 * Owner-scoped load of a site's blog: its categories + non-deleted posts (newest
 * first). Returns null when the website isn't owned by the signed-in host.
 */
export async function loadBlogEditor(
  websiteId: string,
): Promise<BlogEditorData | null> {
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

  const [{ data: cats }, { data: posts }] = await Promise.all([
    supabase
      .from("website_blog_categories")
      .select("id, name")
      .eq("website_id", site.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("website_blog_posts")
      .select(
        "id, title, slug, status, publish_at, updated_at, category:website_blog_categories ( id, name )",
      )
      .eq("website_id", site.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
  ]);

  const categories: BlogCategoryRow[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const postRows: BlogPostRow[] = (posts ?? []).map((p) => {
    const category = p.category as unknown as {
      id: string;
      name: string;
    } | null;
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      publishAt: p.publish_at,
      updatedAt: p.updated_at,
    };
  });

  return {
    websiteId: site.id,
    subdomain: site.subdomain,
    categories,
    posts: postRows,
  };
}
