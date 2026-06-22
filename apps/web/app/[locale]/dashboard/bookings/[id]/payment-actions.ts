"use server";

import { revalidatePath } from "next/cache";

import { logFinanceEvent } from "@/lib/finance/audit";
import { assertPeriodOpen } from "@/lib/finance/periods";
import { grossUpVat } from "@/lib/finance/vat";
import { round2 } from "@/lib/format";
import { requireHost } from "@/lib/host/current";
import { gkeyFor } from "@/lib/guests/gkey";
import { dispatchEvent } from "@/lib/notifications/dispatch";
import { createAddonInvoice } from "@/lib/payments/invoicing";
import {
  guestCreditBalance,
  markBookingInvoicesPaidIfSettled,
  recomputeBookingPaymentState,
  recordBookingPayment,
  sumCompletedPaid,
} from "@/lib/payments/ledger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { createCreditNoteAction } from "../../credit-notes/actions";

export type PaymentResult = { ok: true } | { ok: false; error: string };

// Thin string|null adapter over the canonical requireHost (this file's callers
// branch on a nullable id rather than the discriminated result).
async function getHostId(): Promise<string | null> {
  const h = await requireHost();
  return h.ok ? h.hostId : null;
}

async function getUserId(): Promise<string | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

type OwnedBooking = {
  id: string;
  host_id: string;
  status: string;
  guest_id: string | null;
  reference: string;
};

/** Confirm a still-pending booking once money lands — fires the calendar-block
 *  + invoice triggers exactly as the EFT settle path does. */
async function confirmBookingIfPending(
  admin: ReturnType<typeof createAdminClient>,
  booking: OwnedBooking,
): Promise<void> {
  if (booking.status !== "pending" && booking.status !== "pending_eft") return;
  const now = new Date().toISOString();
  await admin
    .from("bookings")
    .update({
      status: "confirmed",
      previous_status: booking.status,
      confirmed_at: now,
    })
    .eq("id", booking.id);
  if (booking.guest_id) {
    await dispatchEvent({
      kind: "booking_confirmed_guest",
      recipientUserId: booking.guest_id,
      guestId: booking.guest_id,
      refs: { booking_id: booking.id },
    });
  }
}

function revalidateBooking(bookingId: string): void {
  revalidatePath(`/dashboard/bookings/${bookingId}`);
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/guests");
}

/**
 * Record a manual payment (EFT) against a booking — the host applies the deposit,
 * the balance, or any extra by hand. Overpayment auto-posts to the guest's store
 * credit. Confirms the booking on its first completed payment.
 */
export async function recordBookingPaymentAction(input: {
  bookingId: string;
  amount: number;
  kind: "deposit" | "balance" | "payment";
  method?: "eft" | "paystack" | "paypal";
  reference?: string | null;
  note?: string | null;
}): Promise<PaymentResult> {
  const hostId = await getHostId();
  const userId = await getUserId();
  if (!hostId) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, host_id, status, guest_id, reference")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking || booking.host_id !== hostId) {
    return { ok: false, error: "Not your booking." };
  }

  const period = await assertPeriodOpen(
    admin,
    hostId,
    new Date().toISOString(),
  );
  if (!period.ok) return { ok: false, error: period.error };

  const method = input.method ?? "eft";
  const reference = input.reference?.trim() || null;
  const res = await recordBookingPayment(admin, {
    bookingId: input.bookingId,
    amount: input.amount,
    kind: input.kind,
    method,
    note: input.note ?? null,
    recordedBy: userId,
    providerReference: reference,
  });
  if (!res.ok) return res;

  await confirmBookingIfPending(admin, booking as OwnedBooking);
  await markBookingInvoicesPaidIfSettled(admin, input.bookingId);
  await logFinanceEvent(admin, {
    hostId,
    actorId: userId,
    action: "payment.record",
    bookingId: input.bookingId,
    entityType: "payment",
    amount: input.amount,
    reason: input.note ?? null,
    metadata: { kind: input.kind, method, reference },
  });
  revalidateBooking(input.bookingId);
  return { ok: true };
}

