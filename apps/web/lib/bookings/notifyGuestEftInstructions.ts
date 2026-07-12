import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Email the guest their EFT payment instructions — the host's banking details +
 * the booking reference to use — the moment they reserve a booking by bank
 * transfer (status `pending_eft`, before any money moves). Without this the
 * guest only ever sees the details on the reserve-success screen; if they close
 * the tab they have no way back to pay, and the success page's "confirmation
 * emailed" promise is a lie.
 *
 * Sibling of {@link notifyHostNewBooking}; both fire from `persistBookingAndPay`
 * so every EFT creation path (app checkout, website checkout, deal page) mails
 * the guest uniformly. The `eft_instructions_guest` email + resolver already
 * existed and hydrate banking/booking from the booking_id — this just dispatches
 * the event. Best-effort: a notification failure must NEVER fail the booking.
 *
 * Only fires when the booking carries a `guest_id` (a registered account). The
 * session-less lead path (anonymous website checkout with no account) has no
 * user to resolve prefs for; those still get the on-screen details.
 */
export async function notifyGuestEftInstructions(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
): Promise<void> {
  try {
    const { data: bk } = await admin
      .from("bookings")
      .select("guest_id, property_id, status")
      .eq("id", bookingId)
      .maybeSingle();
    const row = bk as {
      guest_id: string | null;
      property_id: string | null;
      status: string | null;
    } | null;
    // Only EFT-reserved bookings need the transfer instructions, and only a
    // registered guest can receive a preference-routed notification.
    if (!row || row.status !== "pending_eft" || !row.guest_id) return;

    let listingName: string | null = null;
    if (row.property_id) {
      const { data: prop } = await admin
        .from("properties")
        .select("name")
        .eq("id", row.property_id)
        .maybeSingle();
      listingName = (prop as { name: string | null } | null)?.name ?? null;
    }

    const { dispatchEvent } = await import("@/lib/notifications/dispatch");
    await dispatchEvent({
      kind: "eft_instructions_guest",
      recipientUserId: row.guest_id,
      guestId: row.guest_id,
      refs: {
        booking_id: bookingId,
        ...(listingName ? { listing_name: listingName } : {}),
      },
      supabase: admin,
    });
  } catch {
    // non-blocking — never fail the booking on a notification error
  }
}
