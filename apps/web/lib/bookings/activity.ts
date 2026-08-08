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
  /**
   * Logical rank within a booking's lifecycle — the tie-breaker that keeps the
   * real flow in order when several events share a timestamp (accepting a quote
   * applies the change AND settles the refund/credit in ONE transaction, so they
   * land at the same instant). Lower = earlier in the story. Ordering is
   * primarily by time; seq only decides ties.
   */
  seq: number;
};

// Canonical lifecycle order — the "how it actually happened" sequence used to
// break ties between same-timestamp events (see BookingActivityEvent.seq).
const SEQ = {
  requested: 10,
  confirmed: 20,
  payment: 30,
  changeRequested: 40,
  counter: 45,
  quoteSent: 50,
  addon: 55,
  responseAccepted: 58,
  changeApplied: 60,
  changeDeclined: 62,
  bookingDeclined: 64,
  refundRequested: 66,
  refundApproved: 67,
  creditIssued: 68,
  checkedIn: 80,
  checkedOut: 82,
  cancelled: 90,
  review: 95,
  support: 42,
} as const;

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
  declined_at: string | null;
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
      seq: SEQ.requested,
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
      seq: SEQ.confirmed,
      ...base,
    });
  if (b.checked_in_at)
    out.push({
      id: `bk-in-${b.id}`,
      at: b.checked_in_at,
      kind: "stay",
      title: "Checked in",
      actorKind: "system",
      seq: SEQ.checkedIn,
      ...base,
    });
  if (b.checked_out_at)
    out.push({
      id: `bk-out-${b.id}`,
      at: b.checked_out_at,
      kind: "stay",
      title: "Checked out",
      actorKind: "system",
      seq: SEQ.checkedOut,
      ...base,
    });
  if (b.declined_at)
    out.push({
      id: `bk-declined-${b.id}`,
      at: b.declined_at,
      kind: "booking",
      title: "Booking declined",
      actorKind: "host",
      seq: SEQ.bookingDeclined,
      ...base,
    });
  if (b.cancelled_at)
    out.push({
      id: `bk-cancelled-${b.id}`,
      at: b.cancelled_at,
      kind: "booking",
      title: "Booking cancelled",
      actorKind: "guest",
      seq: SEQ.cancelled,
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
      seq: SEQ.refundRequested,
      ...base,
    },
  ];
  if (
    r.actioned_at &&
    ["approved", "processing", "completed"].includes(r.status)
  )
    out.push({
      id: `rf-ok-${r.id}`,
      // A host-asserted refund is created ALREADY approved, so actioned_at is
      // captured (in JS) a hair BEFORE the DB stamps created_at — which would sort
      // "approved" ahead of "requested". Clamp to created_at so approval can never
      // predate the request (a real-world invariant); a later real approval keeps
      // its own, later time.
      at: r.actioned_at > r.created_at ? r.actioned_at : r.created_at,
      kind: "refund",
      title: "Refund approved",
      actorKind: "host",
      amount: Number(r.approved_amount ?? r.requested_amount),
      currency: cur,
      flow: "out",
      seq: SEQ.refundApproved,
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
      seq: SEQ.refundApproved,
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

type QuotePayload = {
  quoted_total?: number;
  delta?: number;
  settlement?: string;
  currency?: string;
  priced_at?: string;
  check_in?: string;
  check_out?: string;
  guests_count?: number;
  room_ids?: string[];
};

// Human summary of a host quote: the new total plus how the difference resolves.
function quoteContext(quote: QuotePayload): string {
  const cur = quote.currency ?? "ZAR";
  const total = Number(quote.quoted_total ?? 0);
  const delta = Number(quote.delta ?? 0);
  const parts = [`New total ${formatMoney(total, cur)}`];
  if (delta > 0.009) parts.push(`guest pays ${formatMoney(delta, cur)}`);
  else if (delta < -0.009) {
    const s = quote.settlement;
    const label =
      s === "credit" ? "credit" : s === "none" ? "retained" : "refund";
    parts.push(`${label} ${formatMoney(-delta, cur)}`);
  } else parts.push("no price change");
  return parts.join(" · ");
}

function requestEvents(
  q: RequestRow,
  refFor: (id: string) => string | null,
): BookingActivityEvent[] {
  const { noun, kind } = requestLabel(q.type);
  const base = { bookingId: q.booking_id, bookingRef: refFor(q.booking_id) };
  const ctx = requestContext(q.type, q.payload) ?? q.guest_message ?? undefined;

  // A host counter-offer stores the suggested dates in payload.counter — its
  // presence means the guest's response (approve/decline) is the guest's, not
  // the host's, and the applied/rejected dates are the COUNTER dates.
  const p = (q.payload ?? {}) as Record<string, unknown>;
  const counter = (p.counter ?? null) as {
    check_in?: string;
    check_out?: string;
    at?: string;
  } | null;
  const hasCounter = !!(counter && (counter.check_in || counter.check_out));
  const counterCtx = hasCounter
    ? `${fmtDate(counter?.check_in ?? null)} → ${fmtDate(counter?.check_out ?? null)}`
    : undefined;

  // A host price quote stores the confirmed change in payload.quote. Its
  // presence means the guest is the actor on the eventual approve/decline (they
  // accepted/declined the host's quote), and gives us the priced figures to show.
  const quote = (p.quote ?? null) as QuotePayload | null;
  const hasQuote = !!(quote && quote.quoted_total != null);
  const guestResponded = hasCounter || hasQuote;

  const out: BookingActivityEvent[] = [
    {
      id: `br-req-${q.id}`,
      at: q.created_at,
      kind,
      title: q.type === "addon" ? "Add-on added" : `${noun} requested`,
      context: ctx,
      actorKind: "guest",
      seq: q.type === "addon" ? SEQ.addon : SEQ.changeRequested,
      ...base,
    },
  ];
  if (hasCounter)
    out.push({
      id: `br-counter-${q.id}`,
      at: counter?.at ?? q.actioned_at ?? q.created_at,
      kind,
      title: "Alternative dates suggested",
      context: counterCtx,
      actorKind: "host",
      seq: SEQ.counter,
      ...base,
    });
  if (hasQuote)
    out.push({
      id: `br-quote-${q.id}`,
      at: quote?.priced_at ?? q.actioned_at ?? q.created_at,
      kind,
      title: "Quote sent",
      context: quoteContext(quote as QuotePayload),
      actorKind: "host",
      seq: SEQ.quoteSent,
      ...base,
    });
  // The guest's explicit click when they accept a host quote / counter — a
  // distinct action from the change it applies (the "Dates changed" effect
  // below). Only for a guest response; a host-direct approval has no accept step.
  if (q.actioned_at && q.status === "approved" && guestResponded)
    out.push({
      id: `br-accepted-${q.id}`,
      at: q.actioned_at,
      kind,
      title: hasCounter ? "Suggested dates accepted" : "Quote accepted",
      context: hasQuote ? quoteContext(quote as QuotePayload) : counterCtx,
      actorKind: "guest",
      seq: SEQ.responseAccepted,
      ...base,
    });
  if (q.actioned_at && q.status === "approved")
    out.push({
      id: `br-ok-${q.id}`,
      at: q.actioned_at,
      kind,
      title: q.type === "date_change" ? "Dates changed" : `${noun} approved`,
      // Accepting a counter/quote applies it, with the GUEST as the actor.
      context: hasCounter
        ? counterCtx
        : hasQuote
          ? quoteContext(quote as QuotePayload)
          : ctx,
      actorKind: guestResponded ? "guest" : "host",
      seq: SEQ.changeApplied,
      ...base,
    });
  if (q.actioned_at && q.status === "declined")
    out.push({
      id: `br-no-${q.id}`,
      at: q.actioned_at,
      kind,
      title: hasCounter
        ? "Suggested dates declined"
        : hasQuote
          ? "Quote declined"
          : `${noun} declined`,
      context: q.decline_reason ?? undefined,
      actorKind: guestResponded ? "guest" : "host",
      seq: SEQ.changeDeclined,
      ...base,
    });
  return out;
}

// ── Aggregators ─────────────────────────────────────────────────────────────

const BOOKING_COLS =
  "id, reference, currency, created_at, confirmed_at, declined_at, checked_in_at, checked_out_at, cancelled_at";
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
    const countByBooking = new Map<string, number>();
    for (const p of pays ?? []) {
      // EVERY captured payment is its own instance — the deposit, the balance,
      // and any top-up after a booking change ("paid the outstanding amount")
      // each show as a distinct "Payment received" so the money story is complete.
      const n = (countByBooking.get(p.booking_id) ?? 0) + 1;
      countByBooking.set(p.booking_id, n);
      payEvents.push({
        id: `pay-${p.id}`,
        at: p.captured_at as string,
        kind: "payment",
        title: "Payment received",
        // The guest pays the host directly (Model 2 — Wielo takes no cut and is
        // NOT a party to the money), so attribute this to the host, never "Wielo".
        actorKind: "host",
        amount: Number(p.amount),
        currency: (p.currency as string) ?? "ZAR",
        flow: "in",
        bookingId: p.booking_id,
        bookingRef: refFor(p.booking_id),
        seq: SEQ.payment,
      });
    }
  }

  // Guest-added extras (booking_addons, source='guest_added') → "Add-on added".
  const addonEvents: BookingActivityEvent[] = [];
  if (bookingIds.length > 0) {
    const { data: addons } = await admin
      .from("booking_addons")
      .select("id, booking_id, label, subtotal, created_at_tx, source")
      .in("booking_id", bookingIds)
      .eq("source", "guest_added");
    for (const a of addons ?? []) {
      if (!a.created_at_tx) continue;
      addonEvents.push({
        id: `addon-${a.id}`,
        at: a.created_at_tx as string,
        kind: "addon",
        title: "Add-on added",
        context: (a.label as string) ?? undefined,
        actorKind: "guest",
        amount: Number(a.subtotal),
        currency:
          bookings.find((b) => b.id === a.booking_id)?.currency ?? "ZAR",
        bookingId: a.booking_id,
        bookingRef: refFor(a.booking_id),
        seq: SEQ.addon,
      });
    }
  }

  // Store-credit movements tied to a booking (guest_credit_ledger). A reduced
  // booking settled as "credit" inserts a positive grant here — otherwise it's
  // invisible (unlike a refund, which surfaces via refund_requests). Negative
  // rows are credit spent against this booking at checkout.
  const creditEvents: BookingActivityEvent[] = [];
  if (bookingIds.length > 0) {
    const { data: credits } = await admin
      .from("guest_credit_ledger")
      .select("id, booking_id, amount, currency, reason, created_at")
      .in("booking_id", bookingIds);
    for (const c of credits ?? []) {
      const amt = Number(c.amount);
      if (!amt) continue;
      creditEvents.push({
        id: `credit-${c.id}`,
        at: c.created_at as string,
        kind: "refund",
        title: amt > 0 ? "Store credit issued" : "Store credit applied",
        context: (c.reason as string) ?? undefined,
        actorKind: amt > 0 ? "host" : "guest",
        amount: Math.abs(amt),
        currency: (c.currency as string) ?? "ZAR",
        flow: amt > 0 ? "out" : "in",
        bookingId: c.booking_id,
        bookingRef: c.booking_id ? refFor(c.booking_id) : null,
        seq: amt > 0 ? SEQ.creditIssued : SEQ.payment,
      });
    }
  }

  const events: BookingActivityEvent[] = [
    ...bookings.flatMap(bookingLifecycleEvents),
    ...payEvents,
    ...addonEvents,
    ...creditEvents,
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
      seq: SEQ.support,
    })),
    ...reviews.map((rv) => ({
      id: `rev-${rv.id}`,
      at: rv.created_at,
      kind: "review" as const,
      title: rv.rating ? `Review left (${rv.rating}★)` : "Review left",
      actorKind: "guest" as const,
      bookingId: rv.booking_id,
      bookingRef: rv.booking_id ? refFor(rv.booking_id) : null,
      seq: SEQ.review,
    })),
  ];

  // Chronological — the real order things happened (oldest first). We compare at
  // WHOLE-SECOND granularity, then by `seq`: one logical action (accepting a
  // quote applies the change, stamps the request AND writes the refund/credit)
  // fires several DB writes milliseconds apart, and raw-millisecond ordering
  // scrambles them (e.g. "refund approved" landing before "dates changed"). Same
  // second → order by lifecycle rank; genuinely later events keep their place.
  const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
  return events.sort((a, b) => {
    const sa = sec(a.at);
    const sb = sec(b.at);
    if (sa !== sb) return sa - sb;
    return a.seq - b.seq;
  });
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
