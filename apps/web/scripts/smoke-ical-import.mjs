// Verifies the iCal import writer (migration 20260622030000 + syncIcalFeedAction)
// against the linked cloud DB — proves the fix for the 42P10 ON CONFLICT bug and
// the non-destructive guarantee. No external feed needed (calls the RPC directly).
//
//   pnpm --filter web exec node --env-file=.env.local scripts/smoke-ical-import.mjs
//
// Checks:
//   1. import_ical_blocks inserts the given dates as source='ical' (returns count)
//   2. a manual block on an overlapping date is PRESERVED (DO NOTHING)
//   3. re-running replaces only this feed's own ical rows (idempotent)
// Cleans up the temp feed + rows at the end.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;
const assert = (cond, msg) => {
  console.log(`${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) failures += 1;
};

// Far-future dates so we never collide with real data.
const D1 = "2099-03-01";
const D2 = "2099-03-02";
const D3 = "2099-03-03";
const DMANUAL = "2099-03-02"; // overlaps D2 on purpose
let feedId = null;
let propertyId = null;

async function cleanup() {
  if (propertyId) {
    await sb
      .from("blocked_dates")
      .delete()
      .eq("property_id", propertyId)
      .gte("date", "2099-01-01");
  }
  if (feedId) await sb.from("ical_feeds").delete().eq("id", feedId);
}

try {
  const { data: prop } = await sb
    .from("properties")
    .select("id")
    .is("deleted_at", null)
    .limit(1)
    .single();
  propertyId = prop.id;
  console.log(`→ property ${propertyId}`);

  const { data: feed, error: feedErr } = await sb
    .from("ical_feeds")
    .insert({
      property_id: propertyId,
      source_label: "__synctest__",
      url: "https://example.com/synctest.ics",
      status: "active",
    })
    .select("id")
    .single();
  if (feedErr) throw feedErr;
  feedId = feed.id;

  // ── 1. Basic insert ───────────────────────────────────────────────────
  const r1 = await sb.rpc("import_ical_blocks", {
    p_feed_id: feedId,
    p_property_id: propertyId,
    p_dates: [D1, D2, D3],
  });
  if (r1.error) throw r1.error;
  assert(r1.data === 3, `inserts 3 ical dates (got ${r1.data})`);
  const { data: rows1 } = await sb
    .from("blocked_dates")
    .select("date, source")
    .eq("ical_feed_id", feedId);
  assert(
    rows1.length === 3 && rows1.every((r) => r.source === "ical"),
    "3 rows present, all source='ical'",
  );

  // ── 2. Non-destructive: a manual block on D2 must survive ─────────────
  // Drop this feed's D2 first (so the manual insert doesn't hit the unique idx),
  // then place a manual block, then re-run the import INCLUDING D2.
  await sb
    .from("blocked_dates")
    .delete()
    .eq("ical_feed_id", feedId)
    .eq("date", DMANUAL);
  const { error: manErr } = await sb
    .from("blocked_dates")
    .insert({
      property_id: propertyId,
      date: DMANUAL,
      source: "manual",
      reason: "host blocked",
    });
  if (manErr) throw manErr;

  const r2 = await sb.rpc("import_ical_blocks", {
    p_feed_id: feedId,
    p_property_id: propertyId,
    p_dates: [D1, D2, D3],
  });
  if (r2.error) throw r2.error;
  assert(r2.data === 2, `re-import inserts 2 (D2 skipped — manual wins), got ${r2.data}`);
  const { data: d2row } = await sb
    .from("blocked_dates")
    .select("source, ical_feed_id")
    .eq("property_id", propertyId)
    .eq("date", DMANUAL)
    .single();
  assert(
    d2row.source === "manual" && d2row.ical_feed_id === null,
    "D2 is STILL source='manual' (not overwritten by the feed)",
  );
  const { data: icalRows } = await sb
    .from("blocked_dates")
    .select("date")
    .eq("ical_feed_id", feedId);
  assert(icalRows.length === 2, `feed owns exactly 2 rows now (got ${icalRows.length})`);

  // ── 3. Idempotent ─────────────────────────────────────────────────────
  const r3 = await sb.rpc("import_ical_blocks", {
    p_feed_id: feedId,
    p_property_id: propertyId,
    p_dates: [D1, D2, D3],
  });
  assert(!r3.error && r3.data === 2, "re-running again is stable (2)");
} catch (err) {
  console.error("ERROR:", err.message ?? err);
  failures += 1;
} finally {
  await cleanup();
  console.log("→ cleaned up");
}

console.log(failures === 0 ? "\n✅ ALL iCAL IMPORT CHECKS PASSED" : `\n❌ ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
