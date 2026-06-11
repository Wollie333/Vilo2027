/**
 * The guest record's "What to do" banner — single source of truth.
 *
 * `resolveGuestNextAction` is the ONE place that decides the single most
 * important next move for a guest, given where they sit in the lifecycle
 * (quote → booking → payment → stay → review → win-back). It is a pure
 * function: no IO, no queries, no money maths of its own. The caller passes
 * data it has ALREADY loaded (bookings, quotes, the canonical ledger-derived
 * balance, unread count, review eligibility) and gets back one `NextAction`.
 *
 * The banner is a signpost, never a new feature: every CTA deep-links to a flow
 * that already exists — the quote record, the booking record (where the
 * existing PaymentLinkCard lives), the messages tab, the reviews tab, or the
 * new-booking form.
 *
 * Copy is co-located here as plain English to match the (not-yet-i18n-migrated)
 * guest dashboard. When the dashboard i18n pass reaches this page, swap these
 * strings for keys without touching the decision ladder.
 */

export type NextActionTone = "green" | "sky" | "amber" | "neutral";

export type NextActionCta =
  | { kind: "route"; href: string; label: string; icon: NextActionIcon }
  | { kind: "tab"; tab: string; label: string; icon: NextActionIcon }
  // Opens a finance action modal on the record (fast in-place action) targeting
  // a specific booking — currently used for "send payment request".
  | {
      kind: "modal";
      modal: "payment";
      bookingId: string;
      label: string;
      icon: NextActionIcon;
    };

/** Curated icon keys the banner knows how to render (lucide-backed). */
export type NextActionIcon =
  | "check-circle"
  | "file-text"
  | "credit-card"
  | "message-square"
  | "bed-double"
  | "calendar-clock"
  | "star"
  | "calendar-plus"
  | "arrow-right"
  | "corner-up-left"
  | "send"
  | "plus";

export type NextAction = {
  /** Stable situation key — used for tests and analytics, never shown. */
  key:
    | "quote_accepted"
    | "quote_requested"
    | "payment_due"
    | "needs_reply"
    | "in_house"
    | "pre_arrival"
    | "request_review"
    | "no_upcoming";
  tone: NextActionTone;
  /** Icon shown in the banner's leading disc. */
  icon: NextActionIcon;
  headline: string;
  body: string;
  cta: NextActionCta | null;
};

// Minimal structural inputs — kept local so the resolver is self-contained and
// unit-testable without importing the (client) record component.
export type NextActionBooking = {
  id: string;
  status: string;
  checkIn: string | null;
  balanceDue: number;
  listingName: string;
};

export type NextActionQuote = {
  id: string;
  status: string;
};

export type GuestNextActionInput = {
  firstName: string;
  bookings: NextActionBooking[];
  quotes: NextActionQuote[];
  /** conversations.unread_host — messages from the guest the host hasn't read. */
  unreadFromGuest: number;
  /** Count of completed stays still eligible for a review request. */
  requestableCount: number;
  isInhouse: boolean;
  nextStay: string | null;
  nextStayInDays: number | null;
  lastStay: string | null;
  /** Pre-built /dashboard/bookings/new href with this guest pre-filled. */
  newBookingHref: string;
};

// Bookings in any of these states are off the table for "what to do".
const CANCELLED_STATUSES = new Set([
  "cancelled_by_host",
  "cancelled_by_guest",
  "declined",
  "expired",
  "no_show",
]);

/** Smallest meaningful Rand amount — guards against floating-point dust. */
const MONEY_EPSILON = 0.005;

/**
 * The live, non-cancelled booking that still owes money, soonest stay first.
 * (Captures pending-unpaid AND confirmed-but-partial — both want a payment
 * nudge before arrival.)
 */
function pickUnpaidBooking(
  bookings: NextActionBooking[],
): NextActionBooking | null {
  const owing = bookings.filter(
    (b) => !CANCELLED_STATUSES.has(b.status) && b.balanceDue > MONEY_EPSILON,
  );
  if (owing.length === 0) return null;
  return [...owing].sort((a, b) => {
    const ka = a.checkIn ?? "9999-12-31";
    const kb = b.checkIn ?? "9999-12-31";
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  })[0];
}

