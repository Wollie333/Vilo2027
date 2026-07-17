"use server";

import { revalidatePath } from "next/cache";

import { markPaymentReceivedAction } from "@/app/[locale]/dashboard/bookings/[id]/payment-actions";
import { assertFullHost as requireHost } from "@/lib/host/current";
import { dispatchEvent } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

export type PaymentActionResult = { ok: true } | { ok: false; error: string };

// Thin string|null adapter over the canonical requireHost.
async function getHostId(): Promise<string | null> {
  const h = await requireHost();
  return h.ok ? h.hostId : null;
}

/**
 * Manually settle a payment — the financial-management control for manual EFT.
 * Card (Paystack) payments settle automatically via webhook, so only pending
 * EFT payments are touched here. "mark_paid" verifies the transfer and confirms
 * the booking; "mark_failed" rejects it and declines the booking.
 *
 * Payments have no host-UPDATE RLS (they're provider-owned), so this runs via
 * the admin client after verifying the signed-in host owns the booking.
 */
export async function updatePaymentStatusAction(
  paymentId: string,
  action: "mark_paid" | "mark_failed",
): Promise<PaymentActionResult> {
  const hostId = await getHostId();
  if (!hostId) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select(
      "id, status, method, booking_id, bookings!inner ( id, host_id, status, reference, guest_id )",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { ok: false, error: "Payment not found." };

  const booking = Array.isArray(payment.bookings)
    ? payment.bookings[0]
    : payment.bookings;
  if (!booking || booking.host_id !== hostId) {
    return { ok: false, error: "Not your payment." };
  }
  if (payment.method !== "eft") {
    return {
      ok: false,
      error:
        "Only manual EFT payments are settled by hand — card payments update automatically.",
    };
  }
  if (payment.status !== "pending") {
    return {
      ok: false,
      error: `This payment is already ${payment.status.replace(/_/g, " ")}.`,
    };
  }

  const now = new Date().toISOString();

  if (action === "mark_paid") {
    // Settle through the ledger SSOT: markPaymentReceivedAction recomputes
    // balance_due + payment_status, posts any overpayment to store credit, and
    // confirms the booking (the same path the per-booking ledger tab uses).
    //
    // This branch previously hard-set payment_status='completed' and NEVER
    // recomputed balance_due — so a full EFT read "paid" while still showing the
    // amount owing, a deposit-only EFT was flagged fully paid, and overpayment
    // credit was silently lost. Straight AGENT_RULES §4.7 violation. (It also
    // now runs under the accounting-period lock that action already enforces.)
    const r = await markPaymentReceivedAction(paymentId);
    if (!r.ok) return r;
  } else {
    const { error: pErr } = await admin
      .from("payments")
      .update({ status: "failed", failed_at: now })
      .eq("id", paymentId);
    if (pErr) return { ok: false, error: "Could not update the payment." };

    // Only DECLINE the booking when it's still awaiting this payment to confirm.
    // A confirmed booking can legitimately carry a pending EFT *balance* payment;
    // marking that failed must NOT decline (and release the calendar for) a live
    // booking — just record the failed payment so the host can chase it.
    const awaitingConfirmation =
      booking.status === "pending" || booking.status === "pending_eft";
    if (awaitingConfirmation) {
      const { error: bErr } = await admin
        .from("bookings")
        .update({
          status: "declined",
          previous_status: booking.status,
          declined_at: now,
          payment_status: "failed",
        })
        .eq("id", booking.id);
      if (bErr) {
        return {
          ok: false,
          error: "Payment marked failed, but the booking didn't update.",
        };
      }
      if (booking.guest_id) {
        await dispatchEvent({
          kind: "booking_declined_guest",
          recipientUserId: booking.guest_id,
          guestId: booking.guest_id,
          refs: { booking_id: booking.id },
        });
      }
    }
  }

  revalidatePath(`/dashboard/payments/${paymentId}`);
  revalidatePath("/dashboard/payments");
  revalidatePath(`/dashboard/bookings/${booking.id}`);
  revalidatePath("/dashboard/bookings");
  return { ok: true };
}
