import "server-only";

import { fetchWieloLedger, wieloLedgerStats } from "@/lib/billing/wielo-ledger";
import { createAdminClient } from "@/lib/supabase/admin";

// Enterprise reporting model for Wielo-as-a-business. One server-side builder
// returns every headline KPI plus the monthly time-series the dashboard charts
// and the PDF export both render — single source of truth for both.

export type ReportRange = "30d" | "90d" | "6m" | "12m" | "ytd";

const REVENUE_BOOKING_STATUSES = ["confirmed", "checked_in", "completed"];

export type MonthlyPoint = {
  month: string; // ISO first-of-month
  label: string; // e.g. "Jan"
  revenue: number; // Wielo revenue collected that month
  signups: number; // total signups that month
  hosts: number; // host signups that month
  guests: number; // guest signups that month
};

export type PlanSlice = {
  key: string;
  name: string;
  count: number;
  mrr: number;
};

export type PlatformReport = {
  generatedAt: string;
  range: ReportRange;
  rangeLabel: string;
  periodStart: string;
  kpis: {
    mrr: number;
    arr: number;
    arpu: number;
    payingHosts: number;
    totalUsers: number;
    hosts: number;
    guests: number;
    newUsersPeriod: number;
    trials: number;
    churned: number;
    churnRate: number; // %
    trialConversion: number; // %
    collectedAllTime: number;
    collectedPeriod: number;
    outstanding: number;
    refunded: number;
    gmv: number;
    bookingCount: number;
    activeListings: number;
  };
  monthly: MonthlyPoint[];
  plans: PlanSlice[];
  statusFunnel: { status: string; count: number }[];
};

const RANGE_LABEL: Record<ReportRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  ytd: "Year to date",
};

