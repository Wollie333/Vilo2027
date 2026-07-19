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

/** Load the CardBooking + reference + listing name for a booking-lifecycle
 * card. Returns null for a booking that can't be resolved. */
async function loadCardBooking(
  admin: Admin,
  bookingId: string,
): Promise<{
  booking: CardBooking;
  reference: string;
  listingName: string;
  status: string;
} | null> {
  const { data: b } = await admin
    .from("bookings")
    .select(
      "id, reference, status, host_id, guest_id, property_id, quote_id, listing:properties ( name )",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!b) return null;
  const listingName =
    (
      (Array.isArray(b.listing) ? b.listing[0] : b.listing) as {
        name: string;
      } | null
    )?.name ?? "your stay";
  return {
    booking: {
      id: b.id,
      host_id: b.host_id,
      guest_id: b.guest_id,
      property_id: b.property_id,
      quote_id: b.quote_id,
    },
    reference: b.reference,
    listingName,
    status: b.status,
  };
}

/**
 * Post a one-time "Payment received — booking confirmed" system card into the
 * guest's conversation thread. Emitted by BOTH settle paths so the thread shows
 * the same rich card whether the guest paid their own card/PayPal
 * (confirmHostCardPaymentByReference / capturePayPalOrderForBooking) or the host
 * marked an EFT / manual payment received (confirmBookingIfPending). The card is
 * booking-linked (via postGuestSystemCard), so ChatMessageWall renders the rich
 * BookingTxnCard (variant "paid"). Best-effort — never rolls back a payment.
 */
export async function postPaymentConfirmedCard(
  admin: Admin,
  bookingId: string,
): Promise<void> {
  const loaded = await loadCardBooking(admin, bookingId);
  if (!loaded) return;
  const body = `✅ Payment received — your booking ${loaded.reference} at ${loaded.listingName} is confirmed. Open your booking above to view your trip details and invoice.`;

  // FLIP any existing pending card for this booking in place (mirrors the
  // platform payment thread — adminMarkProductPayment). An EFT booking posted a
  // `payment_pending` card on reserve; leaving it beside a fresh received card
  // would strand a stale amber "Complete payment" card next to the green paid
  // one. Flip it → payment_received so the single card transitions pending→paid.
  try {
    const { data: flipped } = await admin
      .from("messages")
      .update({
        system_event: "payment_received",
        body,
        read_by_host: false,
        read_by_guest: true,
      })
      .eq("booking_id", bookingId)
      .eq("system_event", "payment_pending")
      .eq("is_system_message", true)
      .select("id");
    if (flipped && flipped.length > 0) return;
  } catch {
    // fall through to inserting a fresh card
  }

  // No pending card to flip (the card/PayPal self-serve path never posts one) —
  // insert a fresh received card.
  await postGuestSystemCard(admin, loaded.booking, {
    systemEvent: "payment_received",
    body,
    // Guest just paid (they know); the host should see the unread nudge.
    readByHost: false,
    readByGuest: true,
  });
}

/**
 * Post a "we've reserved your booking — complete your EFT transfer" pending
 * card into the guest's thread the moment a booking is reserved by bank
 * transfer (status `pending_eft`). Parity with the card/PayPal path, whose
 * confirmed card already lands in-thread; without this an EFT guest saw no
 * thread card until (if) the host later confirmed. Self-gating: only posts for a
 * `pending_eft` booking, so it's safe to call unconditionally from the shared
 * persist tail (no-ops for card/PayPal). ChatMessageWall renders the rich
 * BookingTxnCard (variant "pending"). Best-effort.
 */
export async function postPaymentPendingCard(
  admin: Admin,
  bookingId: string,
): Promise<void> {
  const loaded = await loadCardBooking(admin, bookingId);
  if (!loaded || loaded.status !== "pending_eft") return;
  await postGuestSystemCard(admin, loaded.booking, {
    systemEvent: "payment_pending",
    body: `⏳ We've reserved booking ${loaded.reference} at ${loaded.listingName}. Complete your EFT transfer to confirm it — we'll update this thread once it reflects.`,
    // Both sides get an unread nudge: the guest still owes the transfer, the
    // host has a booking awaiting payment.
    readByHost: false,
    readByGuest: false,
  });
}
