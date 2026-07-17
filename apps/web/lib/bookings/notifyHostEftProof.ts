import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Notify the host that the guest has uploaded proof of their EFT transfer, so
 * the host can verify it and mark the booking paid.
 *
 * Sibling of {@link notifyHostNewBooking} / {@link notifyGuestEftInstructions},
 * and resolves the host's auth user the same way. The `eft_proof_received_host`
 * email, resolver, registry entry and notification seed all already existed —
 * nothing had ever dispatched the event, because nothing could upload a proof.
 * Best-effort: a notification failure must NEVER fail the upload.
 */
export async function notifyHostEftProof(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
): Promise<void> {
  try {
    const { data: bk } = await admin
      .from("bookings")
      .select("host_id, property_id, guest_name")
      .eq("id", bookingId)
      .maybeSingle();
    const row = bk as {
      host_id: string | null;
      property_id: string | null;
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
      kind: "eft_proof_received_host",
      recipientUserId: userId,
      refs: {
        booking_id: bookingId,
        ...(row.guest_name ? { guest_first_name: row.guest_name } : {}),
        ...(listingName ? { listing_name: listingName } : {}),
      },
      hostId: row.host_id,
      supabase: admin,
    });
  } catch {
    // non-blocking — never fail the upload on a notification error
  }
}
