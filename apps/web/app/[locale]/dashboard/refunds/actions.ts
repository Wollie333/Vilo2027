"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logFinanceEvent } from "@/lib/finance/audit";
import { assertPeriodOpen } from "@/lib/finance/periods";
import { assertFullHost as getMyHostId } from "@/lib/host/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

const declineReasons = [
  "outside_policy",
  "no_show",
  "terms_violated",
  "services_rendered",
  "other",
] as const;

const refundMethods = ["paystack", "paypal", "eft", "manual"] as const;
type RefundMethod = (typeof refundMethods)[number];

const METHOD_LABELS: Record<RefundMethod, string> = {
  paystack: "Paystack",
  paypal: "PayPal",
  eft: "EFT / bank transfer",
  manual: "Manual / other",
};

/**
 * Completion fields for a refund, given the host's chosen payout rail.
 * Paystack/PayPal are provider-automated (is_manual = false); EFT/Manual are
 * sent by the host outside the platform (is_manual = true). Pre-MVP the real
 * provider calls aren't wired, so everything still completes optimistically —
 * but the chosen rail is recorded and drives is_manual + the note.
 */
function completionPatch(method: RefundMethod) {
  const isManual = method === "eft" || method === "manual";
  const label = METHOD_LABELS[method];
  return {
    status: "completed" as const,
    refund_method: method,
    is_manual: isManual,
    manual_sent_at: isManual ? new Date().toISOString() : null,
    manual_note: isManual
      ? `${label} refund — sent by the host outside the platform.`
      : `${label} — provider integration pending (pre-MVP); recorded as paid.`,
  };
}

const approveSchema = z.object({
  refundId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(refundMethods),
  note: z.string().max(1000).optional().nullable(),
});

const declineSchema = z.object({
  refundId: z.string().uuid(),
  reason: z.enum(declineReasons),
  note: z.string().max(1000).optional().nullable(),
});

const requestSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(refundMethods),
  reference: z.string().max(120).optional().nullable(),
  reason: z.string().min(1).max(200),
  reasonDetail: z.string().max(2000).optional().nullable(),
});

/**
 * Host approves a refund. Status flips to 'approved', then we immediately
 * move to 'processing' and 'completed' since real provider calls aren't
 * wired yet. When Paystack/PayPal go live, replace the optimistic transition
 * with a provider-call + webhook callback.
 */
export async function approveRefundAction(input: {
  refundId: string;
  amount: number;
  method: RefundMethod;
  note?: string | null;
}): Promise<ActionResult> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const host = await getMyHostId();
  if (!host.ok) return host;

  const supabase = createServerClient();

  const { data: refund } = await supabase
    .from("refund_requests")
    .select("id, host_id, status, requested_amount, payment_id")
    .eq("id", parsed.data.refundId)
    .maybeSingle();
  if (!refund || refund.host_id !== host.hostId) {
    return { ok: false, error: "Refund not found." };
  }
  // Wielo never holds funds — refunds are host→guest directly, so there's no
  // platform "escalated" state to act on. Allow pending + failed (a prior
  // attempt to retry), matching the host_action_refunds RLS policy.
  if (refund.status !== "pending" && refund.status !== "failed") {
    return { ok: false, error: `Cannot approve a ${refund.status} refund.` };
  }
  // Cap against money ACTUALLY captured on the payment (amount minus any prior
  // refunds), not just the requested figure — otherwise a refund could exceed
  // what was ever collected (e.g. a R1000 request against a R500 deposit).
  let maxRefundable = Number(refund.requested_amount);
  if (refund.payment_id) {
    const { data: pay } = await supabase
      .from("payments")
      .select("amount, refunded_amount")
      .eq("id", refund.payment_id)
      .maybeSingle();
    if (pay) {
      const remaining =
        Math.round(
          (Number(pay.amount) - Number(pay.refunded_amount ?? 0)) * 100,
        ) / 100;
      maxRefundable = Math.min(maxRefundable, Math.max(0, remaining));
    }
  }
  if (parsed.data.amount > maxRefundable) {
    return {
      ok: false,
      error:
        "Approved amount can't exceed what was captured on this payment (less any prior refunds).",
    };
  }

  // Two-step UPDATE because the status trigger logs each transition.
  // First: approved. Then: completed (since no real provider call yet).
  const { error: approveErr } = await supabase
    .from("refund_requests")
    .update({
      status: "approved",
      approved_amount: parsed.data.amount,
      refund_method: parsed.data.method,
      host_note: parsed.data.note?.trim() || null,
      actioned_by: host.userId,
      actioned_at: new Date().toISOString(),
    })
    .eq("id", refund.id);

  if (approveErr) return { ok: false, error: approveErr.message };

  // Optimistic completion — flag it as completed so payments.refunded_amount
  // updates via the existing v11 trigger. The chosen payout rail drives
  // is_manual + the audit note (see completionPatch).
  const { error: completeErr } = await supabase
    .from("refund_requests")
    .update(completionPatch(parsed.data.method))
    .eq("id", refund.id);

  if (completeErr) return { ok: false, error: completeErr.message };

  revalidatePath("/dashboard/refunds");
  revalidatePath("/dashboard/bookings");
  return { ok: true };
}

