// Shared booking-cancellation core used by both the host action and the guest
// portal action, so the policy-refund + calendar + notification behaviour is
// identical for both. NOT a "use server" module — the calling Server Actions
// authorise ownership first, then hand a verified booking to finalizeCancellation.
//
// The DB trigger on_booking_cancelled releases blocked_dates + rolls back
// counters; this layer handles the status transition, the policy-entitled
// refund, and notifying the other party.

import { dispatchEvent } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

export type CancelActor = "host" | "guest";

/** Statuses a booking can be cancelled from. */
export const CANCELLABLE_STATUSES = [
  "pending",
  "pending_eft",
  "pending_eft_review",
  "confirmed",
  "checked_in",
] as const;

export type CancellationBooking = {
  id: string;
  host_id: string;
  guest_id: string | null;
  status: string;
  currency: string | null;
  total_amount: number | string;
};

export type PolicyRefund = {
  refundAmount: number;
  refundPercent: number;
  ruleApplied: string | null;
  daysBeforeCheckIn: number | null;
  totalPaid: number;
};

/** Policy-entitled refund for cancelling this booking now (preview + apply). */
export async function policyRefundFor(
  bookingId: string,
): Promise<PolicyRefund> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("calculate_policy_refund_amount", {
    p_booking_id: bookingId,
  });
  const r = (data ?? {}) as {
    refund_amount?: number | string;
    refund_percent?: number | string;
    rule_applied?: string | null;
    days_before_checkin?: number | null;
    total_paid?: number | string;
  };
  return {
    refundAmount: Number(r.refund_amount ?? 0),
    refundPercent: Number(r.refund_percent ?? 0),
    ruleApplied: r.rule_applied ?? null,
    daysBeforeCheckIn:
      r.days_before_checkin == null ? null : Number(r.days_before_checkin),
    totalPaid: Number(r.total_paid ?? 0),
  };
}

export type CancelResult =
  | { ok: true; refundAmount: number }
  | { ok: false; error: string };

/**
 * Cancel a (pre-authorised) booking: transition status, auto-create the policy-
 * entitled refund request when the guest has paid, and notify the other party.
 * The caller MUST have verified that `actor` owns this booking.
 */
export async function finalizeCancellation(
  booking: CancellationBooking,
  actor: CancelActor,
  reason: string | null,
): Promise<CancelResult> {
  if (!CANCELLABLE_STATUSES.includes(booking.status as never)) {
    return {
      ok: false,
      error: `This booking can't be cancelled (it's ${booking.status.replace(
        /_/g,
        " ",
      )}).`,
    };
  }

  const admin = createAdminClient();
  const toStatus =
    actor === "host" ? "cancelled_by_host" : "cancelled_by_guest";

  const refund = await policyRefundFor(booking.id);

  // Transition with optimistic concurrency. The on_booking_cancelled trigger
  // releases blocked_dates + rolls back counters.
  const { error: updErr } = await admin
    .from("bookings")
    .update({
      status: toStatus,
      previous_status: booking.status,
      cancelled_at: new Date().toISOString(),
      cancelled_by: actor,
      cancellation_reason: reason?.trim() || null,
    })
    .eq("id", booking.id)
    .eq("status", booking.status);
  if (updErr) {
    return { ok: false, error: "Could not cancel the booking. Try again." };
  }

  // Financial cleanup so a cancelled booking never shows a phantom receivable in
  // the ledger. A dead booking owes nothing, so its denormalised balance is 0.
  // When the guest paid NOTHING, the booking's open invoices are pure phantom
  // charges (no money captured, nothing retained) — void them so the Finances
  // ledger drops the obligation. When money WAS captured, we leave the invoices
  // in place: the retained (non-refunded) portion is the host's cancellation
  // revenue, and reducing the charge to it is the forfeit-style accounting that
  // no-show uses (F3) — a separate, founder-decided treatment, not done here.
  await admin.from("bookings").update({ balance_due: 0 }).eq("id", booking.id);

  const { count: paidCount } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", booking.id)
    .eq("status", "completed")
    .is("voided_at", null);

  if (!paidCount) {
    await admin
      .from("invoices")
      .update({
        voided_at: new Date().toISOString(),
        void_reason: `Booking ${toStatus.replace(/_/g, " ")}`,
      })
      .eq("booking_id", booking.id)
      .is("voided_at", null)
      .neq("status", "paid");
  }

  // Auto-create a pending refund for the policy entitlement, when the guest has
  // a captured payment and there's nothing open already. The existing refund
  // manager processes it from here (host approve → Paystack/EFT).
  if (refund.refundAmount > 0) {
    const { data: payment } = await admin
      .from("payments")
      .select("id")
      .eq("booking_id", booking.id)
      .eq("status", "completed")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (payment) {
      const { data: open } = await admin
        .from("refund_requests")
        .select("id")
        .eq("booking_id", booking.id)
        .in("status", ["pending", "approved", "processing"])
        .maybeSingle();

      if (!open) {
        await admin.from("refund_requests").insert({
          booking_id: booking.id,
          payment_id: payment.id,
          host_id: booking.host_id,
          guest_id: booking.guest_id,
          requested_amount: refund.refundAmount,
          policy_entitlement: refund.refundAmount,
          currency: booking.currency || "ZAR",
          reason:
            actor === "host"
              ? "Host cancelled the booking"
              : "Guest cancelled the booking",
          initiated_by: actor,
          is_auto_refund: true,
          auto_refund_rule: refund.ruleApplied,
          status: "pending",
        });
      }
    }
  }

  // Notify the other party.
  if (actor === "host" && booking.guest_id) {
    await dispatchEvent({
      kind: "booking_cancelled_guest",
      recipientUserId: booking.guest_id,
      guestId: booking.guest_id,
      refs: { booking_id: booking.id },
    });
  } else if (actor === "guest") {
    const { data: host } = await admin
      .from("hosts")
      .select("user_id")
      .eq("id", booking.host_id)
      .maybeSingle();
    if (host?.user_id) {
      await dispatchEvent({
        kind: "booking_cancelled_host",
        recipientUserId: host.user_id,
        refs: { booking_id: booking.id },
      });
    }
  }

  return { ok: true, refundAmount: refund.refundAmount };
}
