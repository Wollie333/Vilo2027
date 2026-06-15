import "server-only";

import { fetchViloLedger, viloLedgerStats } from "@/lib/billing/vilo-ledger";
import { getAllPlans } from "@/lib/plans/getPlans";
import { createAdminClient } from "@/lib/supabase/admin";

// Enterprise reporting model for Vilo-as-a-business. One server-side builder
// returns every headline KPI plus the monthly time-series the dashboard charts
// and the PDF export both render — single source of truth for both.

export type ReportRange = "30d" | "90d" | "6m" | "12m" | "ytd";

const REVENUE_BOOKING_STATUSES = ["confirmed", "checked_in", "completed"];

export type MonthlyPoint = {
  month: string; // ISO first-of-month
  label: string; // e.g. "Jan"
  revenue: number; // Vilo revenue collected that month
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
    plans,
    { data: subs },
    viloRows,
    { data: profiles },
    { data: bookingRows },
    { count: activeListings },
  ] = await Promise.all([
    getAllPlans(),
    service.from("subscriptions").select("plan, billing_cycle, status"),
    fetchViloLedger(service, { limit: 10_000 }),
    service
      .from("user_profiles")
      .select("role, created_at")
      .is("deleted_at", null),
    service
      .from("bookings")
      .select("total_amount, status")
      .in("status", REVENUE_BOOKING_STATUSES),
    service
      .from("listings")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("is_published", true),
  ]);

  // ── Revenue / subscriptions ──
  const priceMap = new Map(plans.map((p) => [p.key, p]));
  let mrr = 0;
  let payingHosts = 0;
  let trials = 0;
  let churned = 0;
  const planCount: Record<string, number> = {};
  const planMrr: Record<string, number> = {};
  const statusCount: Record<string, number> = {};
  for (const p of plans) {
    planCount[p.key] = 0;
    planMrr[p.key] = 0;
  }
  for (const s of subs ?? []) {
    const status = (s.status as string) ?? "unknown";
    statusCount[status] = (statusCount[status] ?? 0) + 1;
    if (s.plan) planCount[s.plan] = (planCount[s.plan] ?? 0) + 1;
    if (status === "trialing") trials += 1;
    if (status === "cancelled" || status === "expired") churned += 1;
    if (status === "active") {
      const pd = priceMap.get(s.plan as string);
      if (pd && !pd.isFree) {
        const m = s.billing_cycle === "annual" ? pd.annual / 12 : pd.monthly;
        mrr += m;
        if (s.plan) planMrr[s.plan] = (planMrr[s.plan] ?? 0) + m;
        payingHosts += 1;
      }
    }
  }
  const arr = mrr * 12;
  const stats = viloLedgerStats(viloRows);
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
  // Vilo revenue collected per month (completed charges).
  for (const r of viloRows) {
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

  const planSlices: PlanSlice[] = plans
    .map((p) => ({
      key: p.key,
      name: p.name,
      count: planCount[p.key] ?? 0,
      mrr: Math.round(planMrr[p.key] ?? 0),
    }))
    .filter((p) => p.count > 0);

  const statusFunnel = Object.entries(statusCount)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Period-scoped collected (charges within the range).
  const collectedPeriod = viloRows
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
