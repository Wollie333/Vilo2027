import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Minimal booking shape needed to resolve the guest's thread. */
export type CardBooking = {
  id: string;
  host_id: string;
  guest_id: string | null;
  property_id: string | null;
  quote_id?: string | null;
};

/**
 * Resolve the conversation to post a guest-facing system card into, in priority
 * order: the booking's quote thread (converted bookings) → an existing
 * non-archived host↔guest thread for the listing → a freshly created
 * conversation. Returns null when the booking has no registered guest/listing
 * (account-less manual bookings have no portal thread).
 *
 * Single source of truth for "which thread does this booking belong to" —
 * shared by the payment-confirmed card and the review-request card.
 */
export async function resolveGuestConversation(
  admin: Admin,
  booking: CardBooking,
): Promise<string | null> {
  if (!booking.guest_id || !booking.property_id) return null;

  if (booking.quote_id) {
    const { data: q } = await admin
      .from("quotes")
      .select("conversation_id")
      .eq("id", booking.quote_id)
      .maybeSingle();
    if (q?.conversation_id) return q.conversation_id;
  }

  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("host_id", booking.host_id)
    .eq("guest_id", booking.guest_id)
    .eq("property_id", booking.property_id)
    .neq("status", "archived")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (conv?.id) return conv.id;

  const { data: created } = await admin
    .from("conversations")
    .insert({
      host_id: booking.host_id,
      guest_id: booking.guest_id,
      property_id: booking.property_id,
      booking_id: booking.id,
      status: "open",
      is_enquiry: false,
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

/**
 * Post a system card (no human sender) into the guest's conversation thread.
 * Best-effort: swallows every error so payment / review flows never roll back
 * because of a messaging hiccup. Defaults: unread for the host, read for the
 * guest (most cards are guest-initiated or guest-known events).
 */
export async function postGuestSystemCard(
  admin: Admin,
  booking: CardBooking,
  card: {
    systemEvent: string;
    body: string;
    readByHost?: boolean;
    readByGuest?: boolean;
  },
): Promise<void> {
  try {
    const conversationId = await resolveGuestConversation(admin, booking);
    if (!conversationId) return;
    await admin.from("messages").insert({
      conversation_id: conversationId,
      sender_id: null,
      is_system_message: true,
      system_event: card.systemEvent,
      body: card.body,
      // Link the card to its booking so the thread can render a rich, self-
      // contained booking card (payment received, etc.).
      booking_id: booking.id,
      read_by_host: card.readByHost ?? false,
      read_by_guest: card.readByGuest ?? true,
    });
  } catch {
    // Intentionally swallowed — see doc comment.
  }
}
