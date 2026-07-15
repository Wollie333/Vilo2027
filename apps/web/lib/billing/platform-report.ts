import "server-only";

import { fetchWieloLedger, wieloLedgerStats } from "@/lib/billing/wielo-ledger";
import { WIELO_SUPPORT_EMAIL } from "@/lib/inbox/platform-thread";
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
  gmv: number; // host↔guest booking value for stays checking in that month
  signups: number; // total signups that month
  hosts: number; // host signups that month
  guests: number; // guest signups that month
};

export type BookingStatusSlice = {
  status: string;
  count: number;
};

export type PlanSlice = {
  key: string;
  name: string;
  /** subscription = active subs + MRR; one_off = units sold + collected total. */
  type: "subscription" | "one_off";
  count: number; // active subs (subscription) OR units sold (one_off)
  mrr: number; // MRR (subscription) OR total collected (one_off)
  /** True when this row's sales are all test-mode (shows a "test" tag). */
  testOnly?: boolean;
};

export type PaymentMethodSlice = {
  provider: string;
  amount: number;
  count: number;
};

export type CreditNoteSlice = {
  kind: string; // refund | credit | adjustment
  count: number;
  amount: number; // positive magnitude
};

export type GeoSlice = {
  province: string;
  listings: number;
};

export type PlatformReport = {
  generatedAt: string;
  range: ReportRange;
  rangeLabel: string;
  periodStart: string;
  monthsShown: number;
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
    vatCollected: number; // output VAT on period charges
    takeRate: number; // Wielo revenue ÷ GMV, %
    momRevenue: number | null; // month-over-month revenue growth %
    momSignups: number | null; // month-over-month signup growth %
    gmv: number;
    bookingCount: number;
    activeListings: number;
    // Credit UNITS (not Rand) moved in the period.
    creditsPurchased: number;
    creditsGranted: number;
    creditsSpent: number;
    // Platform quote / Looking-For volume in the period.
    quotesCreated: number;
    lookingForPosts: number;
    lookingForResponses: number;
    // Affiliate liabilities (Wielo → affiliates) in the period.
    affiliateCommissions: number;
    affiliatePayouts: number;
  };
  monthly: MonthlyPoint[];
  plans: PlanSlice[];
  statusFunnel: { status: string; count: number }[];
  paymentMethods: PaymentMethodSlice[];
  creditNotes: CreditNoteSlice[];
  geography: GeoSlice[];
  bookingStatus: BookingStatusSlice[];
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

export type ReportEnv = "live" | "test" | "all";

