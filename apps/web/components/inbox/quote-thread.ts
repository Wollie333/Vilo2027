import type { ThreadBooking, ThreadQuote } from "./ThreadQuoteCard";

// Shared plumbing for rendering quotes inside conversation threads, used by both
// the host inbox and the guest portal so the column list, the row→view-model
// mapping, and the "one card per quote" rule live in exactly one place.

// Columns a thread needs to render a quote card. Keep in sync with ThreadQuote.
export const QUOTE_CARD_COLUMNS =
  "id, quote_number, status, currency, total_amount, check_in, check_out, headcount, scope, deposit_type, deposit_amount, balance_amount, valid_until, accept_token, converted_booking_id";

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

// The set of message ids that should render a quote card: the FIRST message for
// each distinct quote, in thread order. (One card per quote; it reflects the
// quote's live state, so the request and the finished quote share one card.)
export function firstQuoteMessageIds(
  messages: { id: string; quoteId: string | null }[],
  quotesById: Record<string, ThreadQuote>,
): Set<string> {
  const seenQuote = new Set<string>();
  const ids = new Set<string>();
  for (const m of messages) {
    if (m.quoteId && quotesById[m.quoteId] && !seenQuote.has(m.quoteId)) {
      seenQuote.add(m.quoteId);
      ids.add(m.id);
    }
  }
  return ids;
}
