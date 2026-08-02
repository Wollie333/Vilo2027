import "server-only";

import type { ActivityEvent } from "@/components/admin/ActivityTimeline";
import type {
  TimelineEvent,
  TimelineTone,
} from "@/components/timeline/EventTimeline";
import { formatMoney } from "@/lib/format";
import type { createAdminClient } from "@/lib/supabase/admin";

// ────────────────────────────────────────────────────────────────────────────
// Booking / guest activity aggregator — the ONE humanisation of every host↔guest
// interaction, derived from the canonical tables that already own each fact
// (bookings, payments, refund_requests, booking_requests, support tickets in
// messages, reviews). No separate log table → nothing to keep in sync, and every
// existing + future action shows up automatically. Feeds three surfaces via the
// mappers below:
//   • guest trip timeline           → toTimelineEvents(…, "guest")  → EventTimeline
//   • host booking timeline         → toTimelineEvents(…, "host")   → EventTimeline
//   • host Guest-Record History tab → toActivityEvents(…, "host")   → ActivityTimeline
// ────────────────────────────────────────────────────────────────────────────

type Admin = ReturnType<typeof createAdminClient>;

export type ActivityViewer = "host" | "guest";

export type ActivityKind =
  | "booking"
  | "payment"
  | "refund"
  | "request"
  | "addon"
  | "support"
  | "review"
  | "stay";

export type BookingActivityEvent = {
  id: string;
  at: string;
  kind: ActivityKind;
  /** Neutral, third-person headline, e.g. "Refund requested". */
  title: string;
  /** Extra detail (reason, dates, ticket ref…). */
  context?: string | null;
  actorKind: "guest" | "host" | "system";
  /** Optional money value + direction (money-in green / money-out red). */
  amount?: number;
  currency?: string;
  flow?: "in" | "out";
  /** Booking this event belongs to (for the cross-booking guest history). */
  bookingId?: string | null;
  bookingRef?: string | null;
};

const fmtDate = (iso: string | null): string =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

// ── Humanisers (pure) ───────────────────────────────────────────────────────

type BookingRow = {
  id: string;
  reference: string | null;
  currency: string | null;
  created_at: string;
  confirmed_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  cancelled_at: string | null;
};

function bookingLifecycleEvents(b: BookingRow): BookingActivityEvent[] {
  const base = { bookingId: b.id, bookingRef: b.reference };
  const out: BookingActivityEvent[] = [
    {
      id: `bk-created-${b.id}`,
      at: b.created_at,
      kind: "booking",
      title: "Booking requested",
      actorKind: "guest",
      ...base,
    },
  ];
  if (b.confirmed_at)
    out.push({
      id: `bk-confirmed-${b.id}`,
      at: b.confirmed_at,
      kind: "booking",
      title: "Booking confirmed",
      actorKind: "host",
      ...base,
    });
  if (b.checked_in_at)
    out.push({
      id: `bk-in-${b.id}`,
      at: b.checked_in_at,
      kind: "stay",
      title: "Checked in",
      actorKind: "system",
      ...base,
    });
  if (b.checked_out_at)
    out.push({
      id: `bk-out-${b.id}`,
      at: b.checked_out_at,
      kind: "stay",
      title: "Checked out",
      actorKind: "system",
      ...base,
    });
  if (b.cancelled_at)
    out.push({
      id: `bk-cancelled-${b.id}`,
      at: b.cancelled_at,
      kind: "booking",
      title: "Booking cancelled",
      actorKind: "guest",
      ...base,
    });
  return out;
}

type RefundRow = {
  id: string;
  booking_id: string;
  created_at: string;
  actioned_at: string | null;
  status: string;
  requested_amount: number;
  approved_amount: number | null;
  currency: string | null;
  reason: string | null;
  decline_reason: string | null;
  initiated_by: string | null;
  refund_number: string | null;
};

