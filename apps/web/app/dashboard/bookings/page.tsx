import type { Metadata } from "next";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

import { BookingsBoard, type BookingRow, type Kpis } from "./BookingsBoard";

export const metadata: Metadata = {
  title: "Bookings",
};

export const dynamic = "force-dynamic";

const CANCELLED = new Set([
  "cancelled_by_host",
  "cancelled_by_guest",
  "declined",
  "expired",
  "no_show",
]);
const REVENUE = new Set(["confirmed", "checked_in", "completed"]);
const PENDING = new Set(["pending", "pending_eft", "pending_eft_review"]);

const DAY = 86_400_000;

function jhbToday(): string {
  // YYYY-MM-DD in the host's timezone, so "today" matches their wall clock.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
  }).format(new Date());
}
function dts(s: string): number {
  const base = s.length <= 10 ? `${s}T12:00:00Z` : s;
  return new Date(base).getTime();
}

// Nested shapes returned by the Supabase join.
type RawListing = {
  id: string;
  name: string;
  listing_photos: { url: string; sort_order: number }[] | null;
};
type RawGuest = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
} | null;
type RawBooking = {
  id: string;
  reference: string;
  status: string;
  payment_status: string;
  scope: string;
  origin: string;
  channel: string | null;
  guest_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  guests_count: number;
  guests_breakdown: Record<string, unknown> | null;
  total_amount: number;
  currency: string;
  created_at: string;
  listing: RawListing;
  guest: RawGuest;
};

export default async function BookingsListPage() {
  const supabase = createServerClient();

  // Scope strictly to the signed-in user's own host. RLS alone is NOT enough
  // here: the same user can be a *guest* on another host's booking (and the
  // guest-read RLS policy returns those rows), so an unscoped list would leak
  // other hosts' bookings onto this host's board. Filter by host_id explicitly,
  // exactly like the booking detail page does.
  const myHostId = await getMyHostId(supabase);

  // The listing count (occupancy denominator + toolbar label) and the
  // bookings list both depend only on myHostId, so fetch them together
  // instead of paying two sequential roundtrips.
  const [{ count: listingCountRaw }, { data }] = myHostId
    ? await Promise.all([
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("host_id", myHostId),
        supabase
          .from("bookings")
          .select(
            "id, reference, status, payment_status, scope, origin, channel, guest_id, guest_name, guest_email, guest_phone, check_in, check_out, nights, guests_count, guests_breakdown, total_amount, currency, created_at, listing:listings!inner ( id, name, listing_photos ( url, sort_order ) ), guest:user_profiles!bookings_guest_id_fkey ( full_name, email, phone, avatar_url )",
          )
          .eq("host_id", myHostId)
          .order("created_at", { ascending: false })
          .limit(400),
      ])
    : [{ count: 0 }, { data: [] }];
  const listingCount = listingCountRaw ?? 0;

  const raw = (data ?? []) as unknown as RawBooking[];

  // Per-guest stay index (1-based) — count bookings oldest → newest.
  const stayCounter = new Map<string, number>();
  const stayIndex = new Map<string, number>();
  for (const b of [...raw].reverse()) {
    const key = b.guest_id ?? b.guest_email ?? b.guest_name ?? b.id;
    const n = (stayCounter.get(key) ?? 0) + 1;
    stayCounter.set(key, n);
    stayIndex.set(b.id, n);
  }

  const rows: BookingRow[] = raw.map((b) => {
    const photos = b.listing.listing_photos ?? [];
    const thumb =
      photos.length > 0
        ? [...photos].sort((a, c) => a.sort_order - c.sort_order)[0].url
        : null;
    const guestName =
      b.guest?.full_name ||
      b.guest_name ||
      b.guest?.email ||
      b.guest_email ||
      "Guest";
    const gb = b.guests_breakdown ?? null;
    const numOf = (v: unknown) => (typeof v === "number" ? v : 0);
    return {
      id: b.id,
      reference: b.reference,
      status: b.status,
      paymentStatus: b.payment_status,
      origin: b.origin,
      channel: b.channel,
      scope: b.scope,
      guestName,
      guestEmail: b.guest?.email ?? b.guest_email ?? null,
      guestPhone: b.guest?.phone ?? b.guest_phone ?? null,
      guestAvatar: b.guest?.avatar_url ?? null,
      stayIndex: stayIndex.get(b.id) ?? 1,
      listingName: b.listing.name,
      listingThumb: thumb,
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights: b.nights,
      guestsCount: b.guests_count,
      adults: numOf(gb?.adults),
      children: numOf(gb?.children),
      infants: numOf(gb?.infants),
      totalAmount: Number(b.total_amount),
      currency: b.currency,
      createdAt: b.created_at,
    };
  });

  const kpis = computeKpis(rows, listingCount);

  return (
    <BookingsBoard
      rows={rows}
      kpis={kpis}
      todayStr={jhbToday()}
      listingCount={listingCount}
    />
  );
}

