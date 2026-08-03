// Accrual-branch matrix for the DEFAULT affiliate program.
//
// seed-affiliate-default.mjs proves the machinery (bind→charge→accrue→clear→payout
// →clawback) for ONE config: subscription, percent, forever. This script exercises
// the remaining branches of accrue_affiliate_commission that that harness does NOT:
//   • affiliate_duration = 'once'   → commission on the FIRST charge only
//   • affiliate_duration = 'months' → commission on the first N charges only
//   • setup-fee commission (kind='setup_fee') on a charge carrying a setup fee,
//     using the product's setup_fee_affiliate_* config, ALONGSIDE the recurring one
//   • fixed-amount rate (affiliate_type='amount') instead of percent
// Every case drives the REAL RPC and asserts the exact commission rows it produced,
// then restores the plan's commission config to the default (25% forever, no setup).
//
//   node --env-file=.env.local scripts/seed-affiliate-variants.mjs   # from apps/web

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Run from apps/web with: node --env-file=.env.local scripts/seed-affiliate-variants.mjs");
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PARTNER_SLUG = "wollie-steenkamp";
const PLAN_SLUG = "pro";
const PASSWORD = "WieloStarter123!";
const nowIso = () => new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

// Isolated 0d… namespace so this never collides with the main harness's 0c… rows.
// Last UUID segment must be exactly 12 hex chars: tag + zero-padded counter.
const V = (tag, n = 0) => `0d000000-0000-4000-8000-${tag}${String(n).padStart(12 - tag.length, "0")}`;

// tag legend: host uid=1x hid=2x sid=3x refId=4x chargeId=5x  (x = case hex key)
const CASES = [
  {
    key: "1", name: "duration=once (3 charges → 1 commission)",
    cfg: { affiliate_type: "percent", affiliate_value: 25, affiliate_duration: "once", affiliate_duration_months: null, setup_fee_affiliate_type: "none", setup_fee_affiliate_value: 0 },
    charges: [{ amount: 999, setup: 0 }, { amount: 999, setup: 0 }, { amount: 999, setup: 0 }],
    expect: { subscription: 1, setup_fee: 0, subCommissionEach: 249.75 },
  },
  {
    key: "2", name: "duration=months(2) (3 charges → 2 commissions)",
    cfg: { affiliate_type: "percent", affiliate_value: 25, affiliate_duration: "months", affiliate_duration_months: 2, setup_fee_affiliate_type: "none", setup_fee_affiliate_value: 0 },
    charges: [{ amount: 999, setup: 0 }, { amount: 999, setup: 0 }, { amount: 999, setup: 0 }],
    expect: { subscription: 2, setup_fee: 0, subCommissionEach: 249.75 },
  },
  {
    key: "3", name: "setup-fee + recurring on one charge (percent recur + percent setup)",
    cfg: { affiliate_type: "percent", affiliate_value: 25, affiliate_duration: "forever", affiliate_duration_months: null, setup_fee_affiliate_type: "percent", setup_fee_affiliate_value: 10 },
    // amount 1499 incl. a 500 setup fee → recur_net 999 @25% = 249.75 ; setup 500 @10% = 50.00
    charges: [{ amount: 1499, setup: 500 }],
    expect: { subscription: 1, setup_fee: 1, subCommissionEach: 249.75, setupCommissionEach: 50.0 },
  },
  {
    key: "4", name: "fixed-amount rate (R150 flat, once)",
    cfg: { affiliate_type: "amount", affiliate_value: 150, affiliate_duration: "once", affiliate_duration_months: null, setup_fee_affiliate_type: "none", setup_fee_affiliate_value: 0 },
    charges: [{ amount: 999, setup: 0 }, { amount: 999, setup: 0 }],
    expect: { subscription: 1, setup_fee: 0, subCommissionEach: 150.0 },
  },
];

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