export function resolveGuestNextAction(
  input: GuestNextActionInput,
): NextAction {
  const name = input.firstName.trim() || "this guest";

  // 1 ─ Accepted quote → create the booking (money is one step from captured).
  const accepted = input.quotes.find((q) => q.status === "accepted");
  if (accepted) {
    return {
      key: "quote_accepted",
      tone: "green",
      icon: "check-circle",
      headline: `${name} accepted your quote`,
      body: "Turn it into a booking, set the deposit or full amount, and send the payment card.",
      cta: {
        kind: "route",
        href: `/dashboard/quotes/${accepted.id}`,
        label: "Create the booking",
        icon: "arrow-right",
      },
    };
  }

  // 2 ─ Draft / requested quote → price it and send (guest is waiting).
  const draft = input.quotes.find((q) => q.status === "draft");
  if (draft) {
    return {
      key: "quote_requested",
      tone: "amber",
      icon: "file-text",
      headline: `${name} is waiting on a quote`,
      body: `Price the stay, add anything extra, and send it so ${name} can accept and pay.`,
      cta: {
        kind: "route",
        href: `/dashboard/quotes/${draft.id}`,
        label: "Respond to quote",
        icon: "arrow-right",
      },
    };
  }

  // 3 ─ Booking made but not paid → send the payment request.
  const unpaid = pickUnpaidBooking(input.bookings);
  if (unpaid) {
    return {
      key: "payment_due",
      tone: "amber",
      icon: "credit-card",
      headline: `${name}'s booking isn't paid yet`,
      body: `${unpaid.listingName} still has a balance owing. Send the pay link or record a payment.`,
      cta: {
        kind: "modal",
        modal: "payment",
        bookingId: unpaid.id,
        label: "Send payment request",
        icon: "arrow-right",
      },
    };
  }

  // 4 ─ Unread guest message → reply.
  if (input.unreadFromGuest > 0) {
    return {
      key: "needs_reply",
      tone: "sky",
      icon: "message-square",
      headline: `${name} is waiting on your reply`,
      body:
        input.unreadFromGuest === 1
          ? `You have 1 unread message from ${name}.`
          : `You have ${input.unreadFromGuest} unread messages from ${name}.`,
      cta: {
        kind: "tab",
        tab: "messages",
        label: "Reply now",
        icon: "corner-up-left",
      },
    };
  }

  // 5 ─ Staying right now → a mid-stay check-in.
  if (input.isInhouse) {
    const inhouse = input.bookings.find((b) => b.status === "checked_in");
    return {
      key: "in_house",
      tone: "sky",
      icon: "bed-double",
      headline: `${name} is staying right now`,
      body: "A quick mid-stay message is a nice touch and heads off any issues before check-out.",
      cta: inhouse
        ? {
            kind: "route",
            href: `/dashboard/bookings/${inhouse.id}`,
            label: "Open booking",
            icon: "arrow-right",
          }
        : {
            kind: "tab",
            tab: "messages",
            label: "Message guest",
            icon: "message-square",
          },
    };
  }

  // 6 ─ Confirmed stay coming up → send pre-arrival details.
  if (
    input.nextStay &&
    input.nextStayInDays !== null &&
    input.nextStayInDays >= 0
  ) {
    const upcoming = input.bookings.find(
      (b) =>
        b.checkIn === input.nextStay &&
        (b.status === "confirmed" || b.status === "checked_in"),
    );
    const when =
      input.nextStayInDays === 0
        ? "today"
        : input.nextStayInDays === 1
          ? "tomorrow"
          : `in ${input.nextStayInDays} days`;
    return {
      key: "pre_arrival",
      tone: "green",
      icon: "calendar-clock",
      headline: `${name} arrives ${when}`,
      body: "Send check-in details and a warm welcome so arrival is smooth.",
      cta: upcoming
        ? {
            kind: "route",
            href: `/dashboard/bookings/${upcoming.id}`,
            label: "Open booking",
            icon: "arrow-right",
          }
        : {
            kind: "tab",
            tab: "messages",
            label: "Send check-in info",
            icon: "send",
          },
    };
  }

  // 7 ─ Completed stay not yet reviewed → ask for a review.
  if (input.requestableCount > 0) {
    return {
      key: "request_review",
      tone: "green",
      icon: "star",
      headline: `Ask ${name} for a review`,
      body: "There's a completed stay you haven't asked them to review yet — a quick request builds your social proof.",
      cta: {
        kind: "tab",
        tab: "reviews",
        label: "Request a review",
        icon: "star",
      },
    };
  }

  // 8 ─ Nothing pending → a calm relationship nudge.
  return {
    key: "no_upcoming",
    tone: "neutral",
    icon: "calendar-plus",
    headline: input.lastStay ? "No upcoming stay booked" : "No bookings yet",
    body: input.lastStay
      ? `${name} last stayed with you a while ago. A quick note or a returning-guest offer is a great way to win their next trip.`
      : `Start ${name} off with their first booking whenever you're ready.`,
    cta: {
      kind: "route",
      href: input.newBookingHref,
      label: "Create a booking",
      icon: "plus",
    },
  };
}
