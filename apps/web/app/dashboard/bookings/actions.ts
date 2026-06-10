"use server";

import { revalidatePath } from "next/cache";

import {
  finalizeCancellation,
  policyRefundFor,
  type PolicyRefund,
} from "@/lib/bookings/cancel";
import { dispatchEvent } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

// How long after checkout the guest's review request is sent. The review
// request worker drains review_request_queue rows once send_at has passed.
const REVIEW_REQUEST_DELAY_MS = 5 * 60 * 1000;

export type BookingActionResult = { ok: true } | { ok: false; error: string };

// Per-transition mapping: which registry event kind fires for which
// transition. The dispatcher routes through email + push + in-app per the
// guest's category preferences; the email side hydrates listing_name etc.
// from booking_id via apps/web/lib/email/resolvers/booking.ts.
//
// `as const` narrows the value type to the union of these three literal
// event kinds so dispatchEvent's RefsFor<K> narrows to BookingRefs (rather
// than the intersection of all event refs).
const NOTIFY_KIND = {
  confirm: "booking_confirmed_guest",
  decline: "booking_declined_guest",
  cancel: "booking_cancelled_guest",
  // NB: checkout does NOT notify here — it enqueues a delayed review request
  // (checkout + 5 min) into review_request_queue; see enqueueReviewRequest.
} as const;

type Transition = {
  from: ReadonlyArray<string>;
  to: string;
  setField?: Record<string, string>;
};

const TRANSITIONS: Record<
  "confirm" | "decline" | "cancel" | "checkIn" | "checkOut",
  Transition
> = {
  confirm: {
    from: ["pending"] as const,
    to: "confirmed",
    setField: { confirmed_at: "now" },
  },
  decline: {
    from: ["pending"] as const,
    to: "declined",
    setField: { declined_at: "now" },
  },
  cancel: {
    from: ["confirmed", "checked_in"] as const,
    to: "cancelled_by_host",
    setField: { cancelled_at: "now", cancelled_by: "host" },
  },
  checkIn: {
    from: ["confirmed"] as const,
    to: "checked_in",
    setField: { checked_in_at: "now" },
  },
  checkOut: {
    from: ["checked_in"] as const,
    to: "completed",
    setField: { checked_out_at: "now" },
  },
};

// Schedule the post-checkout review request (checkout + 5 min). Uses the admin
// client because review_request_queue is service-role-only; ignores conflicts
// so a backstop-cron row (or a re-run) never double-schedules. Best-effort —
// a queue hiccup must not fail the checkout itself.
async function enqueueReviewRequest(
  bookingId: string,
  guestId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("review_request_queue").upsert(
      {
        booking_id: bookingId,
        guest_id: guestId,
        send_at: new Date(Date.now() + REVIEW_REQUEST_DELAY_MS).toISOString(),
      },
      { onConflict: "booking_id", ignoreDuplicates: true },
    );
  } catch {
    // Swallowed — the daily backstop cron will pick the booking up.
  }
}

