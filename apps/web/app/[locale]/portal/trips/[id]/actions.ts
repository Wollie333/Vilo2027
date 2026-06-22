"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  finalizeCancellation,
  policyRefundFor,
  type PolicyRefund,
} from "@/lib/bookings/cancel";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

const requestRefundSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string().min(3).max(200),
  reasonDetail: z.string().max(2000).optional().nullable(),
});

export async function requestRefundAction(input: {
  bookingId: string;
  amount: number;
  reason: string;
  reasonDetail?: string | null;
}): Promise<Result> {
  const parsed = requestRefundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Authorize: booking must belong to this guest. RLS already enforces but
  // we surface a friendlier error.
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, host_id, guest_id, total_amount, currency, status, payment_status",
    )
    .eq("id", parsed.data.bookingId)
    .maybeSingle();
  if (!booking || booking.guest_id !== user.id) {
    return { ok: false, error: "Booking not found." };
  }

  if (parsed.data.amount > Number(booking.total_amount)) {
    return {
      ok: false,
      error: "Refund can't exceed the booking total.",
    };
  }

  // Use admin client to look up the captured payment + insert the refund
  // request (the guest_create_refund RLS policy permits inserts via the
  // user-bound client too, but we need admin to find the payment row
  // across host scope without RLS bouncing us).
  const admin = createAdminClient();

  const { data: payment } = await admin
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
      error:
        "No captured payment found for this booking yet — refunds open once payment clears.",
    };
  }
  // Can't request more than was captured on this payment (less prior refunds).
  const remaining =
    Math.round(
      (Number(payment.amount) - Number(payment.refunded_amount ?? 0)) * 100,
    ) / 100;
  if (parsed.data.amount > Math.max(0, remaining)) {
    return {
      ok: false,
      error: "Refund can't exceed what you paid on this booking.",
    };
  }

  const { data: existing } = await admin
    .from("refund_requests")
    .select("id, status")
    .eq("booking_id", booking.id)
    .in("status", ["pending", "approved", "processing"])
    .maybeSingle();

  if (existing) {
    return {
      ok: false,
      error: `You already have a ${existing.status} refund request for this booking.`,
    };
  }

  const { error } = await admin.from("refund_requests").insert({
    booking_id: booking.id,
    payment_id: payment.id,
    host_id: booking.host_id,
    guest_id: user.id,
    requested_amount: parsed.data.amount,
    currency: booking.currency || "ZAR",
    reason: parsed.data.reason,
    reason_detail: parsed.data.reasonDetail?.trim() || null,
    initiated_by: "guest",
    status: "pending",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/portal/trips/${booking.id}`);
  revalidatePath("/dashboard/refunds");
  return { ok: true };
}

// ─── Guest-initiated cancellation ─────────────────────────────────
// The guest cancels their own booking from the portal. Verifies ownership in
// code (guests have no RLS update on bookings), then runs the shared enterprise
// flow: policy refund + calendar release + host notification.

type GuestBooking = {
  id: string;
  host_id: string;
  guest_id: string | null;
  status: string;
  currency: string | null;
  total_amount: number | string;
};

async function loadGuestBooking(
  bookingId: string,
): Promise<{ ok: true; booking: GuestBooking } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, host_id, guest_id, status, currency, total_amount")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.guest_id !== user.id) {
    return { ok: false, error: "Booking not found." };
  }
  return { ok: true, booking };
}

export async function previewMyCancelRefundAction(
  bookingId: string,
): Promise<{ ok: true; refund: PolicyRefund } | { ok: false; error: string }> {
  const loaded = await loadGuestBooking(bookingId);
  if (!loaded.ok) return loaded;
  return { ok: true, refund: await policyRefundFor(bookingId) };
}

export async function cancelMyBookingAction(input: {
  bookingId: string;
  reason?: string | null;
}): Promise<Result> {
  const loaded = await loadGuestBooking(input.bookingId);
  if (!loaded.ok) return loaded;

  const res = await finalizeCancellation(
    loaded.booking,
    "guest",
    input.reason ?? null,
  );
  if (!res.ok) return res;

  revalidatePath(`/portal/trips/${input.bookingId}`);
  revalidatePath("/portal/trips");
  return { ok: true };
}
