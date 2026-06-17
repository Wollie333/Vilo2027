"use server";

import { headers } from "next/headers";

import { startBookingPayment } from "@/lib/payments/pay-booking";
import { createServerClient } from "@/lib/supabase/server";

export type PayResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

// Initialize payment for an ALREADY-CREATED booking that the SIGNED-IN guest
// owns (e.g. one auto-created when they accepted a quote). The shared
// startBookingPayment core (lib/payments/pay-booking.ts) does the actual work —
// host-Paystack init, EFT fallback, ledger-aware amounts — so this and the
// public /pay/[token] link stay in lockstep. Returns a URL to navigate to.
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
      "id, guest_id, listing_id, reference, scope, status, payment_status, total_amount, deposit_amount, currency, listing:properties ( name, host_id )",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.guest_id !== user.id) {
    return { ok: false, error: "Booking not found." };
  }

  const listing = (
    Array.isArray(booking.listing) ? booking.listing[0] : booking.listing
  ) as { name: string; host_id: string } | null;
  if (!listing) return { ok: false, error: "Listing unavailable." };

  return startBookingPayment({
    booking: {
      id: booking.id,
      reference: booking.reference,
      scope: booking.scope,
      status: booking.status,
      payment_status: booking.payment_status,
      total_amount: booking.total_amount,
      deposit_amount: booking.deposit_amount,
      currency: booking.currency,
      guest_id: booking.guest_id,
      listing_id: booking.listing_id,
      listing_name: listing.name,
      host_id: listing.host_id,
    },
    method: opts.method,
    amount: opts.amount,
    email: user.email,
    origin: headers().get("origin") ?? "",
    returnTo: `/booking/${booking.id}/success`,
  });
}
