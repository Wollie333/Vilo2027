import "server-only";

import { round2 } from "@/lib/format";
import { initializeTransaction, verifyTransaction } from "@/lib/paystack";
import { hostHasValidEft } from "@/lib/payments/eft";
import { getHostPaystack } from "@/lib/payments/host-paystack";
import {
  recomputeBookingPaymentState,
  sumCompletedPaid,
} from "@/lib/payments/ledger";
import { createAdminClient } from "@/lib/supabase/admin";

export type StartBookingPaymentResult =
  | {
      ok: true;
      /** Hosted-checkout URL — the navigation fallback + the EFT landing path. */
      redirectTo: string;
      /** Paystack transaction access code — present on the card rail so the
       * client can open the inline popup (resumeTransaction) instead of a
       * full-page redirect. Absent for the EFT fallback. */
      accessCode?: string;
      /** The initialised transaction reference, so the client can return to the
       * confirm URL deterministically after the popup succeeds. */
      reference?: string;
    }
  | { ok: false; error: string };

/** Minimal booking shape the payment mechanics need. The caller is responsible
 * for loading it AND for proving the payer may pay it (guest session ownership,
 * or possession of the secret pay_token). */
export type PayableBooking = {
  id: string;
  reference: string;
  scope: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  deposit_amount: number | string | null;
  currency: string;
  guest_id: string | null;
  listing_id: string;
  listing_name: string;
  host_id: string;
};

/**
 * THE single source of truth for taking a payment against an ALREADY-CREATED
 * booking — used by both the signed-in guest pay flow (`/booking/[id]`) and the
 * host-shareable pay-now link (`/pay/[token]`). Guest checkout
 * (createBookingAction) creates the booking itself and is intentionally
 * separate; everything that pays an existing booking funnels through here.
 *
 * Behaviour:
 *  - Card settles on the HOST's own Paystack account (Vilo takes 0%); the
 *    platform key is never used for a booking. No usable host card rail (or a
 *    gateway outage) falls back to manual EFT, mirroring createBookingAction.
 *  - "full" pays the OUTSTANDING balance (total − already-paid), so a part-paid
 *    booking is settled correctly rather than double-charged.
 *  - Clears stale pending rows then inserts one fresh pending payment for this
 *    attempt; `returnTo` is both the EFT landing page and the Paystack callback.
 *
 * Returns a relative/absolute URL for the caller to navigate the payer to.
 */
export async function startBookingPayment(opts: {
  booking: PayableBooking;
  method: "paystack" | "eft";
  amount: "deposit" | "full";
  /** Payer email — Paystack requires one (guest session email or the booking's
   * stored guest_email for an anonymous pay-link). */
  email: string;
  /** Request origin for the absolute Paystack callback URL. */
  origin: string;
  /** Relative path the payer returns to (EFT landing + Paystack callback). */
  returnTo: string;
}): Promise<StartBookingPaymentResult> {
  const { booking, method, email, origin, returnTo } = opts;

  if (booking.payment_status === "completed") {
    return { ok: false, error: "This booking is already paid." };
  }
  if (
    !["pending", "pending_eft"].includes(booking.status) &&
    booking.payment_status !== "failed"
  ) {
    return { ok: false, error: "This booking can't be paid right now." };
  }

  const admin = createAdminClient();

  const total = round2(Number(booking.total_amount));
  const paid = await sumCompletedPaid(admin, booking.id);
  const deposit = round2(Number(booking.deposit_amount ?? 0));
  const outstanding = round2(Math.max(0, total - paid));

  const payNow =
    opts.amount === "deposit" && deposit > 0 && deposit < outstanding
      ? deposit
      : outstanding;
  if (payNow <= 0) {
    return { ok: false, error: "This booking is already paid." };
  }
  const balanceDue = round2(Math.max(0, total - (paid + payNow)));

  await admin
    .from("bookings")
    .update({ payment_method: method, balance_due: balanceDue })
    .eq("id", booking.id);

  // Clear any stale pending rows from a prior attempt, then create a fresh one.
  await admin
    .from("payments")
    .delete()
    .eq("booking_id", booking.id)
    .eq("status", "pending");

  const { data: payment, error: payErr } = await admin
    .from("payments")
    .insert({
      booking_id: booking.id,
      amount: payNow,
      currency: booking.currency,
      method,
      status: "pending",
    })
    .select("id")
    .single();
  if (payErr || !payment) {
    return { ok: false, error: "Could not prepare payment. Try again." };
  }

  // EFT — no provider hop. Booking sits in pending_eft; the return page shows
  // the host's banking details + reference.
  if (method === "eft") {
    await admin
      .from("bookings")
      .update({ status: "pending_eft" })
      .eq("id", booking.id);
    return { ok: true, redirectTo: returnTo };
  }

  // Card — initialise on the host's own Paystack account.
  const hostPaystack = await getHostPaystack(booking.host_id);
  try {
    if (!hostPaystack) throw new Error("Host has no connected Paystack.");
    const init = await initializeTransaction({
      amount: payNow,
      currency: booking.currency,
      email,
      callbackUrl: `${origin}${returnTo}`,
      secretKey: hostPaystack.secretKey,
      statementDescriptor: hostPaystack.statementDescriptor,
      metadata: {
        booking_id: booking.id,
        payment_id: payment.id,
        listing_id: booking.listing_id,
        listing_name: booking.listing_name,
        guest_id: booking.guest_id,
        reference: booking.reference,
        scope: booking.scope,
      },
    });
    await admin
      .from("payments")
      .update({ provider_reference: init.reference })
      .eq("id", payment.id);
    return {
      ok: true,
      redirectTo: init.authorization_url,
      accessCode: init.access_code,
      reference: init.reference,
    };
  } catch {
    // Gateway fallback: switch to EFT if the host has a valid account.
    if (await hostHasValidEft(booking.host_id)) {
      await admin
        .from("bookings")
        .update({ payment_method: "eft", status: "pending_eft" })
        .eq("id", booking.id);
      await admin
        .from("payments")
        .update({ method: "eft" })
        .eq("id", payment.id);
      return { ok: true, redirectTo: returnTo };
    }
    return {
      ok: false,
      error: "Couldn't reach the payment provider. Try again in a moment.",
    };
  }
}

