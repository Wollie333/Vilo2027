import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";
import { computeWebsiteDirty } from "@/lib/website/publish";

export type WebsiteEditorData = {
  id: string;
  hostId: string;
  businessId: string;
  subdomain: string;
  customDomain: string | null;
  status: "draft" | "published" | "unpublished";
  publishedAt: string | null;
  brand: {
    name?: string;
    tagline?: string;
    logo_path?: string;
    favicon_path?: string;
    logo_style?: "wordmark" | "mark" | "icon";
    contact?: { email?: string; phone?: string };
    socials?: Record<string, string>;
  };
  theme: { preset?: string; accent?: string; font?: string; radius?: string };
  seo: {
    title?: string;
    description?: string;
    og_image_path?: string;
    gsc_token?: string;
    robots_index?: boolean;
    sitemap_enabled?: boolean;
  };
  businessName: string | null;
  counts: { pages: number; properties: number; rooms: number; posts: number };
  /** True when the live draft differs from what's published (or never published). */
  isDirty: boolean;
};

/**
 * Owner-scoped load of one website + the counts the editor surfaces. Returns null
 * if the website doesn't exist or isn't owned by the signed-in host.
 */
export async function loadWebsiteEditorData(
  websiteId: string,
): Promise<WebsiteEditorData | null> {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) return null;

  const { data: site } = await supabase
    .from("host_websites")
    .select(
      "id, business_id, subdomain, custom_domain, status, published_at, brand, theme, seo, business:businesses ( trading_name )",
    )
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return null;

  const [
    { count: pages },
    { count: properties },
    { count: rooms },
    { count: posts },
    dirty,
  ] = await Promise.all([
    supabase
      .from("website_pages")
      .select("id", { count: "exact", head: true })
      .eq("website_id", site.id),
    supabase
      .from("website_properties")
      .select("id", { count: "exact", head: true })
      .eq("website_id", site.id)
      .eq("is_visible", true),
    supabase
      .from("website_rooms")
      .select("id", { count: "exact", head: true })
      .eq("website_id", site.id)
      .eq("is_visible", true),
    supabase
      .from("website_blog_posts")
      .select("id", { count: "exact", head: true })
      .eq("website_id", site.id)
      .is("deleted_at", null),
    computeWebsiteDirty(supabase, site.id),
  ]);

  const brand = (site.brand ?? {}) as WebsiteEditorData["brand"];
  const theme = (site.theme ?? {}) as WebsiteEditorData["theme"];
  const seo = (site.seo ?? {}) as WebsiteEditorData["seo"];
  const business = site.business as unknown as {
    trading_name: string | null;
  } | null;

  return {
    id: site.id,
    hostId,
    businessId: site.business_id,
    subdomain: site.subdomain,
    customDomain: site.custom_domain,
    status: site.status as WebsiteEditorData["status"],
    publishedAt: site.published_at,
    brand,
    theme,
    seo,
    businessName: business?.trading_name ?? null,
    counts: {
      pages: pages ?? 0,
      properties: properties ?? 0,
      rooms: rooms ?? 0,
      posts: posts ?? 0,
    },
    isDirty: dirty.isDirty,
  };
}
