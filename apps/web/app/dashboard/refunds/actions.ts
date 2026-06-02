"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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

const approveSchema = z.object({
  refundId: z.string().uuid(),
  amount: z.number().positive(),
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
  reason: z.string().min(1).max(200),
  reasonDetail: z.string().max(2000).optional().nullable(),
});

async function getMyHostId(): Promise<
  { ok: true; hostId: string } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) return { ok: false, error: "No host profile." };
  return { ok: true, hostId: host.id };
}

/**
 * Host approves a refund. Status flips to 'approved', then we immediately
 * move to 'processing' and 'completed' since real provider calls aren't
 * wired yet. When Paystack/PayPal go live, replace the optimistic transition
 * with a provider-call + webhook callback.
 */
export async function approveRefundAction(input: {
  refundId: string;
  amount: number;
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
  if (refund.status !== "pending" && refund.status !== "escalated") {
    return { ok: false, error: `Cannot approve a ${refund.status} refund.` };
  }
  if (parsed.data.amount > Number(refund.requested_amount)) {
    return {
      ok: false,
      error: "Approved amount can't exceed the requested amount.",
    };
  }

  // Two-step UPDATE because the status trigger logs each transition.
  // First: approved. Then: completed (since no real provider call yet).
  const { error: approveErr } = await supabase
    .from("refund_requests")
    .update({
      status: "approved",
      approved_amount: parsed.data.amount,
      host_note: parsed.data.note?.trim() || null,
      actioned_at: new Date().toISOString(),
    })
    .eq("id", refund.id);

  if (approveErr) return { ok: false, error: approveErr.message };

  // Optimistic completion — flag it as completed so payments.refunded_amount
  // updates via the existing v11 trigger. Marked as manual so the audit
  // trail shows it wasn't a provider transaction.
  const { error: completeErr } = await supabase
    .from("refund_requests")
    .update({
      status: "completed",
      is_manual: true,
      manual_sent_at: new Date().toISOString(),
      manual_note: "Pre-MVP: provider integration pending",
    })
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
  if (refund.status !== "pending" && refund.status !== "escalated") {
    return { ok: false, error: `Cannot decline a ${refund.status} refund.` };
  }

  const { error } = await supabase
    .from("refund_requests")
    .update({
      status: "declined",
      decline_reason: parsed.data.reason,
      host_note: parsed.data.note?.trim() || null,
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

  const { data: payment } = await supabase
    .from("payments")
    .select("id, status, amount")
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
      currency: booking.currency || "ZAR",
      reason: parsed.data.reason,
      reason_detail: parsed.data.reasonDetail?.trim() || null,
      initiated_by: "host",
      status: "approved",
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
    .update({
      status: "completed",
      is_manual: true,
      manual_sent_at: new Date().toISOString(),
      manual_note: "Host-initiated; pre-MVP provider integration pending",
    })
    .eq("id", inserted.id);

  if (completeErr) return { ok: false, error: completeErr.message };

  revalidatePath("/dashboard/refunds");
  revalidatePath(`/dashboard/bookings/${booking.id}`);
  return { ok: true };
}
