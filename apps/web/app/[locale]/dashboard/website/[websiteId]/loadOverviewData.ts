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

/** One card in the "All websites" portfolio grid (premium Overview). */
export type PortfolioSite = {
  id: string;
  name: string;
  glyph: string;
  /** Stable accent for the hero glyph (derived from list order). */
  color: string;
  subdomain: string;
  status: WebsiteEditorData["status"];
  /** Real first-party traffic over the active range. */
  visitors: number;
  pageviews: number;
  bookingClicks: number;
  isCurrent: boolean;
};

export type OverviewData = {
  site: WebsiteEditorData;
  analytics: WebsiteAnalytics;
  /** Every site this host owns, with per-site traffic (for the portfolio grid). */
  portfolio: PortfolioSite[];
  /** Public address to show/visit (custom domain when active, else subdomain). */
  publicUrl: string;
  previewUrl: string;
  isLive: boolean;
  /** Actionable nudges for the "needs attention" panel. */
  signals: OverviewSignal[];
  /** Image-performance readiness (Phase 7c). */
  performance: PerfScore;
};

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Hero-glyph accents, cycled by portfolio order (mirrors the mockup). */
const GLYPH_COLORS = [
  "#10B981",
  "#064E3B",
  "#0EA5E9",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
];

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

  const [analytics, domainRow, postsRes, mediaRes, sitesRes] =
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
        .from("website_media")
        .select("alt, width, height")
        .eq("website_id", websiteId),
      // Portfolio: every site this host owns (ordered oldest-first so glyph
      // accents stay stable as new sites are added).
      supabase
        .from("host_websites")
        .select("id, subdomain, status, brand")
        .eq("host_id", site.hostId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
    ]);

  // Per-site traffic for the portfolio cards — one grouped query over the active
  // window (fine at pre-MVP volumes), tallied in JS.
  const siteRows = (sitesRes.data ?? []) as {
    id: string;
    subdomain: string;
    status: WebsiteEditorData["status"];
    brand: { name?: string } | null;
  }[];
  const ids = siteRows.map((s) => s.id);
  const windowStart = new Date(
    Date.now() - RANGE_DAYS[range] * 86_400_000,
  ).toISOString();
  const traffic = new Map<
    string,
    { sessions: Set<string>; pageviews: number; clicks: number }
  >();
  if (ids.length > 0) {
    const { data: events } = await supabase
      .from("website_analytics_events")
      .select("website_id, event, session_id")
      .in("website_id", ids)
      .gte("created_at", windowStart)
      .limit(50_000);
    for (const e of (events ?? []) as {
      website_id: string;
      event: string;
      session_id: string | null;
    }[]) {
      let t = traffic.get(e.website_id);
      if (!t) {
        t = { sessions: new Set(), pageviews: 0, clicks: 0 };
        traffic.set(e.website_id, t);
      }
      if (e.session_id) t.sessions.add(e.session_id);
      if (e.event === "pageview") t.pageviews += 1;
      else if (e.event === "booking_click") t.clicks += 1;
    }
  }
  const portfolio: PortfolioSite[] = siteRows.map((s, i) => {
    const t = traffic.get(s.id);
    return {
      id: s.id,
      name: s.brand?.name?.trim() || s.subdomain,
      glyph: (s.brand?.name?.trim() || s.subdomain)[0]?.toUpperCase() || "·",
      color: GLYPH_COLORS[i % GLYPH_COLORS.length],
      subdomain: s.subdomain,
      status: s.status,
      visitors: t?.sessions.size ?? 0,
      pageviews: t?.pageviews ?? 0,
      bookingClicks: t?.clicks ?? 0,
      isCurrent: s.id === websiteId,
    };
  });

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

  const signals: OverviewSignal[] = [];
  if (isLive && site.isDirty) signals.push({ key: "attnUnpublished", seg: "" });
  if (!isLive) signals.push({ key: "attnNotPublished", seg: "" });
  if (site.customDomain && domainStatus !== "active")
    signals.push({ key: "attnDomain", seg: "domain" });
  if (postsNoSeo > 0)
    signals.push({ key: "attnPostsNoSeo", count: postsNoSeo, seg: "blog" });
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
    portfolio,
    publicUrl,
    previewUrl,
    isLive,
    signals,
    performance,
  };
}
