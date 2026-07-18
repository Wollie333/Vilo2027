import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// The subscription statuses under which a host may still RECEIVE new bookings.
//   trialing / active — paid & current.
//   past_due          — a charge failed but the host is still inside the grace
//                       window; we keep intake ON to give them a chance to fix
//                       the card without losing bookings (standard dunning).
// Everything else (restricted / paused / cancelled / expired) is a DISABLED
// host: their data + existing bookings are fully retained, but NEW booking
// intake is blocked until they reactivate. Nothing is ever deleted by this —
// deletion is only ever the manual admin purge, which is unrelated.
export const BOOKING_ACTIVE_STATUSES = [
  "trialing",
  "active",
  "past_due",
] as const;

/**
 * True when the host holds a membership that still permits taking new bookings.
 *
 * Security: server-only, runs on the service-role admin client, so the client
 * can never influence the result. It is called from the authoritative booking
 * choke points (persistBookingAndPay + priceBooking + quote accept), which a
 * client cannot bypass. Fails CLOSED on a definitive "no active membership"
 * (returns false); fails OPEN only on an infrastructure error, so a genuinely
 * paying host is never denied a booking because of a transient DB blip.
 */
export async function hostAcceptsBookings(
  admin: Admin,
  hostId: string | null | undefined,
): Promise<boolean> {
  if (!hostId) return false; // no host → nothing to book against (fail closed)

  // Publicly suppressed (admin HID them, or SUSPENDED them) → never bookable,
  // regardless of subscription. priceBooking/persist run on the service-role
  // client which bypasses RLS, so a direct booking call with a hidden/suspended
  // host's property id must be blocked here explicitly. Uses the same DB
  // predicate that drives the public-read RLS (single source of truth).
  const { data: suppressed, error: supErr } = await admin.rpc(
    "host_public_suppressed",
    { p_host_id: hostId },
  );
  if (!supErr && suppressed === true) return false;

  const { data, error } = await admin
    .from("subscriptions")
    .select("id")
    .eq("host_id", hostId)
    .in("status", BOOKING_ACTIVE_STATUSES as unknown as string[])
    .limit(1);

  if (error) {
    // Infrastructure error — we genuinely don't know the status. Don't punish a
    // paying host for a DB blip; allow, but leave a trail.
    console.error(
      `[hostAcceptsBookings] status read failed for host ${hostId}: ${error.message}`,
    );
    return true;
  }

  return (data?.length ?? 0) > 0;
}

/** The guest-facing message shown when a disabled host's listing is booked. */
export const HOST_NOT_ACCEPTING_MESSAGE =
  "This host isn’t currently accepting new bookings. Please check back soon.";
