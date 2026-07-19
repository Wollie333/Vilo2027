import { NextResponse } from "next/server";

import { runPaystackRenewals } from "@/lib/billing/subscription-renewal";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
 * Recurring subscription renewals — Paystack rail (hybrid model).
 *
 * Pinged by the renew-subscriptions pg_cron (daily). Re-charges the saved card
 * authorization for every subscription whose period is due, extends the period on
 * success, and starts dunning on a decline. Gated by paystack_recurring_enabled:
 * while OFF this is a no-op, so it is safe to deploy + schedule before go-live.
 * Fully idempotent (per-(sub, period, attempt) ledger reference) — a double tick,
 * or the backstop paystack-webhook, can never double-charge. See
 * lib/billing/subscription-renewal.ts.
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
    const summary = await runPaystackRenewals(admin);
    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "SUBSCRIPTION_RENEWAL_FAILED", message },
      },
      { status: 500 },
    );
  }
}
