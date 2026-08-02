import "server-only";

import { dispatchEvent } from "@/lib/notifications/dispatch";
import type { EventKind, RefsFor } from "@/lib/notifications/registry";
import type { createAdminClient } from "@/lib/supabase/admin";

import { postGuestSystemCard, type CardBooking } from "./system-card";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The ONE fan-out for a guest action on a booking (refund, date/guest change,
 * add-on, message) — the standard operation the whole product uses:
 *   1. post an inbox system card into the guest↔host thread, and
 *   2. dispatch a host notification (in-app + push + email per the registry).
 *
 * Callers insert their own request/charge row first (refund_requests /
 * booking_requests / a ledger line), then call this so every surface behaves
 * the same. Best-effort: a messaging/notification hiccup never rolls back the
 * caller's write (postGuestSystemCard + dispatchEvent already swallow errors;
 * the host lookup is guarded too).
 */
export async function announceGuestBookingAction<K extends EventKind>(
  admin: Admin,
  args: {
    booking: CardBooking;
    card: {
      systemEvent: string;
      body: string;
      readByHost?: boolean;
      readByGuest?: boolean;
    };
    event: { kind: K; refs: RefsFor<K> };
  },
): Promise<void> {
  // 1. Inbox system card (host unread by default → lights the thread + banner).
  await postGuestSystemCard(admin, args.booking, {
    readByHost: false,
    readByGuest: true,
    ...args.card,
  });

  // 2. Host notification — recipient is the host's auth user.
  try {
    const { data: h } = await admin
      .from("hosts")
      .select("user_id")
      .eq("id", args.booking.host_id)
      .maybeSingle();
    const recipientUserId = h?.user_id as string | undefined;
    if (recipientUserId) {
      await dispatchEvent({
        kind: args.event.kind,
        recipientUserId,
        refs: args.event.refs,
        hostId: args.booking.host_id,
        supabase: admin,
      });
    }
  } catch {
    // Swallowed — the caller's write must survive a notification hiccup.
  }
}
