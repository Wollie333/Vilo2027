import { NextResponse } from "next/server";

import { runSubscriptionReconcile } from "@/lib/billing/subscription-reconcile";
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
 * Time-driven subscription reconcile — repairs missed-webhook / crashed-worker
 * drift on both recurring rails (see lib/billing/subscription-reconcile.ts).
 *
 * Pinged hourly by the reconcile-subscriptions pg_cron. Each rail is gated by its
 * recurring flag + fully idempotent, so this is a safe no-op before go-live.
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
    const summary = await runSubscriptionReconcile(admin);
    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "SUBSCRIPTION_RECONCILE_FAILED", message },
      },
      { status: 500 },
    );
  }
}
