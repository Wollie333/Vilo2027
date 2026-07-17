import { NextResponse } from "next/server";

import { confirmHostCardPaymentByReference } from "@/lib/payments/pay-booking";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 50;
// Give the guest's own success-page verify a head start before we reconcile, so
// the worker and the live return path don't both race the same reference.
const MIN_AGE_MS = 3 * 60 * 1000; // 3 minutes
// Only chase recent bookings — older pending card bookings are abandoned and the
// expire cron will retire them (it now skips any with a captured payment).
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Shares EMAIL_WORKER_SECRET with the other queue workers (one bearer).
function authorised(req: Request): boolean {
  const expected = process.env.EMAIL_WORKER_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  return timingSafeEqual(header.slice(prefix.length), expected);
}

type Row = {
  provider_reference: string | null;
  booking_id: string;
  bookings: { host_id: string } | { host_id: string }[] | null;
};

/**
 * Reconcile host-Paystack card payments that never confirmed.
 *
 * A guest paying on the HOST's own Paystack account settles only when they
 * return to the success page (AGENT_RULES §4.8 — the platform webhook can't see
 * host-account charges). If they close the tab, the money is captured but the
 * booking sits 'pending' forever. This worker re-verifies each recent pending
 * card payment against the host's key and, when Paystack confirms it succeeded,
 * settles it through the ledger + confirms the booking via the ONE canonical
 * entry point (confirmHostCardPaymentByReference — idempotent).
 *
 * Pinged by the reconcile-host-card-payments pg_cron (every 5 min), well inside
 * the 30-min expiry window so a paid booking confirms before it could expire.
 */
export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "" } },
      { status: 401 },
    );
  }

  try {
    const admin = createAdminClient();
    const now = Date.now();
    const minAge = new Date(now - MIN_AGE_MS).toISOString();
    const maxAge = new Date(now - MAX_AGE_MS).toISOString();

    // Pending card payments (with a provider reference to verify) whose booking
    // is still pending and within the reconciliation window.
    const { data: rows, error } = await admin
      .from("payments")
      .select("provider_reference, booking_id, bookings!inner(host_id)")
      .eq("status", "pending")
      .eq("method", "paystack")
      .not("provider_reference", "is", null)
      .eq("bookings.status", "pending")
      .eq("bookings.payment_method", "paystack")
      .lt("bookings.created_at", minAge)
      .gt("bookings.created_at", maxAge)
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);

    let settled = 0;
    let unpaid = 0;
    let stuck = 0;
    const seen = new Set<string>();

    for (const row of (rows ?? []) as Row[]) {
      if (!row.provider_reference) continue;
      // One confirm per booking per run (idempotent anyway).
      if (seen.has(row.booking_id)) continue;
      seen.add(row.booking_id);

      const booking = Array.isArray(row.bookings)
        ? row.bookings[0]
        : row.bookings;
      if (!booking) continue;

      try {
        const ok = await confirmHostCardPaymentByReference({
          reference: row.provider_reference,
          hostId: booking.host_id,
          bookingId: row.booking_id,
        });
        if (ok) settled += 1;
        else unpaid += 1; // Paystack hasn't captured it — leave for expiry.
      } catch (err) {
        // The payment captured but the booking couldn't confirm — most likely
        // the availability guard fired because the slot was taken while this
        // booking was pending (the double-booking fix). The money is on the
        // host's Paystack and the booking is stuck: needs a manual refund. Count
        // it and move on — never let one stuck booking abort the batch.
        stuck += 1;
        console.error(
          `booking-reconcile: booking ${row.booking_id} captured but not confirmed:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { processed: seen.size, settled, unpaid, stuck },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: { code: "BOOKING_RECONCILE_FAILED", message } },
      { status: 500 },
    );
  }
}
