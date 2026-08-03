// Accrual correctness across EVERY real commission-bearing product in the system.
//
// Founder rule: tests must use the REAL products, at their REAL commission config —
// never a fabricated rate. This script reads each product's live affiliate settings
// and asserts the commission the RPC produces matches, with NO product mutation:
//   • Founder  (subscription, 25% forever, R599)   → recurring: N charges → N commissions
//   • Starter  (subscription, 25% forever, R999)   → recurring: N charges → N commissions
//   • StayFlow (one_off,      10% once,    R9 999) → one-off:   1 charge  → 1 commission
// Any commission-bearing product added later is picked up automatically.
//
//   node --env-file=.env.local scripts/seed-affiliate-realproducts.mjs   # from apps/web

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Run from apps/web with: node --env-file=.env.local scripts/seed-affiliate-realproducts.mjs");
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PARTNER_SLUG = "wollie-steenkamp";
const PASSWORD = "WieloStarter123!";
const nowIso = () => new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Isolated 0e… namespace: one referred host per product, keyed by index.
const V = (tag, n = 0) => `0e000000-0000-4000-8000-${tag}${String(n).padStart(12 - tag.length, "0")}`;

async function rpc(fn, args) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`rpc ${fn}: ${error.message}`);
  return data;
}
async function up(table, rows, onConflict = "id") {
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
}
async function del(table, filter) {
  let q = admin.from(table).delete();
  for (const [k, v] of Object.entries(filter)) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
  const { error } = await q;
  if (error && !/no rows/i.test(error.message)) throw new Error(`delete ${table}: ${error.message}`);
}
async function findUser(email) {
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const u = data?.users?.find((x) => x.email === email);
    if (u) return u.id;
    if (!data?.users?.length) break;
  }
  return null;
}
async function ensureUser(email) {
  const existing = await findUser(email);
  if (existing) return existing;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

// Expected recurring commission on a full-price (no-VAT, no-setup) charge, from live config.
function expectedRecur(prod) {
  if (prod.affiliate_type === "percent") return round2(prod.price * prod.affiliate_value / 100);
  if (prod.affiliate_type === "amount") return round2(Math.min(prod.affiliate_value, prod.price));
  return 0;
}
// How many charges should earn, given duration + a charge count.
function expectedCount(prod, charges) {
  if (prod.affiliate_duration === "once") return Math.min(1, charges);
  if (prod.affiliate_duration === "months") return Math.min(prod.affiliate_duration_months ?? 0, charges);
  return charges; // forever
}

async function main() {
  const { data: partner } = await admin.from("affiliate_accounts").select("id, currency").eq("slug", PARTNER_SLUG).maybeSingle();
  if (!partner) throw new Error(`No affiliate '${PARTNER_SLUG}' — run seed-affiliate-default.mjs first`);
  const cur = partner.currency ?? "ZAR";

  // Pull EVERY commission-bearing product, live, untouched.
  const { data: products } = await admin
    .from("products")
    .select("id, slug, name, type, price, affiliate_type, affiliate_value, affiliate_duration, affiliate_duration_months")
    .neq("affiliate_type", "none")
    .order("price");
  if (!products?.length) throw new Error("No commission-bearing products found");

  console.log(`Partner ${PARTNER_SLUG} · ${products.length} real commission products\n─── REAL-PRODUCT ACCRUAL ───────────────────────────`);
  let allPass = true;

  for (let idx = 0; idx < products.length; idx++) {
    const prod = products[idx];
    const key = String(idx + 1);
    const uid = V("1", Number(key)), hid = V("2", Number(key)), sid = V("3", Number(key)), refId = V("4", Number(key));
    // A subscription product bills repeatedly; a one-off bills once. Use 2 vs 1
    // so the duration gate ('forever' vs 'once') is genuinely exercised.
    const charges = prod.type === "subscription" ? 2 : 1;
    const isSub = prod.type === "subscription";

    // Clean this product's prior test rows.
    await del("affiliate_commissions", { affiliate_id: partner.id, referred_host_id: hid });
    await del("affiliate_referrals", { id: refId });
    await del("platform_ledger", { host_id: hid });
    await del("subscriptions", { host_id: hid });

    // Provision an isolated referred host + referral (default program).
    const realUid = await ensureUser(`realprod-${key}@wielostarter.com`);
    await up("user_profiles", [{ id: realUid, role: "host", full_name: `RealProd ${key}`, email: `realprod-${key}@wielostarter.com`, email_verified_at: nowIso() }]);
    await up("hosts", [{ id: hid, user_id: realUid, handle: `realprod-${key}`, display_name: `RealProd ${key}` }]);
    if (isSub) await up("subscriptions", [{ id: sid, host_id: hid, plan: "pro", status: "active" }]);
    await up("affiliate_referrals", [{ id: refId, affiliate_id: partner.id, referred_user_id: realUid, referred_host_id: hid, campaign_id: null, source: "realprod", bound_at: daysAgo(40) }]);

    // Charge the REAL product at its REAL price, then accrue. No product mutation.
    for (let i = 0; i < charges; i++) {
      const id = V(`5${key}`, i + 1);
      const when = daysAgo(30 - i);
      await up("platform_ledger", [{
        // plan is a FK to plans.key (subscription tiers), not a product slug; the RPC
        // resolves the product by product_id, so leave plan null for this matrix.
        id, user_id: realUid, host_id: hid, subscription_id: isSub ? sid : null, product_id: prod.id, plan: null,
        billing_cycle: isSub ? "monthly" : null, type: "charge", status: "completed", amount: prod.price, currency: cur,
        vat_amount: 0, setup_fee_amount: 0, is_prorated_upgrade: false, provider: "realprod",
        provider_reference: `RP-${key}-${i + 1}`, environment: "test", paid_at: when, period_start: when, created_at: when,
      }]);
      await rpc("accrue_affiliate_commission", { p_ledger_id: id });
    }

    const { data: comms } = await admin.from("affiliate_commissions")
      .select("kind, commission_amount").eq("affiliate_id", partner.id).eq("referred_host_id", hid);
    const wantCount = expectedCount(prod, charges);
    const wantEach = expectedRecur(prod);
    const gotCount = (comms ?? []).length;
    const amtOk = (comms ?? []).every((c) => round2(c.commission_amount) === wantEach);
    const pass = gotCount === wantCount && amtOk;
    allPass = allPass && pass;
    console.log(`  [${pass ? "PASS" : "FAIL"}] ${prod.name} (${prod.slug}) · ${prod.type} · ${prod.affiliate_value}${prod.affiliate_type === "percent" ? "%" : " flat"} ${prod.affiliate_duration}`);
    console.log(`         R${prod.price} × ${charges} charge(s) → ${gotCount}/${wantCount} commission(s) @ R${(comms ?? []).map((c) => round2(c.commission_amount)).join(",") || "-"} (expected R${wantEach} each)`);
  }

  console.log("────────────────────────────────────────────────────");
  console.log(allPass ? "ALL REAL PRODUCTS PASS ✓ (no product config was modified)" : "SOME REAL PRODUCTS FAILED ✗");
  if (!allPass) process.exit(1);
}

main().catch((e) => { console.error("REAL-PRODUCT TEST FAILED:", e.message); process.exit(1); });