async function applyTransition(
  bookingId: string,
  kind: keyof typeof TRANSITIONS,
): Promise<BookingActionResult> {
  const supabase = createServerClient();

  // RLS host_manage_own_bookings — the SELECT enforces ownership.
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, reference, guest_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) {
    return { ok: false, error: "Booking not found." };
  }

  const transition = TRANSITIONS[kind];
  if (!transition.from.includes(booking.status)) {
    return {
      ok: false,
      error: `Can't ${kind} a booking that's already ${booking.status.replace(/_/g, " ")}.`,
    };
  }

  const patch: Record<string, unknown> = {
    status: transition.to,
    previous_status: booking.status,
  };
  if (transition.setField) {
    const now = new Date().toISOString();
    for (const [k, v] of Object.entries(transition.setField)) {
      patch[k] = v === "now" ? now : v;
    }
  }

  const { error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", bookingId)
    .eq("status", booking.status); // optimistic concurrency
  if (error) {
    return { ok: false, error: "Could not update booking. Try again." };
  }

  const notifyKind = NOTIFY_KIND[kind as keyof typeof NOTIFY_KIND];
  if (notifyKind && booking.guest_id) {
    await dispatchEvent({
      kind: notifyKind,
      recipientUserId: booking.guest_id,
      guestId: booking.guest_id,
      // Thin refs: drain.ts → bookingResolver hydrates the rest for email.
      // In-app/push builders gracefully fall back when listing_name is absent.
      refs: { booking_id: booking.id },
    });
  }

  // Checkout → schedule the review request for 5 minutes from now. The worker
  // re-validates (paid + no existing review) before sending, so enqueueing is
  // safe even if eligibility changes. Account-less guests have no portal to
  // review from, so they're skipped.
  if (kind === "checkOut" && booking.guest_id) {
    await enqueueReviewRequest(booking.id, booking.guest_id);
  }

  revalidatePath(`/dashboard/bookings/${bookingId}`);
  revalidatePath("/dashboard/bookings");
  return { ok: true };
}

export async function confirmBookingAction(bookingId: string) {
  return applyTransition(bookingId, "confirm");
}
export async function declineBookingAction(bookingId: string) {
  return applyTransition(bookingId, "decline");
}
// Host cancellation runs the enterprise flow: policy-entitled refund, calendar
// release (via trigger) and guest notification — not the bare status flip.
export async function cancelBookingAction(
  bookingId: string,
  reason?: string,
): Promise<BookingActionResult> {
  const supabase = createServerClient();
  // RLS host_manage_own_bookings — only the owning host can read this row.
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, host_id, guest_id, status, currency, total_amount")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found." };

  const res = await finalizeCancellation(booking, "host", reason ?? null);
  if (!res.ok) return res;

  revalidatePath(`/dashboard/bookings/${bookingId}`);
  revalidatePath("/dashboard/bookings");
  return { ok: true };
}

// The policy-entitled refund a host/guest would get by cancelling now — drives
// the confirmation modal's "guest will be refunded R X" line.
export async function previewCancelRefundAction(
  bookingId: string,
): Promise<{ ok: true; refund: PolicyRefund } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found." };
  return { ok: true, refund: await policyRefundFor(bookingId) };
}
export async function checkInBookingAction(bookingId: string) {
  return applyTransition(bookingId, "checkIn");
}
export async function checkOutBookingAction(bookingId: string) {
  return applyTransition(bookingId, "checkOut");
}

// Sets the guest-facing welcome note on a booking (bookings.host_message),
// shown as "a note from your host" on the guest's Trip Details page. RLS
// host_manage_own_bookings enforces ownership on the UPDATE — a non-owner's
// update simply matches zero rows.
export async function updateBookingHostMessageAction(
  bookingId: string,
  message: string,
): Promise<BookingActionResult> {
  const text = message.trim();
  if (text.length > 2000) {
    return { ok: false, error: "Note is too long (max 2000 characters)." };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("bookings")
    .update({ host_message: text.length > 0 ? text : null })
    .eq("id", bookingId);
  if (error) {
    return { ok: false, error: "Could not save the note. Try again." };
  }

  revalidatePath(`/dashboard/bookings/${bookingId}`);
  return { ok: true };
}

// Adds a host-only internal note to a booking. booking_notes is gated by the
// host_manage_booking_notes RLS policy (host of the parent booking only), so
// ownership is enforced at the row level — no extra check needed here.
export async function addBookingNoteAction(
  bookingId: string,
  body: string,
): Promise<BookingActionResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Note can't be empty." };
  if (text.length > 2000) {
    return { ok: false, error: "Note is too long (max 2000 characters)." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("booking_notes").insert({
    booking_id: bookingId,
    author_id: user.id,
    body: text,
  });
  if (error) {
    return { ok: false, error: "Could not save note. Try again." };
  }

  revalidatePath(`/dashboard/bookings/${bookingId}`);
  return { ok: true };
}
