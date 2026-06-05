"use server";

import { headers } from "next/headers";

import { initializeTransaction } from "@/lib/paystack";
import { hostHasValidEft } from "@/lib/payments/eft";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type PayResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

// Initialize payment for an ALREADY-CREATED booking (e.g. one auto-created when
// a guest accepted a quote). Mirrors the payment-init branch of
// app/listing/[slug]/book/actions.ts → createBookingAction, but for an existing
// booking and with a deposit/full choice. Returns a URL for the client to
// navigate to (Paystack checkout, or the booking success/EFT-details page).
export async function initializePaymentForBookingAction(
  bookingId: string,
  opts: { method: "paystack" | "eft"; amount: "deposit" | "full" },
): Promise<PayResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Sign in to pay." };

  // RLS scopes to the guest's own bookings, so a row coming back is proof of
  // ownership.
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, guest_id, listing_id, reference, scope, status, payment_status, total_amount, deposit_amount, currency, listing:listings ( name, host_id )",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.guest_id !== user.id) {
    return { ok: false, error: "Booking not found." };
  }
  if (booking.payment_status === "completed") {
    return { ok: false, error: "This booking is already paid." };
  }
  if (
    !["pending", "pending_eft"].includes(booking.status as string) &&
    booking.payment_status !== "failed"
  ) {
    return { ok: false, error: "This booking can't be paid right now." };
  }

  const listing = (
    Array.isArray(booking.listing) ? booking.listing[0] : booking.listing
  ) as { name: string; host_id: string } | null;
  if (!listing) return { ok: false, error: "Listing unavailable." };

  const total = Number(booking.total_amount);
  const deposit = Number(booking.deposit_amount ?? 0);
  const payNow =
    opts.amount === "deposit" && deposit > 0 && deposit < total
      ? deposit
      : total;
  // If paying in full, there's no outstanding balance; if a partial deposit,
  // the remainder is due before check-in.
  const balanceDue = payNow >= total ? 0 : total - payNow;

  const admin = createAdminClient();

  await admin
    .from("bookings")
    .update({ payment_method: opts.method, balance_due: balanceDue })
    .eq("id", booking.id);

  // Clear any stale pending payment rows from a prior attempt, then create a
  // fresh one for this attempt's amount + method.
  await admin
    .from("payments")
    .delete()
    .eq("booking_id", booking.id)
    .eq("status", "pending");

  const { data: payment, error: payErr } = await admin
    .from("payments")
    .insert({
      booking_id: booking.id,
      amount: payNow,
      currency: booking.currency,
      method: opts.method,
      status: "pending",
    })
    .select("id")
    .single();
  if (payErr || !payment) {
    return { ok: false, error: "Could not prepare payment. Try again." };
  }

  // EFT — no provider hop. Booking sits in pending_eft; the success page shows
  // the host's banking details + reference.
  if (opts.method === "eft") {
    await admin
      .from("bookings")
      .update({ status: "pending_eft" })
      .eq("id", booking.id);
    return { ok: true, redirectTo: `/booking/${booking.id}/success` };
  }

  // Paystack.
  const origin = headers().get("origin") ?? "";
  try {
    const init = await initializeTransaction({
      amount: payNow,
      currency: booking.currency,
      email: user.email,
      callbackUrl: `${origin}/booking/${booking.id}/success`,
      metadata: {
        booking_id: booking.id,
        payment_id: payment.id,
        listing_id: booking.listing_id,
        listing_name: listing.name,
        guest_id: user.id,
        reference: booking.reference,
        scope: booking.scope,
      },
    });
    await admin
      .from("payments")
      .update({ provider_reference: init.reference })
      .eq("id", payment.id);
    return { ok: true, redirectTo: init.authorization_url };
  } catch {
    // Gateway fallback: switch to EFT if the host has a valid account.
    if (await hostHasValidEft(listing.host_id)) {
      await admin
        .from("bookings")
        .update({ payment_method: "eft", status: "pending_eft" })
        .eq("id", booking.id);
      await admin
        .from("payments")
        .update({ method: "eft" })
        .eq("id", payment.id);
      return { ok: true, redirectTo: `/booking/${booking.id}/success` };
    }
    return {
      ok: false,
      error: "Couldn't reach the payment provider. Try again in a moment.",
    };
  }
}