/**
 * Mark a SEEDED pending entry (e.g. the 'deposit' created at quote-accept) as
 * received. Re-derives the booking's money state, posts any overpayment to
 * credit, and confirms a still-pending booking.
 */
export async function markPaymentReceivedAction(
  paymentId: string,
): Promise<PaymentResult> {
  const hostId = await getHostId();
  if (!hostId) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select(
      "id, status, amount, booking_id, bookings!inner ( id, host_id, status, guest_id, guest_email, currency, reference, total_amount )",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { ok: false, error: "Payment not found." };

  const booking = (
    Array.isArray(payment.bookings) ? payment.bookings[0] : payment.bookings
  ) as {
    id: string;
    host_id: string;
    status: string;
    guest_id: string | null;
    guest_email: string | null;
    currency: string;
    reference: string;
    total_amount: number;
  };
  if (!booking || booking.host_id !== hostId) {
    return { ok: false, error: "Not your payment." };
  }
  if (payment.status !== "pending") {
    return {
      ok: false,
      error: `This payment is already ${String(payment.status).replace(/_/g, " ")}.`,
    };
  }

  // Money lands "now" — block settling into a closed accounting period (matches
  // recordBookingPaymentAction; this action previously skipped the lock).
  const period = await assertPeriodOpen(
    admin,
    hostId,
    new Date().toISOString(),
  );
  if (!period.ok) return { ok: false, error: period.error };

  const total = Number(booking.total_amount);
  const paidBefore = await sumCompletedPaid(admin, booking.id);

  const { error: pErr } = await admin
    .from("payments")
    .update({ status: "completed", captured_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (pErr) return { ok: false, error: "Could not update the payment." };

  const state = await recomputeBookingPaymentState(admin, booking.id);
  const paidAfter = state?.paid ?? paidBefore + Number(payment.amount);

  // Post incremental overpayment to store credit.
  const excessBefore = Math.max(0, paidBefore - total);
  const excessAfter = Math.max(0, paidAfter - total);
  const delta = Math.round((excessAfter - excessBefore) * 100) / 100;
  if (delta > 0) {
    const gkey = gkeyFor(booking.guest_id, booking.guest_email);
    if (gkey) {
      await admin.from("guest_credit_ledger").insert({
        host_id: booking.host_id,
        gkey,
        guest_id: booking.guest_id,
        guest_email: booking.guest_email,
        amount: delta,
        currency: booking.currency,
        reason: `Overpayment on booking ${booking.reference}`,
        booking_id: booking.id,
        payment_id: paymentId,
      });
    }
  }

  await confirmBookingIfPending(admin, booking as OwnedBooking);
  await markBookingInvoicesPaidIfSettled(admin, booking.id);
  revalidateBooking(booking.id);
  return { ok: true };
}

/**
 * Apply a guest's store credit to an outstanding booking balance. Records a
 * 'credit' ledger payment (counts as money in) and debits guest_credit_ledger.
 */
export async function applyGuestCreditAction(input: {
  bookingId: string;
  amount: number;
}): Promise<PaymentResult> {
  const hostId = await getHostId();
  const userId = await getUserId();
  if (!hostId) return { ok: false, error: "Not signed in." };

  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, host_id, status, guest_id, guest_email, currency, reference, total_amount",
    )
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking || booking.host_id !== hostId) {
    return { ok: false, error: "Not your booking." };
  }

  const gkey = gkeyFor(booking.guest_id, booking.guest_email);
  if (!gkey) {
    return { ok: false, error: "This guest has no credit account." };
  }

  const available = await guestCreditBalance(admin, hostId, gkey);
  if (available <= 0) {
    return { ok: false, error: "This guest has no available credit." };
  }
  const paid = await sumCompletedPaid(admin, booking.id);
  const outstanding = round2(Number(booking.total_amount) - paid);
  if (outstanding <= 0) {
    return { ok: false, error: "This booking is already paid in full." };
  }
  const apply = Math.min(amount, available, outstanding);

  const now = new Date().toISOString();
  const { data: payment, error: pErr } = await admin
    .from("payments")
    .insert({
      booking_id: booking.id,
      amount: apply,
      currency: booking.currency,
      method: "credit",
      status: "completed",
      kind: "credit",
      note: "Store credit applied",
      recorded_by: userId,
      captured_at: now,
    })
    .select("id")
    .single();
  if (pErr || !payment) {
    return { ok: false, error: "Could not apply the credit." };
  }

  await admin.from("guest_credit_ledger").insert({
    host_id: hostId,
    gkey,
    guest_id: booking.guest_id,
    guest_email: booking.guest_email,
    amount: -apply,
    currency: booking.currency,
    reason: `Applied to booking ${booking.reference}`,
    booking_id: booking.id,
    payment_id: payment.id,
    created_by: userId,
  });

  await recomputeBookingPaymentState(admin, booking.id);
  await confirmBookingIfPending(admin, booking as OwnedBooking);
  await markBookingInvoicesPaidIfSettled(admin, booking.id);
  revalidateBooking(booking.id);
  return { ok: true };
}

const TERMINAL_STATUSES = [
  "cancelled_by_host",
  "cancelled_by_guest",
  "declined",
  "expired",
  "no_show",
];

/**
 * Issue a manual credit note against a booking (whole or part). Resolves the
 * booking's invoice and reuses createCreditNoteAction — which also posts the
 * amount to the guest's store credit so it shows on their balance.
 */
export async function issueBookingCreditNoteAction(input: {
  bookingId: string;
  amount: number;
  reason: string;
}): Promise<PaymentResult> {
  const hostId = await getHostId();
  if (!hostId) return { ok: false, error: "Not signed in." };

  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  const reason = (input.reason ?? "").trim();
  if (!reason) return { ok: false, error: "Add a reason for the credit note." };

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, host_id")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking || booking.host_id !== hostId) {
    return { ok: false, error: "Not your booking." };
  }

  // The booking invoice is what a credit note credits against.
  const { data: invoice } = await admin
    .from("invoices")
    .select("id")
    .eq("booking_id", input.bookingId)
    .eq("kind", "booking")
    .maybeSingle();
  if (!invoice) {
    return {
      ok: false,
      error: "Confirm the booking (so it has an invoice) before crediting.",
    };
  }

  const period = await assertPeriodOpen(
    admin,
    hostId,
    new Date().toISOString(),
  );
  if (!period.ok) return { ok: false, error: period.error };

  const res = await createCreditNoteAction({
    invoiceId: invoice.id,
    amount,
    reason,
  });
  if (!res.ok) return res;

  await logFinanceEvent(admin, {
    hostId,
    actorId: await getUserId(),
    action: "credit_note.issue",
    bookingId: input.bookingId,
    entityType: "credit_note",
    amount,
    reason,
  });
  revalidateBooking(input.bookingId);
  return { ok: true };
}

