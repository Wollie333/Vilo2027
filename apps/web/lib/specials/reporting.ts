import "server-only";

import { createServerClient } from "@/lib/supabase/server";

// Per-special reporting (plan S6). Owner-scoped — every read filters by host_id
// AND special_id, so a host only ever sees their own deal's numbers.
//
// What this measures, and why: a Special is a capacity-capped deal, so the
// honest performance signal is the BOOKING funnel + sell-through against the
// quantity cap (not raw pageviews). Revenue reuses the platform's canonical
// revenue set (confirmed / checked_in / completed) so the panel agrees with the
// ledger and reports. On-site view tracking + view→booking conversion ride on
// the website analytics pipeline and arrive when that cross-surface wiring lands
// (kept out of here so this panel never shows a number it can't stand behind).

/** Booking statuses that count as realised revenue — matches Reports/Ledger. */
const REVENUE_STATUSES = ["confirmed", "checked_in", "completed"] as const;

export type SpecialBookingRow = {
  id: string;
  guestName: string;
  status: string;
  totalAmount: number;
  currency: string;
  checkIn: string | null;
  checkOut: string | null;
  bookedVia: string | null;
  createdAt: string;
};

export type SpecialReport = {
  id: string;
  title: string;
  slug: string;
  status: string;
  currency: string;
  propertyName: string;

  // inventory
  quantity: number;
  redemptionsUsed: number;
  remaining: number;
  sellThroughPct: number; // redemptions ÷ quantity, 0–100

  // pricing / savings (as authored)
  priceMode: "flat" | "per_night";
  flatTotal: number | null;
  perNightPrice: number | null;
  wasPrice: number | null;
  savingsAmount: number | null;
  savingsPct: number | null;

  // booking funnel
  totalBookings: number;
  byStatus: { status: string; count: number }[];
  revenueBookings: number; // # of bookings in the revenue set
  revenue: number; // sum(total_amount) over the revenue set
  recent: SpecialBookingRow[];
};

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/**
 * Load the full reporting picture for one special. Returns null when the special
 * doesn't exist, is soft-deleted, or isn't owned by this host (so the route 404s
 * rather than leaking another host's deal).
 */
export async function loadSpecialReport(
  specialId: string,
  hostId: string,
): Promise<SpecialReport | null> {
  const supabase = createServerClient();

  const { data: special } = await supabase
    .from("specials")
    .select(
      "id, title, slug, status, currency, quantity, redemptions_used, price_mode, flat_total, per_night_price, was_price, savings_amount, savings_pct, property:properties ( name )",
    )
    .eq("id", specialId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!special) return null;

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, guest_name, status, total_amount, currency, check_in, check_out, booked_via, created_at",
    )
    .eq("special_id", specialId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const rows = bookings ?? [];

  const counts = new Map<string, number>();
  let revenue = 0;
  let revenueBookings = 0;
  for (const b of rows) {
    counts.set(b.status, (counts.get(b.status) ?? 0) + 1);
    if ((REVENUE_STATUSES as readonly string[]).includes(b.status)) {
      revenue += Number(b.total_amount);
      revenueBookings += 1;
    }
  }

  const byStatus = Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const prop = (
    Array.isArray(special.property) ? special.property[0] : special.property
  ) as { name: string } | null;

  const quantity = special.quantity;
  const redemptionsUsed = special.redemptions_used;

  return {
    id: special.id,
    title: special.title,
    slug: special.slug,
    status: special.status,
    currency: special.currency,
    propertyName: prop?.name ?? "Property removed",

    quantity,
    redemptionsUsed,
    remaining: Math.max(0, quantity - redemptionsUsed),
    sellThroughPct: pct(redemptionsUsed, quantity),

    priceMode: special.price_mode as "flat" | "per_night",
    flatTotal: special.flat_total == null ? null : Number(special.flat_total),
    perNightPrice:
      special.per_night_price == null ? null : Number(special.per_night_price),
    wasPrice: special.was_price == null ? null : Number(special.was_price),
    savingsAmount:
      special.savings_amount == null ? null : Number(special.savings_amount),
    savingsPct: special.savings_pct,

    totalBookings: rows.length,
    byStatus,
    revenueBookings,
    revenue,
    recent: rows.slice(0, 10).map((b) => ({
      id: b.id,
      guestName: b.guest_name ?? "Guest",
      status: b.status,
      totalAmount: Number(b.total_amount),
      currency: b.currency,
      checkIn: b.check_in,
      checkOut: b.check_out,
      bookedVia: b.booked_via,
      createdAt: b.created_at,
    })),
  };
}
