// Live-DB proof that a subscription product's credit_quantity actually flows to
// the host wallet — the exact logic grantSubscriptionCredits() runs, which every
// settle path (Paystack / PayPal / free-fulfil) AND the admin activate path call.
// Sets the free "Beta" membership's credit_quantity, replicates the helper's
// read+grant against the live product, asserts the wallet reflects the PRODUCT's
// qty + per-period idempotency, then restores everything (balance-neutral, and
// Beta.credit_quantity reverted). Run: node --env-file=.env.local scripts/verify-sub-grant.mjs
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

const HOST = "0b111111-1111-4111-8111-111111111111"; // Lerato / Karoo Sky
const BETA = "4bff856d-0d51-4d09-accd-d6d6dc8bd9c4"; // free "Beta" membership
const QTY = 5;

let failures = 0;
function assert(name, cond, detail) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function balance() {
  const { data } = await sb
    .from("wielo_credit_wallet")
    .select("balance")
    .eq("host_id", HOST)
    .eq("purpose", "quote")
    .maybeSingle();
  return data?.balance ?? 0;
}

// EXACT replica of lib/credits/wallet.ts → grantSubscriptionCredits: read the
// product's credit_quantity/purpose, grant idempotent per (product, period).
async function grantSubscriptionCredits(productId, periodStart) {
  const { data: product } = await sb
    .from("products")
    .select("credit_quantity, credit_purpose, name")
    .eq("id", productId)
    .maybeSingle();
  const qty = Number(product?.credit_quantity ?? 0);
  if (qty <= 0) return { skipped: true };
  const periodKey = periodStart.slice(0, 10);
  const { data, error } = await sb.rpc("apply_wielo_credit", {
    p_host_id: HOST,
    p_purpose: product?.credit_purpose || "quote",
    p_delta: qty,
    p_kind: "grant",
    p_reason: `Plan credits · ${product?.name ?? "subscription"}`,
    p_ref_type: "subscription",
    p_ref_id: `${productId}:${periodKey}`,
  });
  return { balance: data, error, qty };
}

async function run() {
  console.log("Subscription-grant wiring probe (product.credit_quantity → wallet)\n");
  const start = await balance();
  console.log(`  starting balance: ${start}\n`);

  // Give the free Beta membership a per-cycle credit grant.
  const { error: setErr } = await sb
    .from("products")
    .update({ credit_quantity: QTY, credit_purpose: "quote" })
    .eq("id", BETA);
  assert("set Beta.credit_quantity = 5", !setErr, setErr?.message);

  // Use unique periods so this run never collides with a prior one.
  const TS = Date.now();
  const P1 = new Date(TS).toISOString();
  const P2 = new Date(TS + 40 * 86_400_000).toISOString(); // ~next cycle

  let r = await grantSubscriptionCredits(BETA, P1);
  assert("grant reads product qty (+5)", r.balance === start + 5, `got ${r.balance} (qty ${r.qty})`);
  r = await grantSubscriptionCredits(BETA, P1);
  assert("same-period renewal is idempotent", r.balance === start + 5, `got ${r.balance}`);
  r = await grantSubscriptionCredits(BETA, P2);
  assert("next period tops up again (+5)", r.balance === start + 10, `got ${r.balance}`);

  // A zero-credit product must NOT grant (guards non-credit plans).
  await sb.from("products").update({ credit_quantity: 0 }).eq("id", BETA);
  r = await grantSubscriptionCredits(BETA, new Date(TS + 80 * 86_400_000).toISOString());
  assert("zero-credit product is a no-op", r.skipped === true, JSON.stringify(r));

  // ── Restore: net the wallet back to start + revert Beta to no credit grant.
  const { data: bal } = await sb.rpc("apply_wielo_credit", {
    p_host_id: HOST,
    p_purpose: "quote",
    p_delta: start - (await balance()),
    p_kind: "adjustment",
    p_reason: "sub-grant probe cleanup",
    p_ref_type: "probe",
    p_ref_id: `subgrant-cleanup:${TS}`,
  });
  assert("wallet restored to start", bal === start, `got ${bal}`);
  const { error: revErr } = await sb
    .from("products")
    .update({ credit_quantity: null, credit_purpose: null })
    .eq("id", BETA);
  assert("Beta credit grant reverted", !revErr, revErr?.message);

  console.log(`\n${failures === 0 ? "PASS ✓" : `FAIL ✗ (${failures})`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
