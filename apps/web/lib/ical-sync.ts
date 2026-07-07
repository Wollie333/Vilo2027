import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseIcal, rangesToDates } from "@/lib/ical-parser";
import { assertFetchableUrl } from "@/lib/security/ssrf";

/**
 * Core, session-less iCal import for ONE feed. Fetches the external feed
 * (SSRF-guarded, 30s timeout), parses it, writes the blocked nights via the
 * atomic non-destructive `import_ical_blocks` RPC, and stamps the feed's sync
 * status. Shared by both the host-triggered "Sync now" server action and the
 * hands-off `ical-sync-worker` cron — so the two can never drift.
 *
 * Takes a service-role client (the worker has no user session; the action
 * builds one after its ownership check). Never throws — every failure is
 * captured on the feed row and returned.
 */

/** Cap imported dates per feed so a giant/hostile feed can't flood blocked_dates. */
export const MAX_IMPORTED_DATES = 1000;

export type SyncFeedInput = {
  id: string;
  property_id: string;
  url: string;
};

export type SyncFeedResult =
  | { ok: true; imported: number }
  | { ok: false; error: string };

async function markError(
  admin: SupabaseClient,
  feedId: string,
  message: string,
): Promise<void> {
  await admin
    .from("ical_feeds")
    .update({
      status: "error",
      last_sync_at: new Date().toISOString(),
      last_error: message.slice(0, 500),
    })
    .eq("id", feedId);
}

export async function syncFeed(
  admin: SupabaseClient,
  feed: SyncFeedInput,
): Promise<SyncFeedResult> {
  // 1. Fetch — SSRF guard first (reject private/loopback/metadata hosts).
  let body: string;
  try {
    await assertFetchableUrl(feed.url);
    const res = await fetch(feed.url, {
      signal: AbortSignal.timeout(30_000),
      headers: { "User-Agent": "Wielo-CalendarSync/1.0" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
    body = await res.text();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error fetching feed";
    await markError(admin, feed.id, message);
    return { ok: false, error: `Couldn't fetch feed: ${message}` };
  }

  // 2. Parse (cap dates so a hostile feed can't flood blocked_dates).
  const ranges = parseIcal(body);
  const dates = rangesToDates(ranges).slice(0, MAX_IMPORTED_DATES);

  // 3. Write atomically + NON-destructively via the RPC: it replaces only this
  // feed's own source='ical' rows and inserts the new dates with ON CONFLICT DO
  // NOTHING (a manual / booking / quote_hold block on the same date always wins).
  const { data: inserted, error: rpcError } = await admin.rpc(
    "import_ical_blocks",
    {
      p_feed_id: feed.id,
      p_property_id: feed.property_id,
      p_dates: dates,
    },
  );
  if (rpcError) {
    await markError(admin, feed.id, rpcError.message);
    return { ok: false, error: `Couldn't write blocks: ${rpcError.message}` };
  }

  // Rows this feed actually blocks (dates already held by a real Wielo block
  // are skipped by DO NOTHING and not counted).
  const importedCount = typeof inserted === "number" ? inserted : dates.length;
  await admin
    .from("ical_feeds")
    .update({
      status: "active",
      last_sync_at: new Date().toISOString(),
      last_error: null,
      imported_count: importedCount,
    })
    .eq("id", feed.id);

  return { ok: true, imported: importedCount };
}