function rangeStart(range: ReportRange, now: number): Date {
  const d = new Date(now);
  switch (range) {
    case "30d":
      return new Date(now - 30 * 86_400_000);
    case "90d":
      return new Date(now - 90 * 86_400_000);
    case "6m":
      d.setMonth(d.getMonth() - 6);
      return d;
    case "ytd":
      return new Date(d.getFullYear(), 0, 1);
    case "12m":
    default:
      d.setMonth(d.getMonth() - 12);
      return d;
  }
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export async function buildPlatformReport(
  range: ReportRange = "12m",
  nowMs: number = Date.now(),
): Promise<PlatformReport> {
  const service = createAdminClient();
  const periodStart = rangeStart(range, nowMs).toISOString();

  const [
    { data: productRows },
    { data: subs },
    wieloRows,
    { data: profiles },
    { data: bookingRows },
    { count: activeListings },
  ] = await Promise.all([
    // The product catalog — the REAL price a host pays. A free product (e.g. a
    // beta tier) costs R0 even if it grants a paid plan tier for feature access.
    service.from("products").select("id, name, price, billing_cycle"),
    service
      .from("subscriptions")
      .select("product_id, plan, billing_cycle, status"),
    // Live revenue only — Paystack test-key transactions never count toward
    // business KPIs (the admin Payments tab has a Test filter to inspect them).
    fetchWieloLedger(service, { limit: 10_000, environment: "live" }),
    service
      .from("user_profiles")
      .select("role, created_at")
      .is("deleted_at", null),
    service
      .from("bookings")
      .select("total_amount, status")
      .in("status", REVENUE_BOOKING_STATUSES),
    service
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("is_published", true),
  ]);

  // ── Revenue / subscriptions ── (product-driven, not plan-tier)
  // MRR + paying hosts + the plan mix reflect the actual PRODUCT each host is on.
  // A host on a free product contributes R0 and is NOT a paying host, even if the
  // product grants a paid plan tier for feature gating.
  const productById = new Map(
    (productRows ?? []).map((p) => [p.id as string, p]),
  );
  let mrr = 0;
  let payingHosts = 0;
  let trials = 0;
  let churned = 0;
  const prodCount: Record<string, number> = {};
  const prodMrr: Record<string, number> = {};
  const statusCount: Record<string, number> = {};
  for (const s of subs ?? []) {
    const status = (s.status as string) ?? "unknown";
    statusCount[status] = (statusCount[status] ?? 0) + 1;
    if (status === "trialing") trials += 1;
    if (status === "cancelled" || status === "expired") churned += 1;

    const prod = s.product_id ? productById.get(s.product_id as string) : null;
    const price = prod ? Number(prod.price ?? 0) : 0;
    const key = (s.product_id as string) ?? "none";
    prodCount[key] = (prodCount[key] ?? 0) + 1;

    if (status === "active" && price > 0) {
      const m = prod?.billing_cycle === "annual" ? price / 12 : price;
      mrr += m;
      prodMrr[key] = (prodMrr[key] ?? 0) + m;
      payingHosts += 1;
    }
  }
  const arr = mrr * 12;
  const stats = wieloLedgerStats(wieloRows);
  const totalSubs = (subs ?? []).length;
  const churnRate = totalSubs > 0 ? (churned / totalSubs) * 100 : 0;
  const trialConversion =
    trials + payingHosts > 0 ? (payingHosts / (trials + payingHosts)) * 100 : 0;

  // ── Users / growth ──
  let totalUsers = 0;
  let hosts = 0;
  let guests = 0;
  let newUsersPeriod = 0;
  for (const u of profiles ?? []) {
    totalUsers += 1;
    if (u.role === "host") hosts += 1;
    else if (u.role === "guest") guests += 1;
    if (u.created_at && u.created_at >= periodStart) newUsersPeriod += 1;
  }

  // ── Operations ──
  const gmv = (bookingRows ?? []).reduce(
    (s, b) => s + Number(b.total_amount ?? 0),
    0,
  );
  const bookingCount = bookingRows?.length ?? 0;

  // ── Monthly time series (last 12 calendar months) ──
  const now = new Date(nowMs);
  const months: MonthlyPoint[] = [];
  const monthIndex = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthIndex.set(key, months.length);
    months.push({
      month: d.toISOString(),
      label: MONTH_LABELS[d.getMonth()],
      revenue: 0,
      signups: 0,
      hosts: 0,
      guests: 0,
    });
  }
  const keyOf = (iso: string): string => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  // Wielo revenue collected per month (completed charges).
  for (const r of wieloRows) {
    if (r.status !== "completed" || r.type !== "charge") continue;
    const idx = monthIndex.get(keyOf(r.date));
    if (idx != null) months[idx].revenue += r.amount;
  }
  // Signups per month by role.
  for (const u of profiles ?? []) {
    if (!u.created_at) continue;
    const idx = monthIndex.get(keyOf(u.created_at));
    if (idx == null) continue;
    months[idx].signups += 1;
    if (u.role === "host") months[idx].hosts += 1;
    else if (u.role === "guest") months[idx].guests += 1;
  }

  const planSlices: PlanSlice[] = (productRows ?? [])
    .map((p) => ({
      key: p.id as string,
      name: p.name as string,
      count: prodCount[p.id as string] ?? 0,
      mrr: Math.round(prodMrr[p.id as string] ?? 0),
    }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.mrr - a.mrr);
  // Subscriptions not linked to a product (legacy/none) — surface honestly.
  if ((prodCount["none"] ?? 0) > 0) {
    planSlices.push({
      key: "none",
      name: "No product",
      count: prodCount["none"],
      mrr: 0,
    });
  }

  const statusFunnel = Object.entries(statusCount)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Period-scoped collected (charges within the range).
  const collectedPeriod = wieloRows
    .filter(
      (r) =>
        r.status === "completed" &&
        r.type === "charge" &&
        r.date >= periodStart,
    )
    .reduce((s, r) => s + r.amount, 0);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    range,
    rangeLabel: RANGE_LABEL[range],
    periodStart,
    kpis: {
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      arpu: payingHosts > 0 ? Math.round(mrr / payingHosts) : 0,
      payingHosts,
      totalUsers,
      hosts,
      guests,
      newUsersPeriod,
      trials,
      churned,
      churnRate: Math.round(churnRate * 10) / 10,
      trialConversion: Math.round(trialConversion * 10) / 10,
      collectedAllTime: Math.round(stats.collected),
      collectedPeriod: Math.round(collectedPeriod),
      outstanding: Math.round(stats.pending),
      refunded: Math.round(stats.refunded),
      gmv: Math.round(gmv),
      bookingCount,
      activeListings: activeListings ?? 0,
    },
    monthly: months,
    plans: planSlices,
    statusFunnel,
  };
}

export function isReportRange(v: string | undefined): v is ReportRange {
  return v === "30d" || v === "90d" || v === "6m" || v === "12m" || v === "ytd";
}
