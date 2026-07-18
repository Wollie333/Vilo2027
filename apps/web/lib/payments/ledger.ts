// Payment-ledger maths — the single source of truth for what a booking has been
// paid, what it still owes, and how overpayment becomes guest store credit.
//
// A booking has MANY payment rows. "Paid" is the NET captured across inbound
// entries (deposit / balance / addon / generic payment / applied credit): each
// row's `amount` minus its `refunded_amount`. A refund increments the payment's
// refunded_amount and flips its status to 'partially_refunded' (or 'refunded'
// once fully back) — so those rows must still count their retained portion, NOT
// drop out. Overpaid money never sits on the booking: the excess is posted to
// guest_credit_ledger (per-host, keyed by the CRM gkey) and the balance floors
// at zero.
//
// Server-only. All writes use the service-role admin client; callers verify the
// host owns the booking first (payments have no host-write RLS).

import { round2 } from "@/lib/format";
import { gkeyFor } from "@/lib/guests/gkey";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Ledger entries that count as money received against the booking total. The
 * single source of truth for "which payment kinds add up to amount paid" —
 * import this everywhere instead of re-declaring the list. */
export const INBOUND_KINDS = [
  "deposit",
  "balance",
  "addon",
  "payment",
  "credit",
];

export type BookingPaymentState = {
  total: number;
  paid: number;
  balance: number;
  status: "pending" | "partial" | "completed";
};

/** One payment row's fields that matter for the paid-sum (any caller can pass
 * already-fetched rows here instead of re-querying). Include `refunded_amount`
 * or a partially-refunded row will over-count — see {@link sumPaidFromRows}. */
export type LedgerRowLike = {
  amount: number | string;
  kind: string | null;
  status: string | null;
  voided_at?: string | null;
  refunded_amount?: number | string | null;
};

/** Statuses whose captured money still counts toward "paid" (net of refunds). */
const PAID_STATUSES = ["completed", "partially_refunded", "refunded"];

/**
 * NET amount paid from ALREADY-FETCHED rows — the one place that defines what
 * "amount paid" means: Σ(amount − refunded_amount) over non-voided inbound rows
 * that captured money (completed / partially_refunded / refunded). A fully
 * refunded row nets to 0; a partially refunded one keeps its retained portion.
 * Mirrors the DB rollup in update_payment_refunded_amount(). Callers MUST select
 * `refunded_amount` — otherwise a refunded row would count its full amount.
 */
export function sumPaidFromRows(rows: LedgerRowLike[]): number {
  let paid = 0;
  for (const p of rows) {
    if (
      p.voided_at == null &&
      PAID_STATUSES.includes(p.status ?? "") &&
      INBOUND_KINDS.includes(p.kind ?? "")
    ) {
      paid += Number(p.amount) - Number(p.refunded_amount ?? 0);
    }
  }
  return round2(Math.max(0, paid));
}

/** Net paid for a booking (queries, then sums via the canonical
 * {@link sumPaidFromRows}). */
export async function sumCompletedPaid(
  admin: Admin,
  bookingId: string,
): Promise<number> {
  const { data } = await admin
    .from("payments")
    .select("amount, kind, status, voided_at, refunded_amount")
    .eq("booking_id", bookingId)
    .in("status", PAID_STATUSES)
    .is("voided_at", null);
  return sumPaidFromRows(data ?? []);
}

/**
 * Recompute and persist a booking's money state (balance_due + payment_status)
 * from its payment ledger. Returns the computed state. Never confirms the
 * booking — that's an explicit side-effect the caller decides on.
 */
