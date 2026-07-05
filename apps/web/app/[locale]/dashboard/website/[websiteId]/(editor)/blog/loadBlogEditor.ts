import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

export type BlogCategoryRow = { id: string; name: string };
export type BlogCategoryStat = {
  id: string;
  name: string;
  slug: string;
  count: number;
};

export type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  featured: boolean;
  hasSeo: boolean;
  categoryId: string | null;
  categoryName: string | null;
  coverPath: string | null;
  authorName: string | null;
  publishAt: string | null;
  updatedAt: string;
};

export type BlogAuthorRow = {
  id: string;
  name: string;
  avatarPath: string;
  bio: string;
};

export type BlogEditorData = {
  websiteId: string;
  subdomain: string;
  categories: BlogCategoryStat[];
  authors: BlogAuthorRow[];
  posts: BlogPostRow[];
  /** The host's own profile as a default author (name/photo/bio) — used to
   *  prefill the author editor the first time, before any author exists. */
  hostAuthor: Omit<BlogAuthorRow, "id"> | null;
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

  const [
    { data: cats },
    { data: authorRows },
    { data: posts },
    { data: host },
  ] = await Promise.all([
    supabase
      .from("website_blog_categories")
      .select("id, name, slug")
      .eq("website_id", site.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("website_blog_authors")
      .select("id, name, avatar_path, bio")
      .eq("website_id", site.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("website_blog_posts")
      .select(
        "id, title, slug, status, featured, seo, cover_path, publish_at, updated_at, category:website_blog_categories ( id, name ), author:website_blog_authors ( id, name )",
      )
      .eq("website_id", site.id)
      .is("deleted_at", null)
      .order("featured", { ascending: false })
      .order("updated_at", { ascending: false }),
    // The host's own profile — the default first author (name/photo/bio).
    supabase
      .from("hosts")
      .select("display_name, avatar_url, bio")
      .eq("id", hostId)
      .maybeSingle(),
  ]);

  const authors: BlogAuthorRow[] = (authorRows ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    avatarPath: a.avatar_path ?? "",
    bio: a.bio ?? "",
  }));

  // hosts.avatar_url is an absolute URL; websiteAssetUrl passes it through so it
  // renders as-is in the author photo field + on the published post.
  const hostName = host?.display_name?.trim();
  const hostAuthor: Omit<BlogAuthorRow, "id"> | null = hostName
    ? {
        name: hostName,
        avatarPath: host?.avatar_url?.trim() || "",
        bio: host?.bio?.trim() || "",
      }
    : null;

  const postRows: BlogPostRow[] = (posts ?? []).map((p) => {
    const category = p.category as unknown as {
      id: string;
      name: string;
    } | null;
    const author = p.author as unknown as { id: string; name: string } | null;
    const seo = (p.seo ?? {}) as { title?: string; description?: string };
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      featured: p.featured ?? false,
      hasSeo: Boolean(seo.title?.trim() || seo.description?.trim()),
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      coverPath: p.cover_path ?? null,
      authorName: author?.name ?? null,
      publishAt: p.publish_at,
      updatedAt: p.updated_at,
    };
  });

  // Per-category post counts (active posts only).
  const countByCat = new Map<string, number>();
  for (const p of postRows) {
    if (p.categoryId)
      countByCat.set(p.categoryId, (countByCat.get(p.categoryId) ?? 0) + 1);
  }
  const categories: BlogCategoryStat[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    count: countByCat.get(c.id) ?? 0,
  }));

  return {
    websiteId: site.id,
    subdomain: site.subdomain,
    categories,
    authors,
    posts: postRows,
    hostAuthor,
  };
}