/**
 * Confirm a host-account card payment when the payer returns from Paystack
 * (the success page + the /pay/[token] page both call this). Verifies the
 * transaction with the HOST's key (the platform key can't see it — see
 * AGENT_RULES §4.8), flips the matching pending payment row to completed, then
 * WIRES INTO THE LEDGER (recomputeBookingPaymentState) for balance +
 * payment_status rather than setting them by hand (§4.7), and confirms a
 * still-pending booking so the invoice/date-block triggers fire. Idempotent.
 *
 * Returns true when the booking is paid + confirmed after this call.
 */
export async function confirmHostCardPaymentByReference(opts: {
  reference: string;
  hostId: string;
  bookingId: string;
}): Promise<boolean> {
  const hostPaystack = await getHostPaystack(opts.hostId);
  const verification = await verifyTransaction(
    opts.reference,
    hostPaystack?.secretKey,
  );
  if (!verification || verification.status !== "success") return false;

  const admin = createAdminClient();
  // Flip the existing pending row (created at init) — never insert a duplicate.
  await admin
    .from("payments")
    .update({ status: "completed", captured_at: new Date().toISOString() })
    .eq("provider_reference", opts.reference)
    .eq("status", "pending");

  // Ledger owns balance_due + payment_status.
  await recomputeBookingPaymentState(admin, opts.bookingId);

  // Confirm the booking (pending → confirmed) so the invoice + date-blocking
  // triggers run. The invoice is created already-paid because payment_status is
  // 'completed' by the time this fires. We MUST surface an error here: the
  // confirm triggers (invoice mint, calendar block) run inside this UPDATE, and
  // if one throws, Postgres rolls back ONLY this statement — leaving a paid
  // booking stuck 'pending'. Swallowing it once hid a bad-column bug in the
  // invoice trigger for a full release. Throw so the caller/page sees it.
  // `.select()` tells us whether THIS call performed the transition, so the
  // guest confirmation card posts exactly once.
  const { data: confirmed, error: confirmErr } = await admin
    .from("bookings")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", opts.bookingId)
    .eq("status", "pending")
    .select("id");
  if (confirmErr) {
    throw new Error(
      `Payment captured but booking ${opts.bookingId} failed to confirm: ${confirmErr.message}`,
    );
  }

  // First-time confirmation → drop a "payment received, booking confirmed" card
  // into the guest's thread so they can jump to their trip + invoice/receipt.
  if (confirmed && confirmed.length > 0) {
    await postPaymentConfirmedCard(admin, opts.bookingId);
  }

  return true;
}

/**
 * Post a one-time "Payment received — booking confirmed" system card into the
 * guest's conversation thread. Mirrors the access-card cron's conversation
 * resolution: the booking's quote thread (converted bookings) → an existing
 * open host↔guest thread for the listing → a fresh conversation. The converted
 * ThreadQuoteCard already exposes "View booking" (→ trip page + receipt), so
 * this card is the explicit payment confirmation that nudges both parties.
 * Best-effort: a thread-post failure must never roll back a captured payment.
 */
async function postPaymentConfirmedCard(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
): Promise<void> {
  try {
    const { data: b } = await admin
      .from("bookings")
      .select(
        "id, reference, host_id, guest_id, listing_id, quote_id, listing:listings ( name )",
      )
      .eq("id", bookingId)
      .maybeSingle();
    // No registered guest → no portal thread to notify.
    if (!b || !b.guest_id || !b.listing_id) return;

    const listingName =
      (
        (Array.isArray(b.listing) ? b.listing[0] : b.listing) as {
          name: string;
        } | null
      )?.name ?? "your stay";

    // Resolve the conversation (quote thread → existing thread → create).
    let conversationId: string | null = null;
    if (b.quote_id) {
      const { data: q } = await admin
        .from("quotes")
        .select("conversation_id")
        .eq("id", b.quote_id)
        .maybeSingle();
      conversationId = q?.conversation_id ?? null;
    }
    if (!conversationId) {
      const { data: conv } = await admin
        .from("conversations")
        .select("id")
        .eq("host_id", b.host_id)
        .eq("guest_id", b.guest_id)
        .eq("listing_id", b.listing_id)
        .neq("status", "archived")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      conversationId = conv?.id ?? null;
    }
    if (!conversationId) {
      const { data: created } = await admin
        .from("conversations")
        .insert({
          host_id: b.host_id,
          guest_id: b.guest_id,
          listing_id: b.listing_id,
          booking_id: b.id,
          status: "open",
          is_enquiry: false,
        })
        .select("id")
        .single();
      conversationId = created?.id ?? null;
    }
    if (!conversationId) return;

    await admin.from("messages").insert({
      conversation_id: conversationId,
      sender_id: null,
      is_system_message: true,
      system_event: "payment_received",
      body: `✅ Payment received — your booking ${b.reference} at ${listingName} is confirmed. Open your booking above to view your trip details and invoice.`,
      // Guest just paid (they know); the host should see the unread nudge.
      read_by_host: false,
      read_by_guest: true,
    });
  } catch {
    // Swallow — the payment is already captured + the booking confirmed.
  }
}