async function main() {
  const { data: partner } = await admin.from("affiliate_accounts").select("id, user_id, currency").eq("slug", PARTNER_SLUG).maybeSingle();
  if (!partner) throw new Error(`No affiliate '${PARTNER_SLUG}' — run seed-affiliate-default.mjs first`);
  const { data: plan } = await admin.from("products").select("id, price, currency").eq("slug", PLAN_SLUG).maybeSingle();
  if (!plan) throw new Error(`No product '${PLAN_SLUG}'`);
  const cur = partner.currency ?? "ZAR";

  let allPass = true;
  console.log(`Partner ${PARTNER_SLUG} · plan ${PLAN_SLUG}\n─── ACCRUAL VARIANTS ───────────────────────────────`);

  for (const c of CASES) {
    const uid = V("1", Number(c.key)), hid = V("2", Number(c.key)), sid = V("3", Number(c.key)), refId = V("4", Number(c.key));
    // Clean this case's prior rows (commissions first — FK to charges/referral).
    const chargeIds = c.charges.map((_, i) => V(`5${c.key}`, i + 1));
    await del("affiliate_commissions", { affiliate_id: partner.id, referred_host_id: hid });
    await del("affiliate_referrals", { id: refId });
    await del("platform_ledger", { host_id: hid });
    await del("subscriptions", { host_id: hid });

    // Provision referred host + referral + subscription.
    const realUid = await ensureUser(`variant-${c.key}@wielostarter.com`);
    await up("user_profiles", [{ id: realUid, role: "host", full_name: `Variant ${c.key}`, email: `variant-${c.key}@wielostarter.com`, email_verified_at: nowIso() }]);
    await up("hosts", [{ id: hid, user_id: realUid, handle: `variant-${c.key}`, display_name: `Variant ${c.key}` }]);
    await up("subscriptions", [{ id: sid, host_id: hid, plan: "pro", status: "active" }]);
    await up("affiliate_referrals", [{ id: refId, affiliate_id: partner.id, referred_user_id: realUid, referred_host_id: hid, campaign_id: null, source: "variant", bound_at: daysAgo(40) }]);

    // Configure the plan's commission for THIS case, then charge + accrue.
    const { error: upErr } = await admin.from("products").update(c.cfg).eq("id", plan.id);
    if (upErr) throw new Error(`product config update: ${upErr.message}`);
    const { data: prodNow } = await admin.from("products").select("affiliate_type, affiliate_value, affiliate_duration, affiliate_duration_months, setup_fee_affiliate_type, setup_fee_affiliate_value").eq("id", plan.id).single();
    console.log(`    · product now: ${prodNow.affiliate_type}/${prodNow.affiliate_value}/${prodNow.affiliate_duration}${prodNow.affiliate_duration_months ? "(" + prodNow.affiliate_duration_months + ")" : ""} setup=${prodNow.setup_fee_affiliate_type}/${prodNow.setup_fee_affiliate_value}`);
    for (let i = 0; i < c.charges.length; i++) {
      const ch = c.charges[i];
      const id = V(`5${c.key}`, i + 1);
      const when = daysAgo(30 - i);
      await up("platform_ledger", [{
        id, user_id: realUid, host_id: hid, subscription_id: sid, product_id: plan.id, plan: PLAN_SLUG,
        billing_cycle: "monthly", type: "charge", status: "completed", amount: ch.amount, currency: cur,
        vat_amount: 0, setup_fee_amount: ch.setup, is_prorated_upgrade: false, provider: "variant",
        provider_reference: `VAR-${c.key}-${i + 1}`, environment: "test", paid_at: when, period_start: when, created_at: when,
      }]);
      await rpc("accrue_affiliate_commission", { p_ledger_id: id });
    }

    // Assert the commission rows produced for this referral.
    const { data: comms } = await admin.from("affiliate_commissions")
      .select("kind, commission_amount, rate_type, rate_value").eq("affiliate_id", partner.id).eq("referred_host_id", hid);
    const subs = (comms ?? []).filter((x) => x.kind === "subscription");
    const setups = (comms ?? []).filter((x) => x.kind === "setup_fee");
    const round2 = (n) => Math.round(Number(n) * 100) / 100;
    const okSubCount = subs.length === c.expect.subscription;
    const okSetupCount = setups.length === c.expect.setup_fee;
    const okSubAmt = subs.every((x) => round2(x.commission_amount) === c.expect.subCommissionEach);
    const okSetupAmt = c.expect.setup_fee === 0 || setups.every((x) => round2(x.commission_amount) === c.expect.setupCommissionEach);
    const pass = okSubCount && okSetupCount && okSubAmt && okSetupAmt;
    allPass = allPass && pass;
    console.log(`  [${pass ? "PASS" : "FAIL"}] ${c.name}`);
    console.log(`         subscription: ${subs.length}/${c.expect.subscription} @ R${subs.map((x) => round2(x.commission_amount)).join(",") || "-"}  ·  setup_fee: ${setups.length}/${c.expect.setup_fee} @ R${setups.map((x) => round2(x.commission_amount)).join(",") || "-"}`);
    if (!pass) console.log(`         EXPECTED sub=${c.expect.subscription}@${c.expect.subCommissionEach} setup=${c.expect.setup_fee}${c.expect.setup_fee ? "@" + c.expect.setupCommissionEach : ""}`);
  }

  // Restore the plan to the default-program config so the UI / main harness stay consistent.
  await admin.from("products").update({
    affiliate_type: "percent", affiliate_value: 25, affiliate_duration: "forever",
    affiliate_duration_months: null, setup_fee_affiliate_type: "none", setup_fee_affiliate_value: 0,
  }).eq("id", plan.id);
  console.log("────────────────────────────────────────────────────");
  console.log(allPass ? "ALL VARIANTS PASS ✓ (plan config restored to 25% forever)" : "SOME VARIANTS FAILED ✗ (plan config restored)");
  if (!allPass) process.exit(1);
}

main().catch((e) => { console.error("VARIANTS FAILED:", e.message); process.exit(1); });