export async function declineRefundAction(input: {
  refundId: string;
  reason: (typeof declineReasons)[number];
  note?: string | null;
}): Promise<ActionResult> {
  const parsed = declineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const host = await getMyHostId();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { data: refund } = await supabase
    .from("refund_requests")
    .select("id, host_id, status")
    .eq("id", parsed.data.refundId)
    .maybeSingle();
  if (!refund || refund.host_id !== host.hostId) {
    return { ok: false, error: "Refund not found." };
  }
  // Pending + failed only (see approveRefundAction) — no platform "escalated".
  if (refund.status !== "pending" && refund.status !== "failed") {
    return { ok: false, error: `Cannot decline a ${refund.status} refund.` };
  }

  const { error } = await supabase
    .from("refund_requests")
    .update({
      status: "declined",
      decline_reason: parsed.data.reason,
      host_note: parsed.data.note?.trim() || null,
      actioned_by: host.userId,
      actioned_at: new Date().toISOString(),
    })
    .eq("id", refund.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/refunds");
  revalidatePath("/dashboard/bookings");
  return { ok: true };
}

/**
 * Host-initiated refund — create a refund_request and immediately mark
 * approved + completed. Useful when the host wants to issue a refund
 * proactively (no guest request needed).
 */
export async function hostInitiatedRefundAction(input: {
  bookingId: string;
  amount: number;
  method: RefundMethod;
  reference?: string | null;
  reason: string;
  reasonDetail?: string | null;
}): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const host = await getMyHostId();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, host_id, guest_id, total_amount, currency")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();
  if (!booking || booking.host_id !== host.hostId) {
    return { ok: false, error: "Booking not found." };
  }
  if (!booking.guest_id) {
    return {
      ok: false,
      error: "Walk-in bookings can't be refunded through the platform.",
    };
  }
  if (parsed.data.amount > Number(booking.total_amount)) {
    return {
      ok: false,
      error: "Refund can't exceed the booking total.",
    };
  }

  const periodAdmin = createAdminClient();
  const period = await assertPeriodOpen(
    periodAdmin,
    host.hostId,
    new Date().toISOString(),
  );
  if (!period.ok) return { ok: false, error: period.error };

  const { data: payment } = await supabase
    .from("payments")
    .select("id, status, amount, refunded_amount")
    .eq("booking_id", booking.id)
    .eq("status", "completed")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment) {
    return {
      ok: false,
      error: "No captured payment found for this booking.",
    };
  }
  // Never refund more than was captured on this payment (less prior refunds).
  const remaining =
    Math.round(
      (Number(payment.amount) - Number(payment.refunded_amount ?? 0)) * 100,
    ) / 100;
  if (parsed.data.amount > Math.max(0, remaining)) {
    return {
      ok: false,
      error:
        "Refund can't exceed what was captured on this payment (less any prior refunds).",
    };
  }

  // refund_requests has no host INSERT RLS policy (only guest + admin), and the
  // approved→completed transition isn't covered by host_action_refunds either.
  // Ownership is already verified above, so write through the admin client —
  // the same pattern the guest refund + cancellation flows use.
  const admin = createAdminClient();

  const { data: inserted, error: insertErr } = await admin
    .from("refund_requests")
    .insert({
      booking_id: booking.id,
      payment_id: payment.id,
      host_id: host.hostId,
      guest_id: booking.guest_id,
      requested_amount: parsed.data.amount,
      approved_amount: parsed.data.amount,
      refund_method: parsed.data.method,
      provider_refund_id: parsed.data.reference?.trim() || null,
      currency: booking.currency || "ZAR",
      reason: parsed.data.reason,
      reason_detail: parsed.data.reasonDetail?.trim() || null,
      initiated_by: "host",
      status: "approved",
      actioned_by: host.userId,
      actioned_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return {
      ok: false,
      error: insertErr?.message ?? "Couldn't create the refund.",
    };
  }

  const { error: completeErr } = await admin
    .from("refund_requests")
    .update(completionPatch(parsed.data.method))
    .eq("id", inserted.id);

  if (completeErr) return { ok: false, error: completeErr.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logFinanceEvent(admin, {
    hostId: host.hostId,
    actorId: user?.id ?? null,
    action: "refund.issue",
    bookingId: booking.id,
    entityType: "refund",
    entityId: inserted.id,
    amount: parsed.data.amount,
    currency: booking.currency || "ZAR",
    reason: parsed.data.reason,
    metadata: { method: parsed.data.method },
  });
  revalidatePath("/dashboard/refunds");
  revalidatePath(`/dashboard/bookings/${booking.id}`);
  return { ok: true };
}
