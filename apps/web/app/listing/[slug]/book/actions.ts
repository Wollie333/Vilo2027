"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { initializeTransaction } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { createBookingSchema, type CreateBookingInput } from "./schemas";

export type CreateBookingResult = { ok: true } | { ok: false; error: string };

function nightsBetween(checkIn: string, checkOut: string): number {
  const f = new Date(`${checkIn}T00:00:00Z`).getTime();
  const t = new Date(`${checkOut}T00:00:00Z`).getTime();
  const n = Math.round((t - f) / (1000 * 60 * 60 * 24));
  return n;
}

export async function createBookingAction(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  const d = parsed.data;

  // 1. Auth.
  const userClient = createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user || !user.email) {
    return { ok: false, error: "Sign in to complete your booking." };
  }

  // 2. Fetch listing — public RLS read of a published listing.
  const { data: listing } = await userClient
    .from("listings")
    .select(
      "id, host_id, name, base_price, cleaning_fee, currency, max_guests, min_nights, is_published",
    )
    .eq("id", d.listing_id)
    .maybeSingle();

  if (!listing || !listing.is_published) {
    return { ok: false, error: "This listing isn't available." };
  }
  if (listing.base_price == null) {
    return {
      ok: false,
      error: "This listing has no price set yet — message the host.",
    };
  }
  if (listing.max_guests != null && d.guests > listing.max_guests) {
    return {
      ok: false,
      error: `This listing sleeps up to ${listing.max_guests} guests.`,
    };
  }

  // 3. Server-side date + price recalc (never trust the client per AGENT_RULES §1.2).
  const nights = nightsBetween(d.check_in, d.check_out);
  if (nights <= 0) {
    return { ok: false, error: "Check-out must be after check-in." };
  }
  const minNights = listing.min_nights ?? 1;
  if (nights < minNights) {
    return {
      ok: false,
      error: `Minimum stay is ${minNights} ${minNights === 1 ? "night" : "nights"}.`,
    };
  }

  const baseAmount = Number(listing.base_price) * nights;
  const cleaning = Number(listing.cleaning_fee ?? 0);
  const totalAmount = baseAmount + cleaning;

  // 4. Admin client — RLS doesn't expose an insert path for guests on bookings.
  const admin = createAdminClient();

  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .insert({
      listing_id: listing.id,
      host_id: listing.host_id,
      guest_id: user.id,
      check_in: d.check_in,
      check_out: d.check_out,
      guests_count: d.guests,
      base_amount: baseAmount,
      cleaning_fee: cleaning,
      total_amount: totalAmount,
      currency: listing.currency,
      payment_method: d.payment_method,
      status: "pending",
      payment_status: "pending",
    })
    .select("id, reference")
    .single();
  if (bookingErr || !booking) {
    return { ok: false, error: "Could not start your booking. Try again." };
  }

  // 5. Create a pending payment row. provider_reference filled after init.
  const { data: payment, error: paymentErr } = await admin
    .from("payments")
    .insert({
      booking_id: booking.id,
      amount: totalAmount,
      currency: listing.currency,
      method: d.payment_method,
      status: "pending",
    })
    .select("id")
    .single();
  if (paymentErr || !payment) {
    // Roll back the booking so retry works cleanly.
    await admin.from("bookings").delete().eq("id", booking.id);
    return { ok: false, error: "Could not prepare payment. Try again." };
  }

  // 6. Initialize Paystack transaction.
  const origin = headers().get("origin") ?? "";
  let initResult;
  try {
    initResult = await initializeTransaction({
      amount: totalAmount,
      currency: listing.currency,
      email: user.email,
      callbackUrl: `${origin}/booking/${booking.id}/success`,
      metadata: {
        booking_id: booking.id,
        payment_id: payment.id,
        listing_id: listing.id,
        listing_name: listing.name,
        guest_id: user.id,
        reference: booking.reference,
      },
    });
  } catch {
    // Paystack init failed — roll back booking + payment so retry works.
    await admin.from("payments").delete().eq("id", payment.id);
    await admin.from("bookings").delete().eq("id", booking.id);
    return {
      ok: false,
      error: "Couldn't reach Paystack. Try again in a moment.",
    };
  }

  // 7. Stash Paystack's reference for webhook idempotency.
  await admin
    .from("payments")
    .update({ provider_reference: initResult.reference })
    .eq("id", payment.id);

  // 8. Off to Paystack. Guest pays; webhook flips status to confirmed.
  redirect(initResult.authorization_url);
}