// ── KPI math (all derived from real bookings) ───────────────────────
function computeKpis(rows: BookingRow[], listingCount: number): Kpis {
  const todayStr = jhbToday();
  const today = dts(todayStr);
  const currency = rows[0]?.currency ?? "ZAR";

  const [y, m, d] = todayStr.split("-").map(Number);
  const curMonth = `${y}-${String(m).padStart(2, "0")}`;
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const prevMonth = `${prevY}-${String(prevM).padStart(2, "0")}`;
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-ZA", {
    month: "long",
  });

  // The date a booking "belongs to" for revenue/volume.
  const anchorOf = (r: BookingRow): string =>
    r.checkIn ?? r.createdAt.slice(0, 10);

  // ── Revenue ──
  const revSpark = new Array(d).fill(0) as number[];
  let revTotal = 0;
  let revPrev = 0;
  for (const r of rows) {
    if (CANCELLED.has(r.status)) continue;
    const a = anchorOf(r);
    const month = a.slice(0, 7);
    const day = Number(a.slice(8, 10));
    if (month === curMonth) {
      revTotal += r.totalAmount;
      if (day >= 1 && day <= d) revSpark[day - 1] += r.totalAmount;
    } else if (month === prevMonth && day <= d) {
      revPrev += r.totalAmount;
    }
  }
  const revDelta =
    revPrev > 0 ? Math.round(((revTotal - revPrev) / revPrev) * 100) : null;

  // ── New bookings (by created_at) ──
  const barCount = new Array(d).fill(0) as number[];
  let bkTotal = 0;
  let bkConfirmed = 0;
  let bkPending = 0;
  let bkCancelled = 0;
  let bkPrev = 0;
  for (const r of rows) {
    const c = r.createdAt.slice(0, 10);
    const month = c.slice(0, 7);
    const day = Number(c.slice(8, 10));
    if (month === curMonth) {
      bkTotal += 1;
      if (day >= 1 && day <= d) barCount[day - 1] += 1;
      if (REVENUE.has(r.status)) bkConfirmed += 1;
      else if (PENDING.has(r.status)) bkPending += 1;
      else if (CANCELLED.has(r.status)) bkCancelled += 1;
    } else if (month === prevMonth && day <= d) {
      bkPrev += 1;
    }
  }
  // Compress the daily bar series to at most 14 buckets for a tidy mini-chart.
  const bars = compress(barCount, 14);

  // ── Occupancy (next 30 days, accommodation only) ──
  const winStart = today;
  const winEnd = today + 30 * DAY;
  const prevStart = today - 30 * DAY;
  const overlapNights = (
    ciStr: string,
    coStr: string,
    s: number,
    e: number,
  ): number => {
    const ci = Math.max(dts(ciStr), s);
    const co = Math.min(dts(coStr), e);
    return Math.max(0, Math.round((co - ci) / DAY));
  };
  let bookedNights = 0;
  let prevNights = 0;
  for (const r of rows) {
    if (CANCELLED.has(r.status)) continue;
    if (!r.checkIn || !r.checkOut) continue;
    bookedNights += overlapNights(r.checkIn, r.checkOut, winStart, winEnd);
    prevNights += overlapNights(r.checkIn, r.checkOut, prevStart, winStart);
  }
  const totalNights = Math.max(listingCount, 0) * 30;
  const occPct =
    totalNights > 0
      ? Math.min(100, Math.round((bookedNights / totalNights) * 100))
      : 0;
  const prevPct =
    totalNights > 0
      ? Math.min(100, Math.round((prevNights / totalNights) * 100))
      : 0;
  const occDelta = totalNights > 0 ? occPct - prevPct : null;

  // ── ADR + lead time (accommodation, non-cancelled, with nights) ──
  let adrAmount = 0;
  let adrNights = 0;
  let stayCount = 0;
  let leadSum = 0;
  let leadCount = 0;
  const perListing = new Map<
    string,
    { amount: number; nights: number; count: number }
  >();
  for (const r of rows) {
    if (CANCELLED.has(r.status)) continue;
    const n = r.nights ?? 0;
    if (n <= 0) continue;
    adrAmount += r.totalAmount;
    adrNights += n;
    stayCount += 1;
    const agg = perListing.get(r.listingName) ?? {
      amount: 0,
      nights: 0,
      count: 0,
    };
    agg.amount += r.totalAmount;
    agg.nights += n;
    agg.count += 1;
    perListing.set(r.listingName, agg);
    if (r.checkIn) {
      const lead = Math.round(
        (dts(r.checkIn) - dts(r.createdAt.slice(0, 10))) / DAY,
      );
      if (lead >= 0) {
        leadSum += lead;
        leadCount += 1;
      }
    }
  }
  const adrValue = adrNights > 0 ? Math.round(adrAmount / adrNights) : 0;
  const avgNights =
    stayCount > 0 ? Math.round((adrNights / stayCount) * 10) / 10 : 0;
  const leadDays = leadCount > 0 ? Math.round(leadSum / leadCount) : 0;
  const perListingArr = [...perListing.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([name, v]) => ({
      name,
      adr: v.nights > 0 ? Math.round(v.amount / v.nights) : 0,
    }));

  return {
    monthLabel,
    currency,
    revenue: {
      total: revTotal,
      prevTotal: revPrev,
      deltaPct: revDelta,
      spark: revSpark,
    },
    bookings: {
      total: bkTotal,
      confirmed: bkConfirmed,
      pending: bkPending,
      cancelled: bkCancelled,
      delta: bkTotal - bkPrev,
      bars,
    },
    occupancy: { pct: occPct, bookedNights, totalNights, deltaPp: occDelta },
    adr: { value: adrValue, avgNights, leadDays, perListing: perListingArr },
  };
}

// Average-bucket a series down to at most `target` columns.
function compress(series: number[], target: number): number[] {
  if (series.length <= target) return series;
  const size = Math.ceil(series.length / target);
  const out: number[] = [];
  for (let i = 0; i < series.length; i += size) {
    const slice = series.slice(i, i + size);
    out.push(slice.reduce((s, v) => s + v, 0));
  }
  return out;
}
