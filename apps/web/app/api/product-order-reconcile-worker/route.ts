import { NextResponse } from "next/server";

import { confirmProductOrderByReference } from "@/lib/billing/product-checkout";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 50;
// Give the buyer's own return-page verify a head start so the worker and the
// live return path don't race the same reference. (They're both idempotent —
// confirmProductOrderByReference guards on a pending→paid compare-and-set — but
// there's no point doing the Paystack round-trip we're about to duplicate.)
const MIN_AGE_MS = 3 * 60 * 1000; // 3 minutes
// Older than this and the checkout was abandoned before paying. Paystack
// references stay verifiable, but chasing them forever is pointless work.
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

/**
 * Reconcile Wielo product / subscription orders that were paid but never settled.
 *
 * A buyer paying for a Wielo product settles on the return to the pay page
 * (confirmProductOrderByReference — the PRIMARY path), with the paystack-webhook
 * as an idempotent backstop. If the buyer closes the tab AND the webhook doesn't
 * land, the money is captured but the order sits 'pending' forever: the host has
 * paid and got nothing, and nothing in the system self-heals.
 *
 * Bookings have had `booking-reconcile-worker` for exactly this since 20260717;
 * subscriptions have `subscription-reconcile-worker`. `product_orders` had NO
 * reconciler at all, which made the webhook a single point of failure for
 * Wielo's own revenue (found 2026-07-22 while proving the webhook fires).
 *
 * Settles through the ONE canonical entry point rather than re-implementing it
 * (RULES.md §3): confirmProductOrderByReference verifies with the platform key,
 * flips the order + its pending platform_ledger row, activates any mapped plan,
 * and is idempotent via a pending→paid compare-and-set. A reference Paystack
 * never captured simply returns "not confirmed yet" and is left alone.
 *
 * Pinged by the reconcile-product-orders pg_cron (every 5 min).
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

    // Pending card orders that actually reached Paystack — an order with no
    // provider_reference was never attempted, so there is nothing to verify.
    const { data: rows, error } = await admin
      .from("product_orders")
      .select("id, provider_reference")
      .eq("status", "pending")
      .eq("method", "paystack")
      .not("provider_reference", "is", null)
      .lt("created_at", minAge)
      .gt("created_at", maxAge)
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);

    let settled = 0;
    let unpaid = 0;
    let stuck = 0;

    for (const row of rows ?? []) {
      const reference = row.provider_reference;
      if (!reference) continue;
      try {
        const res = await confirmProductOrderByReference(reference);
        // `alreadyPaid` means another path won the flip between our SELECT and
        // now — a no-op, not a settlement, so don't count it as one.
        if (res.ok && !res.alreadyPaid) settled += 1;
        else if (!res.ok) unpaid += 1;
      } catch (err) {
        // Captured at Paystack but activation failed (e.g. a mapped plan that
        // can't apply). Money is in, order is stuck: needs a human. Never let
        // one bad order abort the batch.
        stuck += 1;
        console.error(
          `product-order-reconcile: order ${row.id} could not be settled:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { processed: (rows ?? []).length, settled, unpaid, stuck },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "PRODUCT_ORDER_RECONCILE_FAILED", message },
      },
      { status: 500 },
    );
  }
}
