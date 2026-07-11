import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Notify the host that a NEW booking has been created — fired at creation time,
 * while the booking is still pending / pending_eft (before payment settles), so
 * the host can act on it (chase the EFT, prep the stay, decline…).
 *
 * Self-contained: resolves the host's auth user, the listing name and — for a
 * special/deal booking — the special's title straight from the booking row, so
 * every creation path (app guest checkout, website checkout, deal page) can call
 * it uniformly through `persistBookingAndPay`. Best-effort: a notification
 * failure must NEVER fail the booking or the payment redirect.
 */
export async function notifyHostNewBooking(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
): Promise<void> {
  try {
    const { data: bk } = await admin
      .from("bookings")
      .select("host_id, property_id, special_id, guest_name")
      .eq("id", bookingId)
      .maybeSingle();
    const row = bk as {
      host_id: string | null;
      property_id: string | null;
      special_id: string | null;
      guest_name: string | null;
    } | null;
    if (!row?.host_id) return;

    const { data: host } = await admin
      .from("hosts")
      .select("user_id")
      .eq("id", row.host_id)
      .maybeSingle();
    const userId = (host as { user_id: string | null } | null)?.user_id;
    if (!userId) return;

    let specialTitle: string | null = null;
    if (row.special_id) {
      const { data: sp } = await admin
        .from("specials")
        .select("title")
        .eq("id", row.special_id)
        .maybeSingle();
      specialTitle = (sp as { title: string | null } | null)?.title ?? null;
    }

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
      kind: "booking_request_host",
      recipientUserId: userId,
      refs: {
        booking_id: bookingId,
        ...(specialTitle ? { special_title: specialTitle } : {}),
        ...(row.guest_name ? { guest_first_name: row.guest_name } : {}),
        ...(listingName ? { listing_name: listingName } : {}),
      },
      hostId: row.host_id,
      supabase: admin,
    });
  } catch {
    // non-blocking — never fail the booking on a notification error
  }
}
