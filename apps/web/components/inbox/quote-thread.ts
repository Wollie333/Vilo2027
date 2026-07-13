import type {
  QuoteCardKind,
  ThreadBooking,
  ThreadQuote,
} from "./ThreadQuoteCard";

// Shared plumbing for rendering quotes inside conversation threads, used by both
// the host inbox and the guest portal so the column list, the row→view-model
// mapping, and the "one card per quote" rule live in exactly one place.

// Columns a thread needs to render a quote card. Keep in sync with ThreadQuote.
export const QUOTE_CARD_COLUMNS =
  "id, quote_number, status, currency, total_amount, check_in, check_out, headcount, scope, deposit_type, deposit_amount, balance_amount, valid_until, accept_token, converted_booking_id, property_id";

// Columns to render the booking half of the card (once a quote is accepted).
export const BOOKING_CARD_COLUMNS =
  "id, reference, status, payment_status, payment_method, total_amount, deposit_amount, balance_due, currency";

type QuoteRow = {
  id: string;
  quote_number: string | null;
  status: string;
  currency: string;
  total_amount: string | number | null;
  check_in: string | null;
  check_out: string | null;
  headcount: number | null;
  scope: string | null;
  deposit_type: string | null;
  deposit_amount: string | number | null;
  balance_amount: string | number | null;
  valid_until: string | null;
  accept_token: string | null;
  converted_booking_id: string | null;
  property_id?: string | null;
};

/** Cover image + label for the room/listing a quote is for. */
export type QuoteSubject = {
  name?: string | null;
  image?: string | null;
  detail?: string | null;
};

type BookingRow = {
  id: string;
  reference: string;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  total_amount: string | number | null;
  deposit_amount: string | number | null;
  balance_due: string | number | null;
  currency: string;
};

const num = (v: string | number | null): number | null =>
  v == null ? null : Number(v);

export function mapQuoteRow(
  q: QuoteRow,
  seen?: { count: number; last: string | null },
  subject?: QuoteSubject,
): ThreadQuote {
  return {
    id: q.id,
    quoteNumber: q.quote_number,
    status: q.status,
    currency: q.currency,
    total: Number(q.total_amount ?? 0),
    checkIn: q.check_in,
    checkOut: q.check_out,
    headcount: q.headcount,
    scope: q.scope,
    depositType: q.deposit_type,
    depositAmount: num(q.deposit_amount),
    balanceAmount: num(q.balance_amount),
    validUntil: q.valid_until,
    acceptToken: q.accept_token,
    convertedBookingId: q.converted_booking_id,
    viewCount: seen?.count ?? 0,
    lastViewedAt: seen?.last ?? null,
    subjectName: subject?.name ?? null,
    subjectImage: subject?.image ?? null,
    subjectDetail: subject?.detail ?? null,
  };
}

export function mapBookingRow(b: BookingRow): ThreadBooking {
  return {
    id: b.id,
    reference: b.reference,
    status: b.status,
    paymentStatus: b.payment_status,
    paymentMethod: b.payment_method,
    total: Number(b.total_amount ?? 0),
    depositAmount: num(b.deposit_amount),
    balanceDue: num(b.balance_due),
    currency: b.currency,
  };
}

// Which kind of quote card a system message renders — or null if it isn't a
// quote-lifecycle event (a plain reply). The thread is event-sourced: each
// transition is its own message, so each renders its own immutable card.
export function quoteCardKind(
  systemEvent: string | null,
): QuoteCardKind | null {
  switch (systemEvent) {
    case "quote_draft":
    case "quote_request":
      return "request";
    case "quote_sent":
    case "quote_revised":
      return "issued";
    case "quote_accepted":
      return "accepted";
    case "quote_declined":
      return "declined";
    case "quote_converted":
      return "converted";
    default:
      return null;
  }
}

// Per quote, the highest issued (sent/revised) version present in the thread —
// the only issued card still live; any earlier issued card is superseded.
// Legacy cards with no version pin count as version 1.
export function latestIssuedVersionByQuote(
  messages: {
    systemEvent: string | null;
    quoteId: string | null;
    quoteVersionNo?: number | null;
  }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) {
    if (!m.quoteId || quoteCardKind(m.systemEvent) !== "issued") continue;
    const v = m.quoteVersionNo ?? 1;
    if (v >= (out[m.quoteId] ?? 0)) out[m.quoteId] = v;
  }
  return out;
}
