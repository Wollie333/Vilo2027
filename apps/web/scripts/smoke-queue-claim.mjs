// Verifies the atomic-claim anti-double-send fix (migration 20260622010000)
// directly against the linked cloud DB — no Resend/Expo keys needed.
//
//   pnpm --filter web exec node --env-file=.env.local scripts/smoke-queue-claim.mjs
//
// Proves, for claim_email_queue_batch:
//   1. Two CONCURRENT claims over the same pending rows return DISJOINT sets
//      (the whole point — no row handed to two workers → no double-send).
//   2. A sent/failed row is never claimed.
//   3. A stale claim (claimed_at far in the past) is reclaimed.
// Inserts rows with a unique marker type and deletes them at the end.

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

const MARKER = `__claim_smoke_${Date.now()}__`;
let failures = 0;
const assert = (cond, msg) => {
  console.log(`${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) failures += 1;
};

async function cleanup() {
  await sb.from("notification_queue").delete().eq("type", MARKER);
}

try {
  // ── Seed 6 unsent rows ────────────────────────────────────────────────
  const seed = Array.from({ length: 6 }, (_, i) => ({
    type: MARKER,
    payload: { i },
  }));
  const { data: inserted, error: insErr } = await sb
    .from("notification_queue")
    .insert(seed)
    .select("id");
  if (insErr) throw insErr;
  const seededIds = new Set(inserted.map((r) => r.id));
  console.log(`→ seeded ${seededIds.size} rows (marker ${MARKER})`);

  // ── 1. Concurrent claims must be disjoint ─────────────────────────────
  const [a, b] = await Promise.all([
    sb.rpc("claim_email_queue_batch", { p_limit: 3, p_stale_seconds: 300 }),
    sb.rpc("claim_email_queue_batch", { p_limit: 3, p_stale_seconds: 300 }),
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  const idsA = (a.data ?? []).filter((r) => seededIds.has(r.id)).map((r) => r.id);
  const idsB = (b.data ?? []).filter((r) => seededIds.has(r.id)).map((r) => r.id);
  const overlap = idsA.filter((id) => idsB.includes(id));
  console.log(`   claim A got ${idsA.length}, claim B got ${idsB.length}, overlap ${overlap.length}`);
  assert(overlap.length === 0, "concurrent claims are DISJOINT (no double-claim)");
  assert(
    new Set([...idsA, ...idsB]).size === idsA.length + idsB.length,
    "no duplicate id across both claims",
  );
  const claimedNow = new Set([...idsA, ...idsB]);
  assert(claimedNow.size === 6, "all 6 pending rows were claimed across the two ticks");

  // claimed_at must now be stamped on claimed rows.
  const { data: stamped } = await sb
    .from("notification_queue")
    .select("id, claimed_at")
    .eq("type", MARKER);
  assert(
    stamped.every((r) => r.claimed_at !== null),
    "claimed_at stamped on every claimed row",
  );

  // ── 2. A fresh claim returns nothing (all rows have a live claim) ──────
  const { data: again } = await sb.rpc("claim_email_queue_batch", {
    p_limit: 10,
    p_stale_seconds: 300,
  });
  const stillMine = (again ?? []).filter((r) => seededIds.has(r.id));
  assert(stillMine.length === 0, "live-claimed rows are NOT re-handed out");

  // ── 3. Sent/failed rows are never claimed ─────────────────────────────
  const oneId = [...seededIds][0];
  await sb
    .from("notification_queue")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", oneId);
  // Also clear its claim so only sent_at would gate it.
  await sb.from("notification_queue").update({ claimed_at: null }).eq("id", oneId);
  const { data: afterSent } = await sb.rpc("claim_email_queue_batch", {
    p_limit: 10,
    p_stale_seconds: 300,
  });
  assert(
    !(afterSent ?? []).some((r) => r.id === oneId),
    "a sent row is never claimed",
  );

  // ── 4. Stale claim is reclaimed ───────────────────────────────────────
  const staleId = [...seededIds][1];
  const longAgo = new Date(Date.now() - 3600_000).toISOString(); // 1h ago
  await sb
    .from("notification_queue")
    .update({ claimed_at: longAgo })
    .eq("id", staleId);
  const { data: reclaim } = await sb.rpc("claim_email_queue_batch", {
    p_limit: 10,
    p_stale_seconds: 300,
  });
  assert(
    (reclaim ?? []).some((r) => r.id === staleId),
    "a stale claim (older than p_stale_seconds) is reclaimed",
  );
} catch (err) {
  console.error("ERROR:", err.message ?? err);
  failures += 1;
} finally {
  await cleanup();
  console.log("→ cleaned up test rows");
}

console.log(failures === 0 ? "\n✅ ALL CLAIM CHECKS PASSED" : `\n❌ ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
