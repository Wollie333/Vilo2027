import { NextResponse } from "next/server";

import { dispatchEvent } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
// Stage timing (days since host creation). Stage 1 (welcome) fires on signup.
const NUDGE_MIN_DAYS = 3;
const FINAL_MIN_DAYS = 7;
// Give up chasing a host who never engaged after this — a stale free account
// isn't a fresh lead any more.
const MAX_DAYS = 30;

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

/** Has this exact (user, dedupe_key) offer email already been delivered? The
 *  registry dedupeKey only de-dupes push/email within a window, so THIS is the
 *  once-ever gate that lets the daily cron re-scan safely. */
async function alreadySent(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  dedupeKey: string,
): Promise<boolean> {
  const { data } = await admin
    .from("notification_delivery_log")
    .select("id")
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .limit(1);
  return !!data && data.length > 0;
}

type HostRow = {
  id: string;
  user_id: string | null;
  created_at: string;
};

/**
 * Standard host-offer nurture — stages 2 (nudge, day 3) and 3 (final, day 7).
 * Stage 1 (welcome) is dispatched inline at signup. For every host still on the
 * FREE tier (no active paid membership) within the 3–30 day window, sends the
 * stage whose age bucket they fall in, once ever (delivery-log gated). A host who
 * has upgraded, or whose account is older than the max window, is skipped.
 * Pinged by the drain-host-offers pg_cron.
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
    const oldest = new Date(now - MAX_DAYS * DAY_MS).toISOString();
    const youngest = new Date(now - NUDGE_MIN_DAYS * DAY_MS).toISOString();

    // Candidate hosts: created between 3 and 30 days ago, with an owner.
    const { data: hosts, error } = await admin
      .from("hosts")
      .select("id, user_id, created_at")
      .is("deleted_at", null)
      .not("user_id", "is", null)
      .lte("created_at", youngest)
      .gte("created_at", oldest)
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);

    const rows = (hosts ?? []) as HostRow[];
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { processed: 0, nudged: 0, finalled: 0, skipped: 0 },
      });
    }

    // Upgraded = holds an active/trialing subscription on a real paid plan
    // (plan != 'free' OR a product-backed membership). Fetch for the whole batch
    // in one query, then treat those host_ids as customers → skip.
    const hostIds = rows.map((h) => h.id);
    const { data: paidSubs } = await admin
      .from("subscriptions")
      .select("host_id, plan, product_id, status")
      .in("host_id", hostIds)
      .in("status", ["active", "trialing"]);
    const upgraded = new Set<string>();
    for (const s of paidSubs ?? []) {
      const paid = (s.plan && s.plan !== "free") || s.product_id != null;
      if (paid && s.host_id) upgraded.add(s.host_id as string);
    }

    let nudged = 0;
    let finalled = 0;
    let skipped = 0;

    for (const h of rows) {
      if (!h.user_id || upgraded.has(h.id)) {
        skipped += 1;
        continue;
      }
      const ageDays = (now - new Date(h.created_at).getTime()) / DAY_MS;
      // Pick the stage for this host's age: final wins from day 7, else nudge.
      const kind =
        ageDays >= FINAL_MIN_DAYS ? "host_offer_final" : "host_offer_nudge";
      const dedupeKey = `${kind}:${h.id}`;

      if (await alreadySent(admin, h.user_id, dedupeKey)) {
        skipped += 1;
        continue;
      }

      await dispatchEvent({
        kind,
        recipientUserId: h.user_id,
        hostId: h.id,
        refs: { host_id: h.id },
        supabase: admin,
      });
      if (kind === "host_offer_final") finalled += 1;
      else nudged += 1;
    }

    return NextResponse.json({
      success: true,
      data: { processed: rows.length, nudged, finalled, skipped },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "HOST_OFFER_WORKER_FAILED", message },
      },
      { status: 500 },
    );
  }
}
