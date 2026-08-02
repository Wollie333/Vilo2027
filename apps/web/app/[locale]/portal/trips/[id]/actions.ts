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
import { announceGuestBookingAction } from "@/lib/messaging/guest-request";
import { resolveGuestConversation } from "@/lib/messaging/system-card";
import { dispatchEvent } from "@/lib/notifications/dispatch";
import { formatMoney } from "@/lib/format";

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
      "id, host_id, guest_id, property_id, quote_id, reference, total_amount, currency, status, payment_status",
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

  // Include 'partially_refunded': a payment already partly refunded is still
  // refundable up to its remaining balance (the cap check below enforces it).
  const { data: payment } = await admin
    .from("payments")
    .select("id, status, amount, refunded_amount")
    .eq("booking_id", booking.id)
    .in("status", ["completed", "partially_refunded"])
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

  const { data: inserted, error } = await admin
    .from("refund_requests")
    .insert({
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
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Unified guest-action fan-out (same standard operation as every other guest
  // request): post an inbox system card into the host↔guest thread AND notify
  // the host (email + push + in-app). Previously the refund only dispatched a
  // notification — the thread showed nothing, so it was invisible in the inbox.
  const amountLabel = formatMoney(
    parsed.data.amount,
    booking.currency || "ZAR",
  );
  await announceGuestBookingAction(admin, {
    booking: {
      id: booking.id,
      host_id: booking.host_id,
      guest_id: booking.guest_id,
      property_id: booking.property_id,
      quote_id: booking.quote_id,
    },
    card: {
      systemEvent: "refund_requested",
      body: `💸 Refund requested — ${amountLabel}${booking.reference ? ` for ${booking.reference}` : ""}. Reason: ${parsed.data.reason}. Your host will review and respond here.`,
    },
    event: {
      kind: "refund_request_host",
      refs: {
        refund_id: inserted?.id,
        booking_id: booking.id,
        refund_amount: amountLabel,
      },
    },
  });

  revalidatePath(`/portal/trips/${booking.id}`);
  revalidatePath("/dashboard/refunds");
  return { ok: true };
}

// ─── Message host about a booking ─────────────────────────────────
// Compose modal from the trip page / trip cards. Resolves (or creates) the
// guest↔host thread for the booking, posts the guest's message into it, and
// notifies the host (new_message). The message is booking-linked so the host's
// booking detail can surface a "new message about this booking" banner.

const messageHostSchema = z.object({
  bookingId: z.string().uuid(),
  body: z.string().trim().min(1, "Type a message.").max(4000),
});

export async function messageHostAboutBookingAction(input: {
  bookingId: string;
  body: string;
}): Promise<Result> {
  const parsed = messageHostSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Message looks wrong.",
    };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, host_id, guest_id, property_id, quote_id")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();
  if (!booking || booking.guest_id !== user.id) {
    return { ok: false, error: "Booking not found." };
  }

  const conversationId = await resolveGuestConversation(admin, {
    id: booking.id,
    host_id: booking.host_id,
    guest_id: booking.guest_id,
    property_id: booking.property_id,
    quote_id: booking.quote_id,
  });
  if (!conversationId) {
    return { ok: false, error: "Couldn't open a thread for this booking." };
  }

  const { error: msgErr } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: parsed.data.body,
    booking_id: booking.id,
    read_by_guest: true,
    read_by_host: false,
  });
  if (msgErr) return { ok: false, error: "Could not send message. Try again." };

  // Notify the host (push + in-app + email per registry). Best-effort.
  try {
    const [{ data: hostRow }, { data: prof }] = await Promise.all([
      admin
        .from("hosts")
        .select("user_id")
        .eq("id", booking.host_id)
        .maybeSingle(),
      admin
        .from("user_profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    if (hostRow?.user_id) {
      await dispatchEvent({
        kind: "new_message",
        recipientUserId: hostRow.user_id,
        hostId: booking.host_id,
        refs: {
          conversation_id: conversationId,
          sender_first_name:
            prof?.full_name?.trim().split(/\s+/)[0] || "New message",
          message_body: parsed.data.body,
          unread_count: 1,
        },
        supabase: admin,
      });
    }
  } catch {
    // best-effort notification
  }

  revalidatePath(`/portal/trips/${booking.id}`);
  revalidatePath("/portal/inbox");
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
