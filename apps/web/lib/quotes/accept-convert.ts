import { recomputeBookingPaymentState } from "@/lib/payments/ledger";
import { createAdminClient } from "@/lib/supabase/admin";

// Accept a quote AND auto-create the booking it becomes — left in 'pending'
// (awaiting the guest's payment). Mirrors the clone logic in
// app/dashboard/quotes/actions.ts → convertQuoteAction, but WITHOUT confirming
// or marking it paid: the booking only confirms once payment lands, and the
// trigger on_quote_booking_confirmed flips the quote to 'converted' at that
// point (so the quote soft-hold holds the dates until then).
//
// Plain module (no "use server") so the portal + token accept actions can both
// call it. Runs with the service role; callers verify ownership/token first.
// Idempotent: if a booking already exists for the quote, it's returned as-is.

export type AcceptConvertResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: string };

export async function acceptAndConvertQuote(
  quoteId: string,
): Promise<AcceptConvertResult> {
  const admin = createAdminClient();

  const { data: quote } = await admin
    .from("quotes")
    .select(
      `
      id, host_id, listing_id, guest_name, guest_email, guest_phone, guest_id,
      check_in, check_out, headcount, scope, base_amount, cleaning_fee,
      addons_total, total_amount, currency, status, notes, guests_breakdown,
      discount_amount, deposit_amount, balance_amount, balance_due_days,
      converted_booking_id, conversation_id
    `,
    )
    .eq("id", quoteId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!quote) return { ok: false, error: "Quote not found." };

  // Already has a booking → idempotent return (e.g. double-tap on accept).
  if (quote.converted_booking_id) {
    return { ok: true, bookingId: quote.converted_booking_id };
  }
  if (!["sent", "accepted"].includes(quote.status)) {
    return { ok: false, error: "This quote can no longer be accepted." };
  }

  const [{ data: rooms }, { data: addons }] = await Promise.all([
    admin
      .from("quote_rooms")
      .select("room_id, base_amount, cleaning_fee")
      .eq("quote_id", quoteId),
    admin
      .from("quote_addons")
      .select("label, quantity, unit_price, sort_order")
      .eq("quote_id", quoteId)
      .order("sort_order"),
  ]);

  // Link to the guest's account by email when one exists (email = canonical
  // guest identity) so the booking shows in their portal / trips — a quote
  // carries only an email, so guest_id is usually NULL here.
  let acceptGuestId = (quote.guest_id as string | null) ?? null;
  if (!acceptGuestId && quote.guest_email) {
    const { data: acct } = await admin
      .from("user_profiles")
      .select("id")
      .ilike("email", quote.guest_email)
      .maybeSingle();
    acceptGuestId = acct?.id ?? null;
  }

  // Booking stays PENDING + unpaid — the guest pays from the thread/pay page,
  // and the payment confirmation path confirms it (firing the calendar block +
  // invoice + the quote→converted trigger).
  const { data: booking, error: bookErr } = await admin
    .from("bookings")
    .insert({
      host_id: quote.host_id,
      listing_id: quote.listing_id,
      guest_id: acceptGuestId,
      guest_name: quote.guest_name,
      guest_email: quote.guest_email,
      guest_phone: quote.guest_phone,
      origin: "quote_converted",
      quote_id: quote.id,
      scope: quote.scope,
      check_in: quote.check_in,
      check_out: quote.check_out,
      guests_count: quote.headcount,
      guests_breakdown: quote.guests_breakdown ?? null,
      discount_amount: quote.discount_amount ?? 0,
      deposit_amount: quote.deposit_amount ?? 0,
      balance_due: quote.balance_amount ?? 0,
      balance_due_date:
        Number(quote.balance_amount ?? 0) > 0 && quote.check_in
          ? new Date(
              new Date(`${quote.check_in}T00:00:00Z`).getTime() -
                (quote.balance_due_days ?? 7) * 86_400_000,
            )
              .toISOString()
              .slice(0, 10)
          : null,
      base_amount: quote.base_amount,
      cleaning_fee: quote.cleaning_fee,
      total_amount: quote.total_amount,
      currency: quote.currency,
      payment_status: "pending",
      special_requests: quote.notes,
      status: "pending",
    })
    .select("id")
    .single();
  if (bookErr || !booking) {
    return { ok: false, error: "Could not create the booking." };
  }

  if (quote.scope === "rooms" && rooms && rooms.length > 0) {
    const { error: brErr } = await admin.from("booking_rooms").insert(
      rooms.map((r) => ({
        booking_id: booking.id,
        room_id: r.room_id,
        base_amount: r.base_amount,
        cleaning_fee: r.cleaning_fee,
      })),
    );
    if (brErr) {
      await admin.from("bookings").delete().eq("id", booking.id);
      return { ok: false, error: "Could not attach the booked rooms." };
    }
  }

  if (addons && addons.length > 0) {
    await admin.from("booking_addons").insert(
      addons.map((a) => ({
        booking_id: booking.id,
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        subtotal:
          Math.round(Number(a.quantity) * Number(a.unit_price) * 100) / 100,
        sort_order: a.sort_order,
      })),
    );
  }

  // Seed the first ledger entry — the deposit the host will collect to secure the
  // booking. Pending until the host records it as received (manual EFT) or a card
  // payment lands. 'reserve' quotes (deposit 0) seed nothing.
  const depositAmount = Number(quote.deposit_amount ?? 0);
  if (depositAmount > 0) {
    await admin.from("payments").insert({
      booking_id: booking.id,
      amount: depositAmount,
      currency: quote.currency,
      method: "eft",
      status: "pending",
      kind: "deposit",
      note: "Deposit to secure the booking",
    });
  }
  // Derive balance_due / payment_status from the (still-unpaid) ledger.
  await recomputeBookingPaymentState(admin, booking.id);

  // Freeze the cancellation policy onto the booking (refund maths reads this).
  await admin.rpc("snapshot_booking_policies", {
    p_booking_id: booking.id,
    p_listing_id: quote.listing_id,
  });

  // Mark the quote accepted and link the booking — but keep status 'accepted'
  // (NOT converted) so its soft-hold persists until the booking is paid.
  await admin
    .from("quotes")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      converted_booking_id: booking.id,
    })
    .eq("id", quoteId);

  // Auto-advance the inbox pipeline so the host's board tracks the deal without
  // manual moves (purely a label — doesn't affect the booking/payment flow), and
  // post an "accepted" card into the thread — left unread for the host so it
  // surfaces in their inbox badge (a guest-initiated event).
  if (quote.conversation_id) {
    await admin
      .from("conversations")
      .update({ pipeline_stage: "accepted" })
      .eq("id", quote.conversation_id);
    await admin.from("messages").insert({
      conversation_id: quote.conversation_id,
      sender_id: null,
      is_system_message: true,
      system_event: "quote_accepted",
      quote_id: quoteId,
      body: "Quote accepted — booking created, awaiting payment.",
      read_by_host: false,
      read_by_guest: true,
    });
  }

  return { ok: true, bookingId: booking.id };
}