export async function buildPlatformReport(
  range: ReportRange = "12m",
  nowMs: number = Date.now(),
  // Which ledger environment feeds the revenue figures. Default "live" (the real
  // business view); "test"/"all" let the founder see test purchases while building.
  env: ReportEnv = "live",
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
    { data: creditLedgerRows },
    { count: quotesCreated },
    { count: lookingForPosts },
    { count: lookingForResponses },
    { data: geoRows },
    { data: allBookingStatusRows },
  ] = await Promise.all([
    // The product catalog — the REAL price a host pays. A free product (e.g. a
    // beta tier) costs R0 even if it grants a paid plan tier for feature access.
    service.from("products").select("id, name, price, billing_cycle, type"),
    service
      .from("subscriptions")
      .select("product_id, plan, billing_cycle, status"),
    // Revenue rows for the selected environment. Default "live" — test-key
    // transactions are excluded from the real business view, but the founder can
    // flip the Overview to Test/All to see them while building.
    fetchWieloLedger(service, {
      limit: 10_000,
      environment: env === "all" ? undefined : env,
    }),
    service
      .from("user_profiles")
      .select("role, created_at")
      .is("deleted_at", null)
      // Exclude the internal Wielo Support bot so the footprint counts match
      // the Users list (which hides it) — it is not a real guest.
      .or(`email.is.null,email.neq.${WIELO_SUPPORT_EMAIL}`),
    service
      .from("bookings")
      .select("total_amount, status, check_in")
      .in("status", REVENUE_BOOKING_STATUSES),
    service
      .from("properties")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("is_published", true),
    // Credit units moved in the period (grant / purchase / debit / refund).
    service
      .from("wielo_credit_ledger")
      .select("delta, kind, created_at")
      .gte("created_at", periodStart),
    // Platform quote + Looking-For volume in the period.
    service
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", periodStart),
    service
      .from("looking_for_posts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", periodStart),
    service
      .from("looking_for_responses")
      .select("id", { count: "exact", head: true })
      .gte("created_at", periodStart),
    // Geography — published listings by province (all-time distribution).
    service
      .from("properties")
      .select("province")
      .is("deleted_at", null)
      .eq("is_published", true),
    // ALL bookings (every status) for the status-distribution breakdown.
    service.from("bookings").select("status").is("deleted_at", null),
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

  // ── Monthly time series (range-aware) ──
  // The chart used to always show a fixed last-12-months window regardless of
  // the selected range. Now it spans exactly the calendar months the range
  // covers (period start → current month), so 30D/90D/6M/YTD actually move the
  // Revenue + User-growth charts. Clamped to [2, 12] so a line always renders.
  const now = new Date(nowMs);
  const periodStartDate = new Date(periodStart);
  const rawMonthSpan =
    (now.getFullYear() - periodStartDate.getFullYear()) * 12 +
    (now.getMonth() - periodStartDate.getMonth()) +
    1;
  const monthsShown = Math.min(12, Math.max(2, rawMonthSpan));
  const months: MonthlyPoint[] = [];
  const monthIndex = new Map<string, number>();
  for (let i = monthsShown - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthIndex.set(key, months.length);
    months.push({
      month: d.toISOString(),
      label: MONTH_LABELS[d.getMonth()],
      revenue: 0,
      gmv: 0,
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
  // GMV per month — booking value for stays checking in that month.
  for (const b of bookingRows ?? []) {
    if (!b.check_in) continue;
    const idx = monthIndex.get(keyOf(b.check_in as string));
    if (idx != null) months[idx].gmv += Number(b.total_amount ?? 0);
  }

  // One-off sales: EVERY paid product_order (any product), grouped — so a one-off
  // product (e.g. a web-design package) that has no subscription still appears in
  // the Products list with units sold + revenue collected. This list is env-
  // INDEPENDENT (it's the sales catalog); the money KPIs above honour the toggle.
  // Test-only sales are tagged so a test purchase is still visible + labelled.
  const { data: paidOrders } = await service
    .from("product_orders")
    .select("product_id, product_name, amount, environment")
    .eq("status", "paid");
  const oneOffUnits: Record<string, number> = {};
  const oneOffRevenue: Record<string, number> = {};
  const oneOffName: Record<string, string> = {};
  const oneOffLive: Record<string, number> = {};
  for (const o of paidOrders ?? []) {
    const prod = o.product_id ? productById.get(o.product_id as string) : null;
    // Only one-off products here; subscription revenue is the MRR model above.
    if (prod && prod.type === "subscription") continue;
    const key = (o.product_id as string) ?? `name:${o.product_name}`;
    oneOffUnits[key] = (oneOffUnits[key] ?? 0) + 1;
    oneOffRevenue[key] = (oneOffRevenue[key] ?? 0) + Number(o.amount ?? 0);
    if (o.environment !== "test") oneOffLive[key] = (oneOffLive[key] ?? 0) + 1;
    oneOffName[key] =
      (prod?.name as string) ?? (o.product_name as string) ?? "Product";
  }

  const planSlices: PlanSlice[] = (productRows ?? [])
    .filter((p) => (p.type ?? "subscription") === "subscription")
    .map((p) => ({
      key: p.id as string,
      name: p.name as string,
      type: "subscription" as const,
      count: prodCount[p.id as string] ?? 0,
      mrr: Math.round(prodMrr[p.id as string] ?? 0),
    }))
    .filter((p) => p.count > 0);
  // One-off products with sales (env-independent — always shown).
  for (const key of Object.keys(oneOffUnits)) {
    planSlices.push({
      key,
      name: oneOffName[key],
      type: "one_off",
      count: oneOffUnits[key],
      mrr: Math.round(oneOffRevenue[key] ?? 0),
      testOnly: (oneOffLive[key] ?? 0) === 0,
    });
  }
  planSlices.sort((a, b) => b.mrr - a.mrr);
  // Subscriptions not linked to a product (legacy/none) — surface honestly.
  if ((prodCount["none"] ?? 0) > 0) {
    planSlices.push({
      key: "none",
      name: "No product",
      type: "subscription",
      count: prodCount["none"],
      mrr: 0,
    });
  }

  const statusFunnel = Object.entries(statusCount)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Period-scoped collected (charges within the range).
  const periodCharges = wieloRows.filter(
    (r) =>
      r.status === "completed" && r.type === "charge" && r.date >= periodStart,
  );
  const collectedPeriod = periodCharges.reduce((s, r) => s + r.amount, 0);

  // ── Payment-method split (period charges by provider) ──
  const providerAmt: Record<string, number> = {};
  const providerCnt: Record<string, number> = {};
  let vatCollected = 0;
  for (const r of periodCharges) {
    const key = (r.provider ?? "unknown").toLowerCase();
    providerAmt[key] = (providerAmt[key] ?? 0) + r.amount;
    providerCnt[key] = (providerCnt[key] ?? 0) + 1;
    if (r.vatAmount) vatCollected += r.vatAmount;
  }
  const paymentMethods: PaymentMethodSlice[] = Object.keys(providerAmt)
    .map((provider) => ({
      provider,
      amount: Math.round(providerAmt[provider]),
      count: providerCnt[provider],
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Credit-note detail (period refunds / credits / adjustments) ──
  const cnCnt: Record<string, number> = {};
  const cnAmt: Record<string, number> = {};
  for (const r of wieloRows) {
    if (r.status !== "completed" || r.date < periodStart) continue;
    if (r.type !== "refund" && r.type !== "credit" && r.type !== "adjustment")
      continue;
    cnCnt[r.type] = (cnCnt[r.type] ?? 0) + 1;
    cnAmt[r.type] = (cnAmt[r.type] ?? 0) + Math.abs(r.amount);
  }
  const creditNotes: CreditNoteSlice[] = Object.keys(cnCnt)
    .map((kind) => ({
      kind,
      count: cnCnt[kind],
      amount: Math.round(cnAmt[kind]),
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Affiliate liabilities (Wielo → affiliates, period) ──
  let affiliateCommissions = 0;
  let affiliatePayouts = 0;
  for (const r of wieloRows) {
    if (r.status !== "completed" || r.date < periodStart) continue;
    if (r.type === "commission") affiliateCommissions += Math.abs(r.amount);
    else if (r.type === "payout") affiliatePayouts += Math.abs(r.amount);
  }

  // ── Credits (units) moved in the period ──
  let creditsPurchased = 0;
  let creditsGranted = 0;
  let creditsSpent = 0;
  for (const c of creditLedgerRows ?? []) {
    const delta = Number(c.delta ?? 0);
    if (c.kind === "purchase") creditsPurchased += delta;
    else if (c.kind === "grant") creditsGranted += delta;
    else if (c.kind === "debit") creditsSpent += Math.abs(delta);
  }

  // ── Geography — published listings by province ──
  const geoCount: Record<string, number> = {};
  for (const g of geoRows ?? []) {
    const province =
      ((g.province as string) || "Unspecified").trim() || "Unspecified";
    geoCount[province] = (geoCount[province] ?? 0) + 1;
  }
  const geography: GeoSlice[] = Object.keys(geoCount)
    .map((province) => ({ province, listings: geoCount[province] }))
    .sort((a, b) => b.listings - a.listings);

  // ── Take-rate + month-over-month growth ──
  const takeRate = gmv > 0 ? (stats.collected / gmv) * 100 : 0;
  const momOf = (pick: (m: MonthlyPoint) => number): number | null => {
    if (months.length < 2) return null;
    const last = pick(months[months.length - 1]);
    const prev = pick(months[months.length - 2]);
    if (prev === 0) return null;
    return Math.round(((last - prev) / prev) * 1000) / 10;
  };
  const momRevenue = momOf((m) => m.revenue);
  const momSignups = momOf((m) => m.signups);

  // ── Booking-status distribution (every status, all-time) ──
  const bkStatusCount: Record<string, number> = {};
  for (const b of allBookingStatusRows ?? []) {
    const status = (b.status as string) ?? "unknown";
    bkStatusCount[status] = (bkStatusCount[status] ?? 0) + 1;
  }
  const bookingStatus: BookingStatusSlice[] = Object.entries(bkStatusCount)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    range,
    rangeLabel: RANGE_LABEL[range],
    periodStart,
    monthsShown,
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
      vatCollected: Math.round(vatCollected),
      takeRate: Math.round(takeRate * 10) / 10,
      momRevenue,
      momSignups,
      gmv: Math.round(gmv),
      bookingCount,
      activeListings: activeListings ?? 0,
      creditsPurchased,
      creditsGranted,
      creditsSpent,
      quotesCreated: quotesCreated ?? 0,
      lookingForPosts: lookingForPosts ?? 0,
      lookingForResponses: lookingForResponses ?? 0,
      affiliateCommissions: Math.round(affiliateCommissions),
      affiliatePayouts: Math.round(affiliatePayouts),
    },
    monthly: months,
    plans: planSlices,
    statusFunnel,
    paymentMethods,
    creditNotes,
    geography,
    bookingStatus,
  };
}

export function isReportRange(v: string | undefined): v is ReportRange {
  return v === "30d" || v === "90d" || v === "6m" || v === "12m" || v === "ytd";
}

export function isReportEnv(v: string | undefined): v is ReportEnv {
  return v === "live" || v === "test" || v === "all";
}
