"use server";

import { revalidatePath } from "next/cache";

import { gkeyFor } from "@/lib/guests/gkey";
import { dispatchEvent } from "@/lib/notifications/dispatch";
import {
  guestCreditBalance,
  recomputeBookingPaymentState,
  recordBookingPayment,
  sumCompletedPaid,
} from "@/lib/payments/ledger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type PaymentResult = { ok: true } | { ok: false; error: string };

async function getHostId(): Promise<string | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  return host?.id ?? null;
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

  const res = await recordBookingPayment(admin, {
    bookingId: input.bookingId,
    amount: input.amount,
    kind: input.kind,
    method: "eft",
    note: input.note ?? null,
    recordedBy: userId,
  });
  if (!res.ok) return res;

  await confirmBookingIfPending(admin, booking as OwnedBooking);
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
  const outstanding =
    Math.round((Number(booking.total_amount) - paid) * 100) / 100;
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
  revalidateBooking(booking.id);
  return { ok: true };
}
