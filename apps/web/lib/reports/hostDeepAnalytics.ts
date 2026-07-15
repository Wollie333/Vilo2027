import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

// In-depth booking analytics for the host reports page — everything derivable
// from the host's bookings that the analytics RPCs don't already surface:
// length-of-stay, booking lead time, booking pace, revenue/ADR by month, party
// size, guest new/returning + top guests, and cancellation reasons.
//
// Period-scoped metrics honour the report's [start,end] filter; the GUEST repeat
// analysis is all-time (a guest is "returning" only if they've booked the host
// more than once ever — a period window can't tell you that).

type Admin = ReturnType<typeof createAdminClient>;

const REVENUE_STATUSES = new Set([
  "confirmed",
  "checked_in",
  "checked_out",
  "completed",
]);
const CANCELLED_STATUSES = new Set([
  "cancelled_by_host",
  "cancelled_by_guest",
  "declined",
  "expired",
  "no_show",
]);

export type Bucket = { label: string; count: number };
export type MonthPoint = {
  month: string; // "Jan"
  iso: string; // YYYY-MM
  revenue: number;
  nights: number;
  bookings: number;
  adr: number; // revenue ÷ nights
};

export type HostDeepAnalytics = {
  hasData: boolean;
  lengthOfStay: Bucket[];
  avgNights: number;
  leadTime: Bucket[];
  medianLeadDays: number;
  partySize: Bucket[];
  avgPartySize: number;
  pace: { month: string; iso: string; bookings: number }[];
  revenueByMonth: MonthPoint[];
  guests: {
    total: number;
    newGuests: number;
    returning: number;
    repeatRate: number; // %
    top: { name: string; bookings: number; revenue: number }[];
  };
  cancellations: {
    total: number;
    rate: number; // % of (revenue + cancelled)
    reasons: Bucket[];
    byActor: Bucket[];
  };
};

type BookingRow = {
  status: string;
  check_in: string | null;
  created_at: string;
  nights: number | null;
  total_amount: number | null;
  guests_count: number | null;
  guest_id: string | null;
  guest_name: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
};

