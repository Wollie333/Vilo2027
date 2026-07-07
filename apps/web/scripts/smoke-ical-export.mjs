// Verifies the iCal EXPORT feed (app/ical/[property_id]/[token]/route.ts)
// against a running dev server + the linked cloud DB. Companion to
// smoke-ical-import.mjs — together they cover both directions of calendar sync.
//
//   pnpm --filter web exec node --env-file=.env.local scripts/smoke-ical-export.mjs
//   (override the server with EXPORT_BASE=http://localhost:3000)
//
// Checks:
//   1. a valid per-listing token → 200 text/calendar VCALENDAR
//   2. the feed contains a night we just blocked
//   3. NO PII / internal manual-block reason leaks into the feed (generic SUMMARY)
//   4. a forged token → 401
// Seeds one temp manual block (far enough out to be free) and cleans it up.

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const BASE = process.env.EXPORT_BASE || "http://localhost:3000";
const secret = process.env.ICAL_TOKEN_SECRET;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || !secret) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ICAL_TOKEN_SECRET",
  );
  process.exit(1);
}
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

// Mirrors signListingToken in lib/ical.ts (HMAC-SHA256 → base64url, 22 chars).
function signToken(id) {
  return createHmac("sha256", secret)
    .update(id)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
    .slice(0, 22);
}

let fail = 0;
const ok = (c, m) => {
  console.log(`${c ? "✅" : "❌"} ${m}`);
  if (!c) fail++;
};

const { data: prop } = await sb
  .from("properties")
  .select("id,name")
  .is("deleted_at", null)
  .limit(1)
  .single();
const id = prop.id;
const token = signToken(id);

const d = new Date();
d.setUTCDate(d.getUTCDate() + 30);
const day = d.toISOString().slice(0, 10);
await sb.from("blocked_dates").delete().eq("property_id", id).eq("date", day);
await sb.from("blocked_dates").insert({
  property_id: id,
  date: day,
  source: "manual",
  reason: "export-live-test", // internal reason — must NOT surface in the feed
});

try {
  const res = await fetch(`${BASE}/ical/${id}/${token}.ics`);
  const body = await res.text();
  ok(res.status === 200, `valid token → 200 (got ${res.status})`);
  ok(
    (res.headers.get("content-type") || "").includes("text/calendar"),
    `content-type is text/calendar (${res.headers.get("content-type")})`,
  );
  ok(body.startsWith("BEGIN:VCALENDAR"), "body is a VCALENDAR");
  ok(
    body.includes(`DTSTART;VALUE=DATE:${day.replace(/-/g, "")}`),
    `feed contains the blocked night ${day}`,
  );
  ok(
    !/mailto:|ATTENDEE|export-live-test/i.test(body),
    "no PII / internal reason leaked",
  );
  console.log("\n--- first 12 lines of the live feed ---");
  console.log(body.split("\r\n").slice(0, 12).join("\n"));

  const bad = await fetch(`${BASE}/ical/${id}/${"x".repeat(22)}.ics`);
  ok(bad.status === 401, `forged token → 401 (got ${bad.status})`);
} finally {
  await sb
    .from("blocked_dates")
    .delete()
    .eq("property_id", id)
    .eq("date", day)
    .eq("reason", "export-live-test");
  console.log("→ cleaned up temp block");
}
console.log(fail === 0 ? "\n✅ EXPORT LIVE CHECKS PASSED" : `\n❌ ${fail} FAILED`);
process.exit(fail ? 1 : 0);
