import "server-only";

import type { Database } from "@vilo/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Aggregates first-party website traffic (Phase 0A) for the Overview dashboard.
// Reads `website_analytics_events` (cookieless pageview/booking_click rows) over
// a window and the equal-length window before it (for vs-previous deltas), then
// rolls everything up in JS — fine at pre-MVP volumes for a single website.
//
// "Avg time / session duration" is intentionally NOT reported: the beacon fires
// one pageview, so we cannot measure dwell time without lying. We surface
// `pagesPerVisit` (a real metric) instead.

type Db = SupabaseClient<Database>;

export type AnalyticsRange = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export type AnalyticsTrendPoint = {
  date: string; // YYYY-MM-DD
  visitors: number;
  pageviews: number;
};

export type WebsiteAnalytics = {
  range: AnalyticsRange;
  hasData: boolean;
  visitors: number;
  pageviews: number;
  bookingClicks: number;
  /** booking-clicks ÷ visitors, 0..1 (0 when no visitors). */
  conversion: number;
  pagesPerVisit: number;
  /** Percent change vs the equal-length previous window (null when no baseline). */
  deltas: {
    visitors: number | null;
    pageviews: number | null;
    bookingClicks: number | null;
  };
  trend: AnalyticsTrendPoint[];
  topPages: { path: string; views: number }[];
  sources: { label: string; visits: number }[];
  devices: { desktop: number; mobile: number };
};

type EventRow = {
  event: string;
  path: string;
  session_id: string | null;
  referrer_host: string | null;
  device: string | null;
  created_at: string;
};

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Empty result so the UI can render a clean zero-state without branching. */
function emptyAnalytics(range: AnalyticsRange): WebsiteAnalytics {
  return {
    range,
    hasData: false,
    visitors: 0,
    pageviews: 0,
    bookingClicks: 0,
    conversion: 0,
    pagesPerVisit: 0,
    deltas: { visitors: null, pageviews: null, bookingClicks: null },
    trend: [],
    topPages: [],
    sources: [],
    devices: { desktop: 0, mobile: 0 },
  };
}

export async function loadWebsiteAnalytics(
  sb: Db,
  websiteId: string,
  range: AnalyticsRange = "30d",
  now: Date = new Date(),
): Promise<WebsiteAnalytics> {
  const days = RANGE_DAYS[range];
  const end = now;
  const start = new Date(end.getTime() - days * 86_400_000);
  const prevStart = new Date(start.getTime() - days * 86_400_000);

  const { data, error } = await sb
    .from("website_analytics_events")
    .select("event, path, session_id, referrer_host, device, created_at")
    .eq("website_id", websiteId)
    .gte("created_at", prevStart.toISOString())
    .order("created_at", { ascending: true })
    .limit(50_000);

  if (error || !data || data.length === 0) return emptyAnalytics(range);

  const rows = data as EventRow[];
  const startMs = start.getTime();

  // Current vs previous window split.
  const cur: EventRow[] = [];
  const prev: EventRow[] = [];
  for (const r of rows) {
    if (new Date(r.created_at).getTime() >= startMs) cur.push(r);
    else prev.push(r);
  }

  const tally = (set: EventRow[]) => {
    const sessions = new Set<string>();
    let pageviews = 0;
    let bookingClicks = 0;
    for (const r of set) {
      if (r.session_id) sessions.add(r.session_id);
      if (r.event === "pageview") pageviews += 1;
      else if (r.event === "booking_click") bookingClicks += 1;
    }
    return { visitors: sessions.size, pageviews, bookingClicks };
  };

  const curT = tally(cur);
  const prevT = tally(prev);

  // Daily trend buckets (zero-filled across the window).
  const trendMap = new Map<
    string,
    { visitors: Set<string>; pageviews: number }
  >();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(startMs + i * 86_400_000);
    trendMap.set(dayKey(d.toISOString()), {
      visitors: new Set(),
      pageviews: 0,
    });
  }
  const topPages = new Map<string, number>();
  const sources = new Map<string, Set<string>>();
  let desktop = 0;
  let mobile = 0;

  for (const r of cur) {
    const key = dayKey(r.created_at);
    const bucket = trendMap.get(key);
    if (bucket) {
      if (r.session_id) bucket.visitors.add(r.session_id);
      if (r.event === "pageview") bucket.pageviews += 1;
    }
    if (r.event === "pageview") {
      topPages.set(r.path, (topPages.get(r.path) ?? 0) + 1);
      if (r.device === "mobile") mobile += 1;
      else if (r.device === "desktop") desktop += 1;
      const label = r.referrer_host ?? "Direct";
      if (!sources.has(label)) sources.set(label, new Set());
      if (r.session_id) sources.get(label)!.add(r.session_id);
    }
  }

  const trend: AnalyticsTrendPoint[] = Array.from(trendMap.entries()).map(
    ([date, b]) => ({
      date,
      visitors: b.visitors.size,
      pageviews: b.pageviews,
    }),
  );

  const conversion = curT.visitors > 0 ? curT.bookingClicks / curT.visitors : 0;
  const pagesPerVisit = curT.visitors > 0 ? curT.pageviews / curT.visitors : 0;

  return {
    range,
    hasData: curT.pageviews > 0,
    visitors: curT.visitors,
    pageviews: curT.pageviews,
    bookingClicks: curT.bookingClicks,
    conversion,
    pagesPerVisit,
    deltas: {
      visitors: pctChange(curT.visitors, prevT.visitors),
      pageviews: pctChange(curT.pageviews, prevT.pageviews),
      bookingClicks: pctChange(curT.bookingClicks, prevT.bookingClicks),
    },
    trend,
    topPages: Array.from(topPages.entries())
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 6),
    sources: Array.from(sources.entries())
      .map(([label, set]) => ({ label, visits: set.size }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 6),
    devices: { desktop, mobile },
  };
}