/**
 * Add one or more add-ons to an EXISTING booking (host side). Each call is a
 * transaction: the add-on rows join the booking, the booking total grows, a
 * supplementary 'addon' invoice is issued, and — when marked paid — a matching
 * 'addon' payment is recorded and the invoice attached to it. Unpaid add-ons
 * raise the outstanding balance for the host to collect later.
 */
export async function addBookingAddonAction(input: {
  bookingId: string;
  items: { label: string; quantity: number; unitPrice: number }[];
  markPaid: boolean;
}): Promise<PaymentResult> {
  const hostId = await getHostId();
  const userId = await getUserId();
  if (!hostId) return { ok: false, error: "Not signed in." };

  const items = (input.items ?? [])
    .map((i) => ({
      label: (i.label ?? "").trim(),
      quantity: Math.max(1, Math.round(Number(i.quantity) || 0)),
      unitPrice: Math.round((Number(i.unitPrice) || 0) * 100) / 100,
    }))
    .filter((i) => i.label && i.unitPrice >= 0);
  if (items.length === 0) {
    return { ok: false, error: "Add at least one add-on." };
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, host_id, status, guest_id, reference, total_amount, vat_amount, vat_rate",
    )
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking || booking.host_id !== hostId) {
    return { ok: false, error: "Not your booking." };
  }
  if (TERMINAL_STATUSES.includes(booking.status as string)) {
    return { ok: false, error: "Can't add to a cancelled booking." };
  }
  const period = await assertPeriodOpen(
    admin,
    hostId,
    new Date().toISOString(),
  );
  if (!period.ok) return { ok: false, error: period.error };

  const { data: existing } = await admin
    .from("booking_addons")
    .select("sort_order")
    .eq("booking_id", booking.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  let sort = (existing?.[0]?.sort_order ?? -1) + 1;

  const txStamp = new Date().toISOString();
  const { error: addErr } = await admin.from("booking_addons").insert(
    items.map((i) => ({
      booking_id: booking.id,
      label: i.label,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      subtotal: Math.round(i.quantity * i.unitPrice * 100) / 100,
      sort_order: sort++,
      source: "host_added",
      added_by: userId,
      created_at_tx: txStamp,
    })),
  );
  if (addErr) return { ok: false, error: "Could not add the add-on." };

  const addonTotal =
    Math.round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 100) /
    100;

  // VAT on the add-on, at the booking's frozen rate (so a VAT-registered
  // listing's add-ons are taxed the same as the stay).
  const { vat: addonVat, total: addonInclusive } = grossUpVat(
    addonTotal,
    Number(booking.vat_rate ?? 0),
  );

  // The booking grows by the VAT-inclusive add-on charge (and its VAT portion).
  await admin
    .from("bookings")
    .update({
      total_amount:
        Math.round((Number(booking.total_amount) + addonInclusive) * 100) / 100,
      vat_amount:
        Math.round((Number(booking.vat_amount ?? 0) + addonVat) * 100) / 100,
    })
    .eq("id", booking.id);

  // Optional immediate payment (cash/EFT taken at the time).
  let paymentId: string | null = null;
  if (input.markPaid && addonInclusive > 0) {
    const pay = await recordBookingPayment(admin, {
      bookingId: booking.id,
      amount: addonInclusive,
      kind: "addon",
      method: "eft",
      note: "Add-on payment",
      recordedBy: userId,
    });
    if (pay.ok) paymentId = pay.data.paymentId;
  }

  // Supplementary invoice for this transaction, linked to the new add-on rows.
  const invoiceId = await createAddonInvoice(admin, {
    bookingId: booking.id,
    lines: items.map((i) => ({
      label: i.label,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      subtotal: Math.round(i.quantity * i.unitPrice * 100) / 100,
    })),
    paymentId,
    paid: Boolean(input.markPaid),
    vatAmount: addonVat,
  });
  if (invoiceId) {
    await admin
      .from("booking_addons")
      .update({ invoice_id: invoiceId })
      .eq("booking_id", booking.id)
      .eq("source", "host_added")
      .is("invoice_id", null);
  }

  await recomputeBookingPaymentState(admin, booking.id);
  await markBookingInvoicesPaidIfSettled(admin, booking.id);
  await logFinanceEvent(admin, {
    hostId,
    actorId: userId,
    action: "charge.add",
    bookingId: booking.id,
    entityType: "invoice",
    entityId: invoiceId,
    amount: addonInclusive,
    reason: items.map((i) => i.label).join(", "),
    metadata: { markPaid: input.markPaid },
  });
  revalidateBooking(booking.id);
  return { ok: true };
}