function refundEvents(
  r: RefundRow,
  refFor: (id: string) => string | null,
): BookingActivityEvent[] {
  const cur = r.currency ?? "ZAR";
  const base = { bookingId: r.booking_id, bookingRef: refFor(r.booking_id) };
  const out: BookingActivityEvent[] = [
    {
      id: `rf-req-${r.id}`,
      at: r.created_at,
      kind: "refund",
      title: "Refund requested",
      context: r.reason ?? undefined,
      actorKind: r.initiated_by === "host" ? "host" : "guest",
      amount: Number(r.requested_amount),
      currency: cur,
      flow: "out",
      ...base,
    },
  ];
  if (
    r.actioned_at &&
    ["approved", "processing", "completed"].includes(r.status)
  )
    out.push({
      id: `rf-ok-${r.id}`,
      at: r.actioned_at,
      kind: "refund",
      title: "Refund approved",
      actorKind: "host",
      amount: Number(r.approved_amount ?? r.requested_amount),
      currency: cur,
      flow: "out",
      ...base,
    });
  if (r.actioned_at && r.status === "declined")
    out.push({
      id: `rf-no-${r.id}`,
      at: r.actioned_at,
      kind: "refund",
      title: "Refund declined",
      context: r.decline_reason ?? undefined,
      actorKind: "host",
      ...base,
    });
  return out;
}

type RequestRow = {
  id: string;
  booking_id: string;
  created_at: string;
  actioned_at: string | null;
  status: string;
  type: string;
  payload: unknown;
  guest_message: string | null;
  decline_reason: string | null;
};

function requestLabel(type: string): { noun: string; kind: ActivityKind } {
  if (type === "guest_change") return { noun: "Guest change", kind: "request" };
  if (type === "addon") return { noun: "Add-on", kind: "addon" };
  return { noun: "Date change", kind: "request" };
}

function requestContext(type: string, payload: unknown): string | undefined {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (type === "date_change") {
    const ci = (p.check_in ?? p.new_check_in) as string | undefined;
    const co = (p.check_out ?? p.new_check_out) as string | undefined;
    if (ci || co) return `${fmtDate(ci ?? null)} → ${fmtDate(co ?? null)}`;
  }
  if (type === "guest_change") {
    const name = (p.full_name ?? p.name ?? p.guest_name) as string | undefined;
    if (name) return `Add ${name}`;
  }
  if (type === "addon") {
    const name = (p.addon_name ?? p.name) as string | undefined;
    if (name) return name;
  }
  return undefined;
}

function requestEvents(
  q: RequestRow,
  refFor: (id: string) => string | null,
): BookingActivityEvent[] {
  const { noun, kind } = requestLabel(q.type);
  const base = { bookingId: q.booking_id, bookingRef: refFor(q.booking_id) };
  const ctx = requestContext(q.type, q.payload) ?? q.guest_message ?? undefined;
  const out: BookingActivityEvent[] = [
    {
      id: `br-req-${q.id}`,
      at: q.created_at,
      kind,
      title: q.type === "addon" ? "Add-on added" : `${noun} requested`,
      context: ctx,
      actorKind: "guest",
      ...base,
    },
  ];
  if (q.actioned_at && q.status === "approved")
    out.push({
      id: `br-ok-${q.id}`,
      at: q.actioned_at,
      kind,
      title: q.type === "date_change" ? "Dates changed" : `${noun} approved`,
      context: ctx,
      actorKind: "host",
      ...base,
    });
  if (q.actioned_at && q.status === "declined")
    out.push({
      id: `br-no-${q.id}`,
      at: q.actioned_at,
      kind,
      title: `${noun} declined`,
      context: q.decline_reason ?? undefined,
      actorKind: "host",
      ...base,
    });
  return out;
}

// ── Aggregators ─────────────────────────────────────────────────────────────

const BOOKING_COLS =
  "id, reference, currency, created_at, confirmed_at, checked_in_at, checked_out_at, cancelled_at";
const REFUND_COLS =
  "id, booking_id, created_at, actioned_at, status, requested_amount, approved_amount, currency, reason, decline_reason, initiated_by, refund_number";
const REQUEST_COLS =
  "id, booking_id, created_at, actioned_at, status, type, payload, guest_message, decline_reason";

