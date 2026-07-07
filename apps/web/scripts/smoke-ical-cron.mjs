// Verifies the hands-off calendar-sync worker (app/api/ical-sync-worker) against
// a running dev server + the linked cloud DB. This is the cron loop that makes
// syncing hands-off — the cron only wakes the worker; the worker does the work.
//
//   pnpm --filter web exec node --env-file=.env.local scripts/smoke-ical-cron.mjs
//   (override the server with WORKER_BASE=http://localhost:3000)
//
// Checks:
//   1. a wrong/absent bearer secret → 401
//   2. a valid secret → 200 and reports work
//   3. DUE selection: a never-synced active feed IS picked up (last_sync_at set)
//   4. NOT-due skip: a feed synced <3h ago is left untouched (last_sync_at same)
// Uses public example.com URLs (SSRF-safe, no VEVENTs → 0 dates imported) so the
// test proves the SELECTION + LOOP the cron adds; the fetch→parse→RPC internals
// are covered live by smoke-ical-import.mjs + the DB-guard integration suite.
// Seeds two temp feeds tagged __cron_test__ and cleans them up.

import { createClient } from "@supabase/supabase-js";

const BASE = process.env.WORKER_BASE || "http://localhost:3000";
const secret = process.env.ICAL_SYNC_WORKER_SECRET;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || !secret) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ICAL_SYNC_WORKER_SECRET",
  );
  process.exit(1);
}
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

let fail = 0;
const ok = (c, m) => {
  console.log(`${c ? "✅" : "❌"} ${m}`);
  if (!c) fail++;
};

const DUE_LABEL = "__cron_test_due__";
const FRESH_LABEL = "__cron_test_fresh__";

async function cleanup(propertyId) {
  const { data: feeds } = await sb
    .from("ical_feeds")
    .select("id")
    .eq("property_id", propertyId)
    .in("source_label", [DUE_LABEL, FRESH_LABEL]);
  for (const f of feeds ?? []) {
    await sb.from("blocked_dates").delete().eq("ical_feed_id", f.id);
  }
  await sb
    .from("ical_feeds")
    .delete()
    .eq("property_id", propertyId)
    .in("source_label", [DUE_LABEL, FRESH_LABEL]);
}

const { data: prop } = await sb
  .from("properties")
  .select("id,name")
  .is("deleted_at", null)
  .limit(1)
  .single();
const propertyId = prop.id;

await cleanup(propertyId); // in case a prior run left rows

// A never-synced (DUE) feed and a just-synced (NOT due) feed. example.com
// serves 200 with no VEVENTs → a clean 0-date sync (proves the happy path).
// Distinct URLs (the table is UNIQUE on property_id+url); both hit example.com's
// root → 200 with no VEVENTs.
const { data: dueFeed, error: dueErr } = await sb
  .from("ical_feeds")
  .insert({
    property_id: propertyId,
    source_label: DUE_LABEL,
    url: "https://example.com/?wielo=due",
    status: "active",
    last_sync_at: null,
  })
  .select("id")
  .single();
if (dueErr) throw dueErr;
const { data: freshFeed, error: freshErr } = await sb
  .from("ical_feeds")
  .insert({
    property_id: propertyId,
    source_label: FRESH_LABEL,
    url: "https://example.com/?wielo=fresh",
    status: "active",
    last_sync_at: new Date().toISOString(),
  })
  .select("id, last_sync_at")
  .single();
if (freshErr) throw freshErr;
// Canonical DB representation of the fresh stamp (avoids ISO "Z" vs "+00:00").
const freshBaseline = freshFeed.last_sync_at;

try {
  // 1. Wrong secret → 401.
  const bad = await fetch(`${BASE}/api/ical-sync-worker`, {
    method: "POST",
    headers: { Authorization: "Bearer nope", "Content-Type": "application/json" },
    body: "{}",
  });
  ok(bad.status === 401, `wrong secret → 401 (got ${bad.status})`);

  // 2. Valid secret → 200 + work reported.
  const res = await fetch(`${BASE}/api/ical-sync-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const json = await res.json();
  ok(res.status === 200, `valid secret → 200 (got ${res.status})`);
  ok(json.success === true, `success=true (got ${JSON.stringify(json)})`);
  ok((json.due ?? 0) >= 1, `at least our due feed selected (due=${json.due})`);
  ok((json.synced ?? 0) >= 1, `at least one feed synced (synced=${json.synced})`);

  // 3. + 4. Re-read both feeds.
  const { data: after } = await sb
    .from("ical_feeds")
    .select("id, source_label, last_sync_at")
    .in("id", [dueFeed.id, freshFeed.id]);
  const dueAfter = after.find((f) => f.id === dueFeed.id);
  const freshAfter = after.find((f) => f.id === freshFeed.id);

  ok(
    dueAfter?.last_sync_at != null,
    `DUE feed was synced (last_sync_at now ${dueAfter?.last_sync_at})`,
  );
  const sameInstant =
    freshAfter?.last_sync_at != null &&
    new Date(freshAfter.last_sync_at).getTime() ===
      new Date(freshBaseline).getTime();
  ok(sameInstant, `FRESH feed was skipped (last_sync_at unchanged)`);
} finally {
  await cleanup(propertyId);
  console.log("→ cleaned up temp feeds");
}

console.log(fail === 0 ? "\n✅ CRON WORKER CHECKS PASSED" : `\n❌ ${fail} FAILED`);
process.exit(fail ? 1 : 0);
