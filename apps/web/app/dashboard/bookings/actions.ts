"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

export type BookingActionResult = { ok: true } | { ok: false; error: string };

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
    .select("id, status")
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
