// Live-DB probe for the Wielo Credits engine: exercises the atomic + idempotent
// apply_wielo_credit RPC end-to-end (grant · idempotent grant · debit ·
// idempotent debit · insufficient-funds guard · refund · idempotent refund) and
// asserts the wallet + ledger behave. Balance-neutral: it nets back to the
// host's starting balance, leaving only a small probe audit trail on the demo
// host. Run: node --env-file=.env.local scripts/verify-credits.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Demo host (Lerato / Karoo Sky) — a real hosts.id so the FK holds.
const HOST = "0b111111-1111-4111-8111-111111111111";
const PURPOSE = "quote";
const TS = Date.now().toString(36);

let failures = 0;
function assert(name, cond, detail) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function apply(delta, kind, ref) {
  const { data, error } = await sb.rpc("apply_wielo_credit", {
    p_host_id: HOST,
    p_purpose: PURPOSE,
    p_delta: delta,
    p_kind: kind,
    p_reason: `probe ${kind}`,
    p_ref_type: "probe",
    p_ref_id: ref,
  });
  return { balance: data, error };
}

async function balance() {
  const { data } = await sb
    .from("wielo_credit_wallet")
    .select("balance")
    .eq("host_id", HOST)
    .eq("purpose", PURPOSE)
    .maybeSingle();
  return data?.balance ?? 0;
}

async function run() {
  console.log("Wielo Credits RPC probe\n");
  const start = await balance();
  console.log(`  starting balance: ${start}\n`);

  // Grant +3 (idempotent).
  let r = await apply(3, "grant", `grant:${TS}`);
  assert("grant +3", r.balance === start + 3, `got ${r.balance}`);
  r = await apply(3, "grant", `grant:${TS}`);
  assert("grant +3 again is idempotent", r.balance === start + 3, `got ${r.balance}`);

  // Debit -1 (idempotent).
  r = await apply(-1, "debit", `debit:${TS}`);
  assert("debit -1", r.balance === start + 2, `got ${r.balance}`);
  r = await apply(-1, "debit", `debit:${TS}`);
  assert("debit -1 again is idempotent", r.balance === start + 2, `got ${r.balance}`);

  // Insufficient funds: try to debit more than the balance → error, no change.
  r = await apply(-(start + 9999), "debit", `over:${TS}`);
  assert(
    "over-debit is rejected (INSUFFICIENT_CREDITS)",
    !!r.error && /INSUFFICIENT_CREDITS/.test(r.error.message ?? ""),
    r.error ? r.error.message : "no error returned",
  );
  assert("balance unchanged after rejected debit", (await balance()) === start + 2);

  // Refund the debit (idempotent).
  r = await apply(1, "refund", `debit:${TS}`);
  assert("refund +1", r.balance === start + 3, `got ${r.balance}`);
  r = await apply(1, "refund", `debit:${TS}`);
  assert("refund +1 again is idempotent", r.balance === start + 3, `got ${r.balance}`);

  // Net back to the starting balance (adjustment) so the probe is balance-neutral.
  r = await apply(-3, "adjustment", `cleanup:${TS}`);
  assert("adjustment nets back to start", r.balance === start, `got ${r.balance}`);

  console.log(`\n${failures === 0 ? "PASS ✓" : `FAIL ✗ (${failures})`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
