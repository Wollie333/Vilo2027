// Shared booking-cancellation core used by both the host action and the guest
// portal action, so the policy-refund + calendar + notification behaviour is
// identical for both. NOT a "use server" module — the calling Server Actions
// authorise ownership first, then hand a verified booking to finalizeCancellation.
//
// The DB trigger on_booking_cancelled releases blocked_dates + rolls back
// counters; this layer handles the status transition, the policy-entitled
// refund, and notifying the other party.

import { round2 } from "@/lib/format";
import { dispatchEvent } from "@/lib/notifications/dispatch";
import { sumCompletedPaid } from "@/lib/payments/ledger";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  computeSettlement,
  mintCancellationCreditNote,
} from "./cancel-settlement";

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
  /** Amount retained because non-refundable add-ons were booked (G7). */
  nonRefundableRetained: number;
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
  const policyRefund = Number(r.refund_amount ?? 0);

  // G7: non-refundable add-ons are retained FIRST — subtract what was paid for
  // add-ons flagged non-refundable before returning anything. Join the booking's
  // add-on lines to the catalog flag (custom lines with no addon_id stay
  // refundable). refund = max(0, policyRefund − nonRefundableAddonsPaid).
  const { data: addonLines } = await admin
    .from("booking_addons")
    .select("subtotal, addon:addons!inner(is_refundable)")
    .eq("booking_id", bookingId)
    .eq("addon.is_refundable", false);
  const nonRefundableRetained = (addonLines ?? []).reduce(
    (sum, line) => sum + Number((line as { subtotal?: number }).subtotal ?? 0),
    0,
  );

  return {
    refundAmount: Math.max(0, policyRefund - nonRefundableRetained),
    refundPercent: Number(r.refund_percent ?? 0),
    ruleApplied: r.rule_applied ?? null,
    daysBeforeCheckIn:
      r.days_before_checkin == null ? null : Number(r.days_before_checkin),
    totalPaid: Number(r.total_paid ?? 0),
    nonRefundableRetained,
  };
}

export type CancelResult =
  | { ok: true; refundAmount: number }
  | { ok: false; error: string };

/**
 * Cancel a (pre-authorised) booking with correct, VAT-aware accounting:
 * transition status, mint a **credit note** reversing the cancelled portion of
 * the invoice (never void it), create the guest's refund request, and net the
 * booking to zero. `refundAmount` lets a HOST override the policy-suggested
 * refund (0 → what was paid); a guest cancel always uses the policy suggestion.
 * The caller MUST have verified that `actor` owns this booking.
 */
export async function finalizeCancellation(
  booking: CancellationBooking,
  actor: CancelActor,
  reason: string | null,
  refundAmount?: number,
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

  // Suggested refund (policy % × net paid, G5) and what was actually captured.
  const policy = await policyRefundFor(booking.id);
  const paid = await sumCompletedPaid(admin, booking.id);
  const total = round2(Number(booking.total_amount));

  // A host may override the refund (0 → amount paid); a guest gets the policy
  // suggestion. computeSettlement clamps R into [0, paid].
  const chosenRefund =
    actor === "host" && refundAmount != null
      ? refundAmount
      : policy.refundAmount;
  const s = computeSettlement(total, paid, chosenRefund);

  // Transition with optimistic concurrency. The on_booking_cancelled trigger
  // releases blocked_dates + rolls back counters. The booking nets to 0 (the
  // credit note reverses the receivable), so balance_due is 0.
  const { error: updErr } = await admin
    .from("bookings")
    .update({
      status: toStatus,
      previous_status: booking.status,
      balance_due: 0,
      cancelled_at: new Date().toISOString(),
      cancelled_by: actor,
      cancellation_reason: reason?.trim() || null,
    })
    .eq("id", booking.id)
    .eq("status", booking.status);
  if (updErr) {
    return { ok: false, error: "Could not cancel the booking. Try again." };
  }

  // Reverse the cancelled portion with a credit note (keep the invoice — SARS:
  // don't void an issued tax invoice). Amount = (total − paid) + refund = the
  // outstanding written off PLUS the refunded portion; the retained (paid −
  // refund) stays invoiced as the cancellation fee (revenue). Needs the booking's
  // frozen VAT rate for the split.
  const { data: bkVat } = await admin
    .from("bookings")
    .select("vat_rate")
    .eq("id", booking.id)
    .maybeSingle();
  await mintCancellationCreditNote(admin, {
    bookingId: booking.id,
    hostId: booking.host_id,
    guestId: booking.guest_id,
    currency: booking.currency || "ZAR",
    amount: s.creditNoteAmount,
    vatRate: Number(bkVat?.vat_rate ?? 0),
    reason:
      actor === "host"
        ? "Host cancelled the booking"
        : "Guest cancelled the booking",
  });

  // Cash back to the guest: a refund request for the chosen amount, when money
  // was captured and nothing's open already. The refund manager processes it.
  // Only for account-linked guests — a walk-in / email-only booking can't be
  // refunded through the platform (matches hostInitiatedRefundAction); the credit
  // note has already reversed the receivable, so the host settles it directly.
  if (s.refund > 0 && booking.guest_id) {
    const { data: payment } = await admin
      .from("payments")
      .select("id")
      .eq("booking_id", booking.id)
      .in("status", ["completed", "partially_refunded"])
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
          requested_amount: s.refund,
          policy_entitlement: policy.refundAmount,
          currency: booking.currency || "ZAR",
          reason:
            actor === "host"
              ? "Host cancelled the booking"
              : "Guest cancelled the booking",
          initiated_by: actor,
          is_auto_refund: true,
          auto_refund_rule: policy.ruleApplied,
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

  return { ok: true, refundAmount: s.refund };
}