const MONTHS = [
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

function monthIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function emptyAnalytics(): HostDeepAnalytics {
  return {
    hasData: false,
    lengthOfStay: [],
    avgNights: 0,
    leadTime: [],
    medianLeadDays: 0,
    partySize: [],
    avgPartySize: 0,
    pace: [],
    revenueByMonth: [],
    guests: { total: 0, newGuests: 0, returning: 0, repeatRate: 0, top: [] },
    cancellations: { total: 0, rate: 0, reasons: [], byActor: [] },
  };
}

export async function loadHostDeepAnalytics(
  admin: Admin,
  hostId: string,
  startDate: string,
  endDate: string,
  // When set, scope to bookings on these properties (the Region filter). An
  // empty array means the region has no listings → no data.
  propertyIds?: string[] | null,
): Promise<HostDeepAnalytics> {
  // All-time bookings for the host (pre-MVP volumes are small). One query powers
  // the all-time guest repeat analysis AND the period-scoped distributions.
  let q = admin
    .from("bookings")
    .select(
      "status, check_in, created_at, nights, total_amount, guests_count, guest_id, guest_name, cancellation_reason, cancelled_by",
    )
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .limit(20000);
  if (propertyIds) q = q.in("property_id", propertyIds);
  const { data, error } = await q;

  if (error || !data || data.length === 0) return emptyAnalytics();
  const rows = data as BookingRow[];

  const inPeriod = (day: string | null): boolean =>
    !!day && day.slice(0, 10) >= startDate && day.slice(0, 10) <= endDate;

  // ── Guest repeat analysis (all-time revenue bookings) ──
  const guestAgg = new Map<
    string,
    { name: string; bookings: number; revenue: number }
  >();
  for (const b of rows) {
    if (!REVENUE_STATUSES.has(b.status) || !b.guest_id) continue;
    const g = guestAgg.get(b.guest_id) ?? {
      name: b.guest_name ?? "Guest",
      bookings: 0,
      revenue: 0,
    };
    g.bookings += 1;
    g.revenue += Number(b.total_amount ?? 0);
    guestAgg.set(b.guest_id, g);
  }
  const guestList = [...guestAgg.values()];
  const returning = guestList.filter((g) => g.bookings > 1).length;
  const totalGuests = guestList.length;
  const topGuests = [...guestList]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((g) => ({
      name: g.name,
      bookings: g.bookings,
      revenue: Math.round(g.revenue),
    }));

  // ── Period-scoped revenue bookings (by check-in) ──
  const losBuckets = { "1": 0, "2": 0, "3": 0, "4-6": 0, "7+": 0 };
  const partyBuckets = { "1": 0, "2": 0, "3-4": 0, "5+": 0 };
  const revByMonth = new Map<string, MonthPoint>();
  let nightsSum = 0;
  let nightsN = 0;
  let partySum = 0;
  let partyN = 0;

  // ── Period-scoped all bookings (by created) for pace + lead time ──
  const paceMap = new Map<string, number>();
  const leadBuckets = {
    "same day": 0,
    "1-7d": 0,
    "8-30d": 0,
    "31-90d": 0,
    "90d+": 0,
  };
  const leadDays: number[] = [];

  // ── Cancellations (period, by created) ──
  const cancelReasons = new Map<string, number>();
  const cancelActors = new Map<string, number>();
  let cancelledCount = 0;
  let periodRevenueCount = 0;

  for (const b of rows) {
    const revenue = Number(b.total_amount ?? 0);

    // Stay-based (check_in in period, revenue status)
    if (REVENUE_STATUSES.has(b.status) && inPeriod(b.check_in)) {
      periodRevenueCount += 1;
      const n = Number(b.nights ?? 0);
      if (n > 0) {
        nightsSum += n;
        nightsN += 1;
        if (n === 1) losBuckets["1"] += 1;
        else if (n === 2) losBuckets["2"] += 1;
        else if (n === 3) losBuckets["3"] += 1;
        else if (n <= 6) losBuckets["4-6"] += 1;
        else losBuckets["7+"] += 1;
      }
      const party = Number(b.guests_count ?? 0);
      if (party > 0) {
        partySum += party;
        partyN += 1;
        if (party === 1) partyBuckets["1"] += 1;
        else if (party === 2) partyBuckets["2"] += 1;
        else if (party <= 4) partyBuckets["3-4"] += 1;
        else partyBuckets["5+"] += 1;
      }
      if (b.check_in) {
        const d = new Date(b.check_in);
        const iso = monthIso(d);
        const pt = revByMonth.get(iso) ?? {
          month: MONTHS[d.getMonth()],
          iso,
          revenue: 0,
          nights: 0,
          bookings: 0,
          adr: 0,
        };
        pt.revenue += revenue;
        pt.nights += n;
        pt.bookings += 1;
        revByMonth.set(iso, pt);
      }
    }

    // Created-based (created_at in period) → pace + lead time
    if (inPeriod(b.created_at)) {
      const d = new Date(b.created_at);
      const iso = monthIso(d);
      paceMap.set(iso, (paceMap.get(iso) ?? 0) + 1);

      if (b.check_in && REVENUE_STATUSES.has(b.status)) {
        const lead = Math.round(
          (new Date(b.check_in).getTime() - d.getTime()) / 86_400_000,
        );
        if (lead >= 0) {
          leadDays.push(lead);
          if (lead === 0) leadBuckets["same day"] += 1;
          else if (lead <= 7) leadBuckets["1-7d"] += 1;
          else if (lead <= 30) leadBuckets["8-30d"] += 1;
          else if (lead <= 90) leadBuckets["31-90d"] += 1;
          else leadBuckets["90d+"] += 1;
        }
      }

      if (CANCELLED_STATUSES.has(b.status)) {
        cancelledCount += 1;
        const reason =
          (b.cancellation_reason ?? "Not specified").trim() || "Not specified";
        cancelReasons.set(reason, (cancelReasons.get(reason) ?? 0) + 1);
        const actor = b.cancelled_by ?? "system";
        cancelActors.set(actor, (cancelActors.get(actor) ?? 0) + 1);
      }
    }
  }

  leadDays.sort((a, b) => a - b);
  const medianLeadDays =
    leadDays.length > 0 ? leadDays[Math.floor(leadDays.length / 2)] : 0;

  const revenueByMonth = [...revByMonth.values()]
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .map((p) => ({
      ...p,
      revenue: Math.round(p.revenue),
      adr: p.nights > 0 ? Math.round(p.revenue / p.nights) : 0,
    }));

  const pace = [...paceMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([iso, bookings]) => ({
      iso,
      month: MONTHS[Number(iso.slice(5, 7)) - 1],
      bookings,
    }));

  const toBuckets = (obj: Record<string, number>): Bucket[] =>
    Object.entries(obj).map(([label, count]) => ({ label, count }));

  const cancelTotalPool = periodRevenueCount + cancelledCount;

  return {
    hasData: periodRevenueCount > 0 || cancelledCount > 0,
    lengthOfStay: toBuckets(losBuckets),
    avgNights: nightsN > 0 ? Math.round((nightsSum / nightsN) * 10) / 10 : 0,
    leadTime: toBuckets(leadBuckets),
    medianLeadDays,
    partySize: toBuckets(partyBuckets),
    avgPartySize: partyN > 0 ? Math.round((partySum / partyN) * 10) / 10 : 0,
    pace,
    revenueByMonth,
    guests: {
      total: totalGuests,
      newGuests: totalGuests - returning,
      returning,
      repeatRate:
        totalGuests > 0 ? Math.round((returning / totalGuests) * 1000) / 10 : 0,
      top: topGuests,
    },
    cancellations: {
      total: cancelledCount,
      rate:
        cancelTotalPool > 0
          ? Math.round((cancelledCount / cancelTotalPool) * 1000) / 10
          : 0,
      reasons: [...cancelReasons.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      byActor: [...cancelActors.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}
