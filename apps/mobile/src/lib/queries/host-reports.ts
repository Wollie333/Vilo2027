import type { HostBooking } from "@/lib/queries/host";

// Read-only reporting derived from the host's bookings (no money mutated). We
// derive client-side rather than calling the untyped analytics RPCs so the
// shape is explicit and testable; revenue uses the same confirmed/checked-in/
// completed set as the Overview KPIs (single rule, not forked).

const REVENUE_STATUSES = new Set(["confirmed", "checked_in", "completed"]);

export type MonthBucket = { key: string; label: string; revenue: number };

export type HostReports = {
  revenue: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  nightsBooked: number;
  byStatus: { status: string; count: number }[];
  monthly: MonthBucket[];
  currency: string;
};

const STATUS_ORDER = [
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Build the report model from the host's bookings, anchored at `now`. */
export function deriveReports(
  bookings: HostBooking[] | undefined,
  now: Date,
): HostReports {
  const list = bookings ?? [];
  const revenueBookings = list.filter((b) => REVENUE_STATUSES.has(b.status));

  // Last 6 month buckets (oldest → newest).
  const buckets: MonthBucket[] = [];
  const index: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    index[key] = buckets.length;
    buckets.push({
      key,
      label: d.toLocaleDateString("en-ZA", { month: "short" }),
      revenue: 0,
    });
  }

  const thisKey = monthKey(now);
  const lastKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  let thisMonthRevenue = 0;
  let lastMonthRevenue = 0;

  for (const b of revenueBookings) {
    const when = new Date(b.check_in ?? b.created_at);
    const key = monthKey(when);
    if (index[key] !== undefined)
      buckets[index[key]].revenue += b.total_amount ?? 0;
    if (key === thisKey) thisMonthRevenue += b.total_amount ?? 0;
    if (key === lastKey) lastMonthRevenue += b.total_amount ?? 0;
  }

  const counts: Record<string, number> = {};
  for (const b of list) counts[b.status] = (counts[b.status] ?? 0) + 1;
  const byStatus = STATUS_ORDER.filter((s) => counts[s]).map((status) => ({
    status,
    count: counts[status],
  }));

  return {
    revenue: revenueBookings.reduce((s, b) => s + (b.total_amount ?? 0), 0),
    thisMonthRevenue,
    lastMonthRevenue,
    nightsBooked: revenueBookings.reduce((s, b) => s + (b.nights ?? 0), 0),
    byStatus,
    monthly: buckets,
    currency: list[0]?.currency ?? "ZAR",
  };
}
