import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import {
  loadWebsiteAnalytics,
  type AnalyticsRange,
  type WebsiteAnalytics,
} from "@/lib/website/analytics";
import {
  analyzeSitePerformance,
  type PerfScore,
} from "@/lib/website/perfAnalyzer";

import {
  loadWebsiteEditorData,
  type WebsiteEditorData,
} from "./loadWebsiteEditorData";

export type OverviewSignal = {
  key: string; // i18n key under website.attn*
  count?: number;
  /** tab segment to deep-link to (""=overview, "brand", "blog"…). */
  seg: string;
};

export type OverviewData = {
  site: WebsiteEditorData;
  analytics: WebsiteAnalytics;
  /** Public address to show/visit (custom domain when active, else subdomain). */
  publicUrl: string;
  previewUrl: string;
  isLive: boolean;
  /** Actionable nudges for the "needs attention" panel. */
  signals: OverviewSignal[];
  /** Image-performance readiness (Phase 7c). */
  performance: PerfScore;
};

/**
 * Overview dashboard data: the shared editor data + first-party traffic
 * (Phase 0A) + computed "needs attention" signals. Owner-scoped (returns null
 * when the site isn't owned by the signed-in host).
 */
export async function loadOverviewData(
  websiteId: string,
  range: AnalyticsRange,
): Promise<OverviewData | null> {
  const site = await loadWebsiteEditorData(websiteId);
  if (!site) return null;

  const supabase = createServerClient();

  const [analytics, domainRow, postsRes, hiddenRoomsRes, mediaRes] =
    await Promise.all([
      loadWebsiteAnalytics(supabase, websiteId, range),
      supabase
        .from("host_websites")
        .select("domain_status")
        .eq("id", websiteId)
        .maybeSingle(),
      supabase
        .from("website_blog_posts")
        .select("seo, status")
        .eq("website_id", websiteId)
        .is("deleted_at", null),
      supabase
        .from("website_rooms")
        .select("id", { count: "exact", head: true })
        .eq("website_id", websiteId)
        .eq("is_visible", false),
      supabase
        .from("website_media")
        .select("alt, width, height")
        .eq("website_id", websiteId),
    ]);

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "vilo.site";
  const domainStatus = (domainRow.data?.domain_status as string) ?? "none";
  const isLive = site.status === "published";
  const customActive = Boolean(site.customDomain) && domainStatus === "active";
  const publicUrl = customActive
    ? `https://${site.customDomain}`
    : `https://${site.subdomain}.${root}`;
  const previewUrl = `/site?site=${site.subdomain}&preview=1`;

  // Posts missing an SEO title or description (published ones matter most, but we
  // flag any so the host fixes drafts before publishing).
  const postsNoSeo = (postsRes.data ?? []).filter((p) => {
    const seo = (p.seo ?? {}) as { title?: string; description?: string };
    return !seo.title?.trim() || !seo.description?.trim();
  }).length;
  const hiddenRooms = hiddenRoomsRes.count ?? 0;

  const signals: OverviewSignal[] = [];
  if (isLive && site.isDirty) signals.push({ key: "attnUnpublished", seg: "" });
  if (!isLive) signals.push({ key: "attnNotPublished", seg: "" });
  if (site.customDomain && domainStatus !== "active")
    signals.push({ key: "attnDomain", seg: "domain" });
  if (postsNoSeo > 0)
    signals.push({ key: "attnPostsNoSeo", count: postsNoSeo, seg: "blog" });
  if (hiddenRooms > 0)
    signals.push({ key: "attnHiddenRooms", count: hiddenRooms, seg: "rooms" });
  if (!site.seo.title?.trim())
    signals.push({ key: "attnNoSeoTitle", seg: "seo" });

  // Image-performance readiness over the media library (Phase 7c).
  const mediaRows = mediaRes.data ?? [];
  const performance = analyzeSitePerformance({
    totalImages: mediaRows.length,
    withAlt: mediaRows.filter((m) => (m.alt ?? "").trim()).length,
    withDims: mediaRows.filter((m) => m.width != null && m.height != null)
      .length,
  });

  return {
    site,
    analytics,
    publicUrl,
    previewUrl,
    isLive,
    signals,
    performance,
  };
}
