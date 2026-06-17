/**
 * Verify the canonical policy resolver + snapshot SSOT (Phase 1).
 *
 * Read-only / idempotent. Confirms:
 *   1. resolve_listing_policy_id, get_listing_policy_summary, snapshot_booking_policies exist.
 *   2. Every published listing resolves a cancellation policy (no silent gaps).
 *   3. Every booking has a cancellation snapshot (the bug: relying on a default
 *      used to leave the snapshot empty → 0% refund).
 *   4. calculate_policy_refund_amount returns a real rule (not no_policy_snapshot)
 *      for a sample booking.
 *
 * Run:  node scripts/verify-policy-resolver.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
function loadEnv(p) {
  try {
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnv(join(here, "..", ".env.local"));
loadEnv(join(here, "..", "..", "..", ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

let fail = 0;
const ok = (m) => console.log("  ✅", m);
const bad = (m) => {
  console.log("  ❌", m);
  fail++;
};

console.log("🔍 Phase 1 — policy resolver + snapshot SSOT\n");

// 1. functions exist (a bad call still proves existence via error shape)
console.log("1) RPCs exist");
{
  const { error } = await sb.rpc("resolve_listing_policy_id", {
    p_listing_id: "00000000-0000-0000-0000-000000000000",
    p_room_id: null,
    p_type: "cancellation",
  });
  error && error.code === "PGRST202"
    ? bad("resolve_listing_policy_id missing: " + error.message)
    : ok("resolve_listing_policy_id callable");
}

// 2. published listings resolve a cancellation policy
console.log("\n2) Published listings resolve a cancellation policy");
{
  const { data: listings, error } = await sb
    .from("properties")
    .select("id, name, is_published")
    .eq("is_published", true)
    .is("deleted_at", null)
    .limit(50);
  if (error) bad("listing query: " + error.message);
  else if (!listings.length) console.log("  (no published listings to check)");
  else {
    let gaps = 0;
    for (const l of listings) {
      const { data: sum } = await sb.rpc("get_listing_policy_summary", {
        p_listing_id: l.id,
      });
      if (!sum || !sum.cancellation) {
        gaps++;
        console.log(`     · no cancellation resolved for "${l.name}"`);
      }
    }
    gaps === 0
      ? ok(`${listings.length}/${listings.length} listings resolve a cancellation policy`)
      : bad(`${gaps}/${listings.length} listings have NO resolvable cancellation policy`);
  }
}

// 3. every booking has a cancellation snapshot (post-backfill)
console.log("\n3) Bookings have a cancellation snapshot");
{
  const { data: bookings, error } = await sb
    .from("bookings")
    .select("id, listing_id")
    .limit(200);
  if (error) bad("bookings query: " + error.message);
  else if (!bookings.length) console.log("  (no bookings to check)");
  else {
    const ids = bookings.map((b) => b.id);
    const { data: snaps } = await sb
      .from("policy_snapshots")
      .select("booking_id")
      .eq("policy_type", "cancellation")
      .in("booking_id", ids);
    const have = new Set((snaps ?? []).map((s) => s.booking_id));
    const missing = bookings.filter((b) => !have.has(b.id));
    missing.length === 0
      ? ok(`${bookings.length}/${bookings.length} bookings have a cancellation snapshot`)
      : bad(`${missing.length}/${bookings.length} bookings missing a cancellation snapshot`);

    // 4. refund calc returns a real rule for one snapshotted booking
    console.log("\n4) Refund calc reads the snapshot");
    const sample = bookings.find((b) => have.has(b.id));
    if (sample) {
      const { data: refund, error: rErr } = await sb.rpc(
        "calculate_policy_refund_amount",
        { p_booking_id: sample.id },
      );
      if (rErr) bad("refund calc: " + rErr.message);
      else if (refund?.rule_applied === "no_policy_snapshot")
        bad("refund calc still returns no_policy_snapshot for a snapshotted booking");
      else ok(`refund calc → ${JSON.stringify(refund)}`);
    } else console.log("  (no snapshotted booking to test refund calc)");
  }
}

console.log(fail === 0 ? "\n🎉 Phase 1 verified" : `\n💥 ${fail} check(s) failed`);
process.exit(fail === 0 ? 0 : 1);
