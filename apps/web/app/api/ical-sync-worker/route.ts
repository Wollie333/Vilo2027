import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { syncFeed } from "@/lib/ical-sync";
import { createAdminClient } from "@/lib/supabase/admin";

// Hands-off calendar sync worker.
// Called every 15 min by the `sync-ical-feeds` pg_cron job (migration
// 20260707120000). Also POST-able manually for testing. Selects every active
// (or previously errored — so transient failures self-heal) feed whose last
// sync is older than the min-interval, then re-imports each via the shared
// `syncFeed`. Bearer-gated on ICAL_SYNC_WORKER_SECRET.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// How stale a feed must be before we re-sync it. Kept in step with the cron's
// own `interval '3 hours'` gate so a woken tick always has work to do.
const DEFAULT_MIN_INTERVAL_MIN = 180;
// Bound the work per invocation so one tick can't run unbounded. Frequent ticks
// catch up any backlog.
const MAX_FEEDS_PER_RUN = 25;
const CONCURRENCY = 5;

function isAuthorized(req: Request): boolean {
  const expected = process.env.ICAL_SYNC_WORKER_SECRET;
  if (!expected) {
    console.warn("ical-sync-worker: ICAL_SYNC_WORKER_SECRET not set");
    return false;
  }
  const provided = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const minInterval =
    Number(process.env.ICAL_SYNC_MIN_INTERVAL_MINUTES) ||
    DEFAULT_MIN_INTERVAL_MIN;
  const cutoff = new Date(Date.now() - minInterval * 60_000).toISOString();

  const admin = createAdminClient();

  // Due = active/errored feed never synced, or last synced before the cutoff.
  // 'disabled' feeds are the explicit opt-out and are never touched.
  const { data: feeds, error } = await admin
    .from("ical_feeds")
    .select("id, property_id, url")
    .in("status", ["active", "error"])
    .or(`last_sync_at.is.null,last_sync_at.lt.${cutoff}`)
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(MAX_FEEDS_PER_RUN);

  if (error) {
    console.error("ical-sync-worker: feed query failed", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  const due = feeds ?? [];
  if (due.length === 0) {
    return NextResponse.json({ success: true, due: 0, synced: 0, failed: 0 });
  }

  let synced = 0;
  let failed = 0;
  let imported = 0;

  // Small worker-pool so we sync a batch concurrently without hammering N feeds
  // at once (each fetch already carries a 30s timeout).
  const queue = [...due];
  async function drain(): Promise<void> {
    for (;;) {
      const feed = queue.shift();
      if (!feed) return;
      const result = await syncFeed(admin, feed);
      if (result.ok) {
        synced += 1;
        imported += result.imported;
      } else {
        failed += 1;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, due.length) }, drain),
  );

  console.log(
    `ical-sync-worker: due=${due.length} synced=${synced} failed=${failed} imported=${imported}`,
  );
  return NextResponse.json({
    success: true,
    due: due.length,
    synced,
    failed,
    imported,
  });
}