export async function recomputeBookingPaymentState(
  admin: Admin,
  bookingId: string,
): Promise<BookingPaymentState | null> {
  const { data: booking } = await admin
    .from("bookings")
    .select("id, total_amount, payment_status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return null;

  const total = round2(Number(booking.total_amount));
  const paid = await sumCompletedPaid(admin, bookingId);
  const balance = round2(Math.max(0, total - paid));

  let status: BookingPaymentState["status"];
  if (paid <= 0) status = "pending";
  else if (paid + 0.001 < total) status = "partial";
  else status = "completed";

  // Don't clobber terminal money states (refunded / voided / forfeited) that the
  // refund or forfeiture flow set. NOTE: 'failed' is deliberately NOT terminal —
  // a failed card is recoverable (the guest retries + pays), and treating it as
  // terminal left a fully-paid retry stuck showing payment_status='failed' with
  // balance_due=0, so the guest saw a "pay now" page for a paid, confirmed stay.
  const terminal = ["refunded", "partially_refunded", "voided", "forfeited"];
  const patch: Record<string, unknown> = { balance_due: balance };
  if (!terminal.includes(booking.payment_status as string)) {
    patch.payment_status = status;
  }
  await admin.from("bookings").update(patch).eq("id", bookingId);

  return { total, paid, balance, status };
}

/**
 * Post the INCREMENTAL overpayment (beyond the booking total) as guest store
 * credit. Compares paid-before vs paid-after so multiple payments each only ever
 * credit their own excess. No-op when the booking isn't overpaid.
 */
async function postOverpaymentCredit(
  admin: Admin,
  args: {
    bookingId: string;
    paidBefore: number;
    paidAfter: number;
    total: number;
    paymentId: string | null;
    recordedBy: string | null;
  },
): Promise<number> {
  const excessBefore = Math.max(0, args.paidBefore - args.total);
  const excessAfter = Math.max(0, args.paidAfter - args.total);
  const delta = round2(excessAfter - excessBefore);
  if (delta <= 0) return 0;

  const { data: booking } = await admin
    .from("bookings")
    .select("host_id, guest_id, guest_email, currency, reference")
    .eq("id", args.bookingId)
    .maybeSingle();
  if (!booking) return 0;

  const gkey = gkeyFor(booking.guest_id, booking.guest_email);
  if (!gkey) return 0;

  await admin.from("guest_credit_ledger").insert({
    host_id: booking.host_id,
    gkey,
    guest_id: booking.guest_id,
    guest_email: booking.guest_email,
    amount: delta,
    currency: booking.currency,
    reason: `Overpayment on booking ${booking.reference}`,
    booking_id: args.bookingId,
    payment_id: args.paymentId,
    created_by: args.recordedBy,
  });
  return delta;
}

export type RecordPaymentInput = {
  bookingId: string;
  amount: number;
  kind: "deposit" | "balance" | "addon" | "payment";
  method?: "eft" | "paystack" | "paypal";
  note?: string | null;
  recordedBy: string | null;
  /** Provider reference for card payments (kept unique for webhook idempotency). */
  providerReference?: string | null;
  providerResponse?: Record<string, unknown> | null;
};

export type RecordPaymentResult = {
  paymentId: string;
  state: BookingPaymentState;
  creditPosted: number;
};

/**
 * Record ONE completed payment against a booking and re-derive its money state.
 * Manual EFT lands here from the booking's Payments tab; card webhooks reuse it
 * with a providerReference. Overpayment auto-posts to the guest's store credit.
 */
export async function recordBookingPayment(
  admin: Admin,
  input: RecordPaymentInput,
): Promise<
  { ok: true; data: RecordPaymentResult } | { ok: false; error: string }
> {
  const amount = round2(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }

  const { data: booking } = await admin
    .from("bookings")
    .select("id, total_amount, currency")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found." };

  const total = round2(Number(booking.total_amount));
  const paidBefore = await sumCompletedPaid(admin, input.bookingId);

  const now = new Date().toISOString();
  const { data: payment, error: payErr } = await admin
    .from("payments")
    .insert({
      booking_id: input.bookingId,
      amount,
      currency: booking.currency,
      method: input.method ?? "eft",
      status: "completed",
      kind: input.kind,
      note: input.note ?? null,
      recorded_by: input.recordedBy,
      provider_reference: input.providerReference ?? null,
      provider_response: input.providerResponse ?? null,
      captured_at: now,
    })
    .select("id")
    .single();
  if (payErr || !payment) {
    return { ok: false, error: "Could not record the payment." };
  }

  const state = await recomputeBookingPaymentState(admin, input.bookingId);
  const paidAfter = state?.paid ?? round2(paidBefore + amount);
  const creditPosted = await postOverpaymentCredit(admin, {
    bookingId: input.bookingId,
    paidBefore,
    paidAfter,
    total,
    paymentId: payment.id,
    recordedBy: input.recordedBy,
  });

  return {
    ok: true,
    data: {
      paymentId: payment.id,
      state: state ?? {
        total,
        paid: paidAfter,
        balance: 0,
        status: "completed",
      },
      creditPosted,
    },
  };
}

/**
 * Once a booking is fully paid (balance floored at zero), mark all of its still-
 * 'issued' invoices (the booking invoice + any addon invoices) as paid. This is
 * also what flips the main invoice to paid when a deposit-first booking finally
 * settles (the confirm trigger only marks it paid if it was paid in full up
 * front).
 */
export async function markBookingInvoicesPaidIfSettled(
  admin: Admin,
  bookingId: string,
): Promise<void> {
  const { data: booking } = await admin
    .from("bookings")
    .select("total_amount")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return;
  const total = round2(Number(booking.total_amount));
  const paid = await sumCompletedPaid(admin, bookingId);
  if (total <= 0 || paid + 0.001 < total) return;

  await admin
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .eq("status", "issued");
}

/** Available store credit for a guest with a host (sum of the ledger). */
export async function guestCreditBalance(
  admin: Admin,
  hostId: string,
  gkey: string,
): Promise<number> {
  const { data } = await admin
    .from("guest_credit_ledger")
    .select("amount")
    .eq("host_id", hostId)
    .eq("gkey", gkey);
  let bal = 0;
  for (const r of data ?? []) bal += Number(r.amount);
  return round2(bal);
}
