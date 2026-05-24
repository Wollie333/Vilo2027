"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

import {
  manualBookingSchema,
  type ManualBookingInput,
} from "../../quotes/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function createManualBookingAction(
  input: ManualBookingInput,
): Promise<ActionResult<{ bookingId: string }>> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = manualBookingSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) return { ok: false, error: "No host profile." };

  const { data: listing } = await supabase
    .from("listings")
    .select("id, host_id")
    .eq("id", parsed.data.listing_id)
    .maybeSingle();
  if (!listing || listing.host_id !== host.id) {
    return { ok: false, error: "Listing not found." };
  }

  const addonsTotal = parsed.data.addons.reduce(
    (s, a) => s + a.quantity * a.unit_price,
    0,
  );
  const total =
    parsed.data.base_amount + parsed.data.cleaning_fee + addonsTotal;

  // payment_state controls how the booking lands:
  //  - paid: status=confirmed, payment_status=completed, host_payment_note set
  //  - unpaid: status=confirmed, payment_status=pending
  //  - send_paystack_link: status=pending, payment_status=pending (Paystack
  //    init for the link is a follow-up — log a TODO note so the host knows
  //    to send the link manually for now).
  const paymentStatus =
    parsed.data.payment_state === "paid" ? "completed" : "pending";
  const bookingStatus =
    parsed.data.payment_state === "send_paystack_link"
      ? "pending"
      : "confirmed";

  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .insert({
      host_id: host.id,
      listing_id: parsed.data.listing_id,
      guest_id: null,
      guest_name: parsed.data.guest_name,
      guest_email: parsed.data.guest_email,
      guest_phone: parsed.data.guest_phone || null,
      origin: "host_manual",
      scope: parsed.data.scope,
      check_in: parsed.data.check_in,
      check_out: parsed.data.check_out,
      guests_count: parsed.data.headcount,
      base_amount: parsed.data.base_amount,
      cleaning_fee: parsed.data.cleaning_fee,
      total_amount: total,
      currency: parsed.data.currency,
      payment_status: paymentStatus,
      host_payment_note:
        parsed.data.payment_state === "paid"
          ? parsed.data.payment_note || null
          : null,
      special_requests: parsed.data.notes || null,
      status: bookingStatus,
      confirmed_at:
        bookingStatus === "confirmed" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (bookErr || !booking) {
    return { ok: false, error: "Could not create the booking." };
  }

  if (parsed.data.scope === "rooms" && parsed.data.rooms.length > 0) {
    await supabase.from("booking_rooms").insert(
      parsed.data.rooms.map((r) => ({
        booking_id: booking.id,
        room_id: r.room_id,
        base_amount: r.base_amount,
        cleaning_fee: r.cleaning_fee,
      })),
    );
  }

  if (parsed.data.addons.length > 0) {
    await supabase.from("booking_addons").insert(
      parsed.data.addons.map((a, i) => ({
        booking_id: booking.id,
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        sort_order: i,
      })),
    );
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return { ok: true, data: { bookingId: booking.id } };
}
