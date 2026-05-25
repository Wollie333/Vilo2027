"use server";

import { revalidatePath } from "next/cache";

import { enqueueInAppNotification } from "@/lib/notifications/enqueue";
import { createServerClient } from "@/lib/supabase/server";

export type BookingActionResult = { ok: true } | { ok: false; error: string };

type NotifyTarget = {
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  link?: string;
};

const NOTIFY_AFTER: Partial<
  Record<keyof typeof TRANSITIONS, (b: BookingRow) => NotifyTarget[]>
> = {
  confirm: (b) =>
    b.guest_id
      ? [
          {
            userId: b.guest_id,
            kind: "booking_confirmed_guest",
            title: "Your booking is confirmed",
            body: b.reference
              ? `Reference ${b.reference} — your stay is locked in.`
              : "Your stay is locked in.",
            link: `/my-trips/${b.id}`,
          },
        ]
      : [],
  decline: (b) =>
    b.guest_id
      ? [
          {
            userId: b.guest_id,
            kind: "booking_declined_guest",
            title: "Booking request declined",
            body: b.reference
              ? `Reference ${b.reference} — the host couldn't accept this stay.`
              : "The host couldn't accept this stay.",
            link: `/my-trips/${b.id}`,
          },
        ]
      : [],
  cancel: (b) =>
    b.guest_id
      ? [
          {
            userId: b.guest_id,
            kind: "booking_cancelled_guest",
            title: "Booking cancelled by the host",
            body: b.reference
              ? `Reference ${b.reference} — please check your refund email.`
              : "Please check your refund email.",
            link: `/my-trips/${b.id}`,
          },
        ]
      : [],
};

type BookingRow = {
  id: string;
  status: string;
  reference: string | null;
  guest_id: string | null;
};

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

  const notifyFn = NOTIFY_AFTER[kind];
  if (notifyFn) {
    const targets = notifyFn(booking as BookingRow);
    await Promise.all(targets.map((t) => enqueueInAppNotification(t)));
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
export async function cancelBookingAction(bookingId: string) {
  return applyTransition(bookingId, "cancel");
}
export async function checkInBookingAction(bookingId: string) {
  return applyTransition(bookingId, "checkIn");
}
export async function checkOutBookingAction(bookingId: string) {
  return applyTransition(bookingId, "checkOut");
}