async function assembleEvents(
  admin: Admin,
  bookings: BookingRow[],
  refunds: RefundRow[],
  requests: RequestRow[],
  supportTickets: {
    id: string;
    booking_id: string | null;
    created_at: string;
    body: string | null;
  }[],
  reviews: {
    id: string;
    booking_id: string | null;
    created_at: string;
    rating: number | null;
  }[],
): Promise<BookingActivityEvent[]> {
  const refByBooking = new Map(bookings.map((b) => [b.id, b.reference]));
  const refFor = (id: string) => refByBooking.get(id) ?? null;

  // First captured payment per booking → "Payment received".
  const bookingIds = bookings.map((b) => b.id);
  const payEvents: BookingActivityEvent[] = [];
  if (bookingIds.length > 0) {
    const { data: pays } = await admin
      .from("payments")
      .select("id, booking_id, amount, currency, captured_at, status")
      .in("booking_id", bookingIds)
      .in("status", ["completed", "partially_refunded", "refunded"])
      .not("captured_at", "is", null)
      .order("captured_at", { ascending: true });
    const seen = new Set<string>();
    for (const p of pays ?? []) {
      if (seen.has(p.booking_id)) continue; // first capture only
      seen.add(p.booking_id);
      payEvents.push({
        id: `pay-${p.id}`,
        at: p.captured_at as string,
        kind: "payment",
        title: "Payment received",
        actorKind: "system",
        amount: Number(p.amount),
        currency: (p.currency as string) ?? "ZAR",
        flow: "in",
        bookingId: p.booking_id,
        bookingRef: refFor(p.booking_id),
      });
    }
  }

  const events: BookingActivityEvent[] = [
    ...bookings.flatMap(bookingLifecycleEvents),
    ...payEvents,
    ...refunds.flatMap((r) => refundEvents(r, refFor)),
    ...requests.flatMap((q) => requestEvents(q, refFor)),
    ...supportTickets.map((m) => ({
      id: `sup-${m.id}`,
      at: m.created_at,
      kind: "support" as const,
      title: "Contacted Wielo Support",
      context:
        (m.body ?? "")
          .split("\n")[0]
          ?.replace(/^[^\w]+/, "")
          .trim() || undefined,
      actorKind: "guest" as const,
      bookingId: m.booking_id,
      bookingRef: m.booking_id ? refFor(m.booking_id) : null,
    })),
    ...reviews.map((rv) => ({
      id: `rev-${rv.id}`,
      at: rv.created_at,
      kind: "review" as const,
      title: rv.rating ? `Review left (${rv.rating}★)` : "Review left",
      actorKind: "guest" as const,
      bookingId: rv.booking_id,
      bookingRef: rv.booking_id ? refFor(rv.booking_id) : null,
    })),
  ];

  return events.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

/** Activity for ONE booking (guest trip timeline + host booking timeline). */
export async function buildBookingActivity(
  admin: Admin,
  bookingId: string,
): Promise<BookingActivityEvent[]> {
  const [
    { data: booking },
    { data: refunds },
    { data: requests },
    { data: tickets },
    { data: reviews },
  ] = await Promise.all([
    admin
      .from("bookings")
      .select(BOOKING_COLS)
      .eq("id", bookingId)
      .maybeSingle(),
    admin
      .from("refund_requests")
      .select(REFUND_COLS)
      .eq("booking_id", bookingId)
      .is("deleted_at", null),
    admin
      .from("booking_requests")
      .select(REQUEST_COLS)
      .eq("booking_id", bookingId)
      .is("deleted_at", null),
    admin
      .from("messages")
      .select("id, booking_id, created_at, body")
      .eq("booking_id", bookingId)
      .eq("system_event", "support_ticket"),
    admin
      .from("reviews")
      .select("id, booking_id, created_at, rating")
      .eq("booking_id", bookingId)
      .is("deleted_at", null),
  ]);
  if (!booking) return [];
  return assembleEvents(
    admin,
    [booking as BookingRow],
    (refunds as RefundRow[]) ?? [],
    (requests as RequestRow[]) ?? [],
    tickets ?? [],
    reviews ?? [],
  );
}

/** Activity across EVERY booking between a host and a guest (Guest-Record History). */
export async function buildHostGuestActivity(
  admin: Admin,
  hostId: string,
  guestId: string,
): Promise<BookingActivityEvent[]> {
  const { data: bookings } = await admin
    .from("bookings")
    .select(BOOKING_COLS)
    .eq("host_id", hostId)
    .eq("guest_id", guestId)
    .is("deleted_at", null);
  const bkList = (bookings as BookingRow[]) ?? [];
  const bookingIds = bkList.map((b) => b.id);

  const [
    { data: refunds },
    { data: requests },
    { data: tickets },
    { data: reviews },
  ] = await Promise.all([
    admin
      .from("refund_requests")
      .select(REFUND_COLS)
      .eq("host_id", hostId)
      .eq("guest_id", guestId)
      .is("deleted_at", null),
    admin
      .from("booking_requests")
      .select(REQUEST_COLS)
      .eq("host_id", hostId)
      .eq("guest_id", guestId)
      .is("deleted_at", null),
    bookingIds.length > 0
      ? admin
          .from("messages")
          .select("id, booking_id, created_at, body")
          .in("booking_id", bookingIds)
          .eq("system_event", "support_ticket")
      : Promise.resolve({ data: [] as never[] }),
    bookingIds.length > 0
      ? admin
          .from("reviews")
          .select("id, booking_id, created_at, rating")
          .in("booking_id", bookingIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  return assembleEvents(
    admin,
    bkList,
    (refunds as RefundRow[]) ?? [],
    (requests as RequestRow[]) ?? [],
    tickets ?? [],
    reviews ?? [],
  );
}

// ── Mappers to the shared UI components ──────────────────────────────────────

const KIND_TONE: Record<ActivityKind, TimelineTone> = {
  booking: "green",
  payment: "green",
  refund: "red",
  request: "amber",
  addon: "violet",
  support: "amber",
  review: "amber",
  stay: "blue",
};

function actorLabel(
  actorKind: BookingActivityEvent["actorKind"],
  viewer: ActivityViewer,
): string {
  if (actorKind === "system") return "Wielo";
  if (actorKind === "guest") return viewer === "guest" ? "You" : "Guest";
  return viewer === "host" ? "You" : "Host";
}

/** For the rail timelines (EventTimeline) on the trip + booking detail pages. */
export function toTimelineEvents(
  events: BookingActivityEvent[],
  viewer: ActivityViewer,
): TimelineEvent[] {
  return events.map((e) => ({
    at: e.at,
    title: e.title,
    kind:
      e.kind === "stay" ? "Stay" : e.kind[0].toUpperCase() + e.kind.slice(1),
    tone: KIND_TONE[e.kind],
    amount: e.amount,
    currency: e.currency,
    flow: e.flow,
    meta: [actorLabel(e.actorKind, viewer), e.context]
      .filter(Boolean)
      .join(" · "),
  }));
}

const KIND_CATEGORY: Record<ActivityKind, ActivityEvent["category"]> = {
  booking: "booking",
  payment: "finance",
  refund: "finance",
  request: "booking",
  addon: "booking",
  support: "support",
  review: "review",
  stay: "booking",
};

/** For the host Guest-Record History tab (ActivityTimeline). */
export function toActivityEvents(
  events: BookingActivityEvent[],
  viewer: ActivityViewer,
): ActivityEvent[] {
  return events.map((e) => {
    const money =
      typeof e.amount === "number"
        ? `${e.flow === "out" ? "−" : e.flow === "in" ? "+" : ""}${formatMoney(
            Math.abs(e.amount),
            e.currency ?? "ZAR",
          )}`
        : null;
    return {
      id: e.id,
      category: KIND_CATEGORY[e.kind],
      title: e.title,
      actor: actorLabel(e.actorKind, viewer),
      actorKind:
        e.actorKind === "guest"
          ? "user"
          : e.actorKind === "host"
            ? "host"
            : "system",
      context:
        [e.bookingRef, e.context, money].filter(Boolean).join(" · ") || null,
      at: e.at,
    };
  });
}
