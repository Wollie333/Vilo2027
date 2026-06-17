"use server";

import { headers } from "next/headers";

import {
  startBookingPayment,
  type StartBookingPaymentResult,
} from "@/lib/payments/pay-booking";
import { createAdminClient } from "@/lib/supabase/admin";

// Public, token-authenticated card payment for an existing booking — the
// engine behind the host-shareable /pay/[token] link. No session: possession of
// the unguessable pay_token is the authorisation. All money mechanics (host
// Paystack init, EFT fallback, ledger-aware amount) live in the shared
// startBookingPayment core, so this stays in lockstep with the signed-in flow.
export async function initializePayByTokenAction(
  token: string,
): Promise<StartBookingPaymentResult> {
  if (!token || token.length < 10) {
    return { ok: false, error: "This payment link is no longer valid." };
  }
  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, reference, scope, status, payment_status, total_amount, deposit_amount, currency, guest_id, guest_email, listing_id, listing:properties ( name, host_id )",
    )
    .eq("pay_token", token)
    .maybeSingle();
  if (!booking) {
    return { ok: false, error: "This payment link is no longer valid." };
  }
  const listing = (
    Array.isArray(booking.listing) ? booking.listing[0] : booking.listing
  ) as { name: string; host_id: string } | null;
  if (!listing) return { ok: false, error: "Listing unavailable." };
  if (!booking.guest_email) {
    return {
      ok: false,
      error: "No email is on file for this booking — please ask your host.",
    };
  }

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
    method: "paystack",
    amount: "full",
    email: booking.guest_email,
    origin: headers().get("origin") ?? "",
    returnTo: `/pay/${token}`,
  });
}
