// Seed + TEST the DEFAULT affiliate program through the REAL money path.
//
// Nothing here fakes a commission row. It drives the exact path production uses:
//   referral binding  ->  platform_ledger 'charge'  ->  accrue_affiliate_commission(ledger)
//   ->  clear-affiliate-commissions (hold expiry)   ->  create/settle_affiliate_payout
// plus the refund-clawback trigger and accrual idempotency. Then it prints a
// verification report so you can see the numbers are right.
//
//   node --env-file=.env.local scripts/seed-affiliate-default.mjs     # from apps/web
//   node --env-file=.env.local scripts/seed-affiliate-default.mjs --clean-only
//
// Re-runnable: fixed UUIDs, scoped cleanup first. The partner is the existing
// 'wollie-steenkamp' affiliate; referred hosts are isolated test accounts.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Run from apps/web with: node --env-file=.env.local scripts/seed-affiliate-default.mjs");
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Config (founder-editable in Admin → Products → Commission) ──────────────
const PARTNER_SLUG = "wollie-steenkamp";
const PLAN_SLUG = "pro"; // the R999 subscription (Starter)
const PLAN_RATE = 20; // % default-program commission
const PLAN_DURATION = "forever"; // lifetime recurring
const PASSWORD = "WieloStarter123!";
const CLEAN_ONLY = process.argv.includes("--clean-only");

// Isolated referred hosts (namespace 0c… so they never collide with other seeds).
const HOSTS = [
  { key: "a", email: "ref-host-a@wielostarter.com", name: "Thabo Nkosi", uid: "0c000000-0000-4000-8000-0000000000a1", hid: "0c000000-0000-4000-8000-0000000000a2", sid: "0c000000-0000-4000-8000-0000000000a3", charges: 4, clear: true },
  { key: "b", email: "ref-host-b@wielostarter.com", name: "Karin Pretorius", uid: "0c000000-0000-4000-8000-0000000000b1", hid: "0c000000-0000-4000-8000-0000000000b2", sid: "0c000000-0000-4000-8000-0000000000b3", charges: 2, clear: true },
  { key: "c", email: "ref-host-c@wielostarter.com", name: "Naledi Mokoena", uid: "0c000000-0000-4000-8000-0000000000c1", hid: "0c000000-0000-4000-8000-0000000000c2", sid: "0c000000-0000-4000-8000-0000000000c3", charges: 1, clear: false, refund: true },
  { key: "d", email: "ref-host-d@wielostarter.com", name: "Johan van der Merwe", uid: "0c000000-0000-4000-8000-0000000000d1", hid: "0c000000-0000-4000-8000-0000000000d2", sid: "0c000000-0000-4000-8000-0000000000d3", charges: 0 }, // free beta → no commission
];
// Charges/refunds carry a RANDOM auth user_id (createUser mints its own uuid) but a
// FIXED host_id — so scope all test-host ledger cleanup by host_id, never user_id.
const HOST_HIDS = HOSTS.map((h) => h.hid);
// Last uuid segment must be exactly 12 hex chars: <tag><key> + zero-pad.
const CHARGE_ID = (key, i) => `0c000000-0000-4000-8000-e${key}${String(i).padStart(10, "0")}`;
const REFUND_ID = (key) => `0c000000-0000-4000-8000-f${key}0000000000`;
const REF_ID = (key) => `0c000000-0000-4000-8000-d${key}0000000000`;
const CLICK_ID = (key) => `0c000000-0000-4000-8000-a${key}0000000000`;

const nowIso = () => new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

async function rpc(fn, args) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`rpc ${fn}: ${error.message}`);
  return data;
}
async function del(table, filter) {
  let query = admin.from(table).delete();
  for (const [k, v] of Object.entries(filter)) {
    query = Array.isArray(v) ? query.in(k, v) : query.eq(k, v);
  }
  const { error } = await query;
  if (error && !/no rows/i.test(error.message)) {
    throw new Error(`delete ${table}: ${error.message}`);
  }
}
async function up(table, rows, onConflict = "id") {
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
}
async function findUser(email) {
  // paginate the admin list — fine for a test project
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const u = data?.users?.find((x) => x.email === email);
    if (u) return u;
    if (!data || data.users.length < 200) break;
  }
  return null;
}
async function ensureAuthUser(email, uid) {
  const existing = await findUser(email);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {},
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function main() {
  // 1. Resolve partner + plan product.
  const { data: partner } = await admin
    .from("affiliate_accounts")
    .select("id, user_id, status, currency")
    .eq("slug", PARTNER_SLUG)
    .maybeSingle();
  if (!partner) throw new Error(`No affiliate account '${PARTNER_SLUG}'`);
  if (partner.status !== "active") throw new Error(`Partner is ${partner.status}, not active`);

  const { data: plan } = await admin
    .from("products")
    .select("id, price, currency")
    .eq("slug", PLAN_SLUG)
    .maybeSingle();
  if (!plan) throw new Error(`No product '${PLAN_SLUG}'`);

  console.log(`Partner ${PARTNER_SLUG} (${partner.id})  ·  plan ${PLAN_SLUG} R${plan.price}`);

  // ── 2. CLEAN prior test data (FK-safe order) ──────────────────────────────
  console.log("Cleaning prior test data…");
  // Scope of platform_ledger to remove: test-host charges/refunds + partner's emitted affiliate rows.
  const { data: scopeLedger } = await admin
    .from("platform_ledger")
    .select("id")
    .or(`host_id.in.(${HOST_HIDS.join(",")}),and(user_id.eq.${partner.user_id},type.in.(commission,payout))`);
  const scopeIds = (scopeLedger ?? []).map((r) => r.id);
  if (scopeIds.length) {
    await del("wielo_credit_notes", { ledger_id: scopeIds });
    await del("wielo_invoices", { ledger_id: scopeIds });
  }
  // Emitted affiliate ledger rows reference the affiliate tables → delete first.
  await del("platform_ledger", { user_id: partner.user_id, type: "commission" });
  await del("platform_ledger", { user_id: partner.user_id, type: "payout" });
  await del("affiliate_payouts", { affiliate_id: partner.id });
  await del("affiliate_commissions", { affiliate_id: partner.id });
  await del("affiliate_referrals", { affiliate_id: partner.id });
  await del("affiliate_clicks", { affiliate_id: partner.id });
  // Now the test-host charges/refunds (commissions that referenced them are gone).
  // Scope by the FIXED host_id — the rows' user_id is a random auth uuid, so a
  // user_id filter is a silent no-op that leaves the refund row stale and stops
  // the AFTER INSERT clawback trigger from re-firing on the next run.
  await del("platform_ledger", { host_id: HOST_HIDS });
  await del("subscriptions", { host_id: HOSTS.map((h) => h.hid) });

  if (CLEAN_ONLY) {
    console.log("Clean-only done.");
    return;
  }

  // ── 3. Configure the default-program commission on the plan ───────────────
  {
    const { error } = await admin
      .from("products")
      .update({ affiliate_type: "percent", affiliate_value: PLAN_RATE, affiliate_duration: PLAN_DURATION, affiliate_duration_months: null })
      .eq("id", plan.id);
    if (error) throw new Error(`set plan commission: ${error.message}`);
  }
  console.log(`Set ${PLAN_SLUG} → ${PLAN_RATE}% ${PLAN_DURATION} (default program)`);

  // ── 4. Seed referred hosts (isolated) ─────────────────────────────────────
  for (const h of HOSTS) {
    const uid = await ensureAuthUser(h.email, h.uid);
    h.realUid = uid;
    await up("user_profiles", [{ id: uid, role: "host", full_name: h.name, email: h.email, email_verified_at: nowIso() }]);
    await up("hosts", [{ id: h.hid, user_id: uid, handle: `ref-host-${h.key}`, display_name: h.name }]);
    // Subscription so the UI counts paying hosts (paid plan = active).
    const paying = h.charges > 0;
    // subscriptions.plan → plans.key (basic|business|free|pro). Non-payers = 'free'.
    await up("subscriptions", [{ id: h.sid, host_id: h.hid, plan: paying ? "pro" : "free", status: "active" }]);
    // Referral binding — DEFAULT program (campaign_id NULL).
    await up("affiliate_referrals", [{ id: REF_ID(h.key), affiliate_id: partner.id, referred_user_id: uid, referred_host_id: h.hid, campaign_id: null, source: "seed", bound_at: daysAgo(40) }]);
    // A click each so the funnel shows traffic.
    await up("affiliate_clicks", [{ id: CLICK_ID(h.key), affiliate_id: partner.id, slug: PARTNER_SLUG, landing_path: "/pricing/pro", created_at: daysAgo(41) }]);
    console.log(`  host ${h.key} ${h.name} — ${paying ? `${h.charges} charge(s)` : "free beta"}`);
  }

  // ── 5. Charges → REAL accrual ─────────────────────────────────────────────
  for (const h of HOSTS) {
    for (let i = 1; i <= h.charges; i++) {
      const id = CHARGE_ID(h.key, i);
      const when = daysAgo(h.clear ? 40 - i * 2 : 5); // clearable hosts charged long ago
      await up("platform_ledger", [{
        id, user_id: h.realUid, host_id: h.hid, subscription_id: h.sid,
        product_id: plan.id, plan: PLAN_SLUG, billing_cycle: "monthly",
        type: "charge", status: "completed", amount: plan.price, currency: partner.currency ?? "ZAR",
        vat_amount: 0, setup_fee_amount: 0, is_prorated_upgrade: false,
        provider: "seed", provider_reference: `SEED-${h.key}-${i}`,
        environment: "test", paid_at: when, period_start: when, created_at: when,
      }]);
      const cid = await rpc("accrue_affiliate_commission", { p_ledger_id: id });
      console.log(`  charge ${h.key}#${i} R${plan.price} → commission ${cid ?? "(none)"}`);
    }
  }

  // ── 6. Clearing (mimic the hourly cron for the clearable hosts) ───────────
  // Push their holds into the past, then run the exact cron UPDATE.
  const clearHostIds = HOSTS.filter((h) => h.clear).map((h) => h.hid);
  await admin
    .from("affiliate_commissions")
    .update({ hold_until: daysAgo(1) })
    .eq("affiliate_id", partner.id)
    .in("referred_host_id", clearHostIds)
    .eq("status", "pending");
  const { data: clearedRows } = await admin
    .from("affiliate_commissions")
    .update({ status: "cleared", cleared_at: nowIso() })
    .eq("affiliate_id", partner.id)
    .eq("status", "pending")
    .eq("entry_type", "accrual")
    .lte("hold_until", nowIso())
    .select("id");
  console.log(`Cleared ${clearedRows?.length ?? 0} commission(s)`);

  // ── 7. Payout: request + settle (real RPCs) ───────────────────────────────
  const payout = await rpc("create_affiliate_payout", { p_affiliate_id: partner.id, p_method: "eft" });
  if (payout?.ok && payout.payout_id) {
    await rpc("settle_affiliate_payout", { p_payout_id: payout.payout_id, p_action: "paid", p_admin: partner.user_id, p_reference: "SEED-EFT-1", p_reason: "seed test payout" });
    console.log(`Payout ${payout.payout_id} settled — net R${payout.net}`);
  } else {
    console.log(`Payout not created: ${payout?.error ?? "unknown"} (available may be below threshold)`);
  }

  // ── 8. Refund clawback (trigger fires on the refund ledger row) ───────────
  const cHost = HOSTS.find((h) => h.refund);
  if (cHost) {
    const chargeId = CHARGE_ID(cHost.key, 1);
    await up("platform_ledger", [{
      id: REFUND_ID(cHost.key), user_id: cHost.realUid, host_id: cHost.hid,
      product_id: plan.id, plan: PLAN_SLUG, type: "refund", status: "completed",
      amount: -plan.price, currency: partner.currency ?? "ZAR", reverses_ledger_id: chargeId,
      provider: "seed", provider_reference: `SEED-REF-${cHost.key}`, environment: "test",
      paid_at: nowIso(), created_at: nowIso(),
    }]);
    console.log(`Refund on host ${cHost.key} — clawback trigger fired`);
  }

  // ── 9. Idempotency: re-accrue host a's first charge, expect NO new row ─────
  const { count: before } = await admin.from("affiliate_commissions").select("id", { count: "exact", head: true }).eq("affiliate_id", partner.id);
  await rpc("accrue_affiliate_commission", { p_ledger_id: CHARGE_ID("a", 1) });
  const { count: after } = await admin.from("affiliate_commissions").select("id", { count: "exact", head: true }).eq("affiliate_id", partner.id);
  console.log(`Idempotency: rows ${before} → ${after} (${before === after ? "OK, no duplicate" : "FAIL — duplicated!"})`);

  // ── 10. REPORT ────────────────────────────────────────────────────────────
  console.log("\n─── VERIFICATION ───────────────────────────────────────────");
  const { data: comms } = await admin
    .from("affiliate_commissions")
    .select("kind, entry_type, rate_type, rate_value, base_amount, commission_amount, status, referred_host_id")
    .eq("affiliate_id", partner.id)
    .order("created_at", { ascending: true });
  const hostName = Object.fromEntries(HOSTS.map((h) => [h.hid, h.name]));
  for (const c of comms ?? []) {
    console.log(`  ${(hostName[c.referred_host_id] ?? "?").padEnd(22)} ${c.kind.padEnd(14)} ${c.entry_type.padEnd(8)} ${String(c.rate_value).padStart(5)}${c.rate_type === "percent" ? "%" : ""}  base R${Number(c.base_amount).toFixed(2).padStart(8)}  → R${Number(c.commission_amount).toFixed(2).padStart(8)}  [${c.status}]`);
  }
  // Balance summary (mirror lib/affiliate/balance.ts).
  let pending = 0, cleared = 0, available = 0, paid = 0, clawed = 0, lifetime = 0;
  const { data: all } = await admin.from("affiliate_commissions").select("status, entry_type, payout_id, commission_amount").eq("affiliate_id", partner.id);
  for (const r of all ?? []) {
    const a = Number(r.commission_amount);
    if (r.status === "voided") { if (r.entry_type === "accrual") clawed += Math.abs(a); continue; }
    lifetime += a; if (a < 0) clawed += Math.abs(a);
    if (r.status === "pending") pending += a;
    else if (r.status === "cleared") { cleared += a; if (!r.payout_id) available += a; }
    else if (r.status === "paid") paid += a;
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  console.log("  ────");
  console.log(`  Pending R${r2(pending)}  ·  Cleared R${r2(cleared)}  ·  Available R${r2(available)}  ·  Paid R${r2(paid)}  ·  Clawed-back R${r2(clawed)}  ·  Lifetime R${r2(lifetime)}`);
  const { data: payouts } = await admin.from("affiliate_payouts").select("status, gross_amount, fee_amount, net_amount").eq("affiliate_id", partner.id);
  for (const p of payouts ?? []) console.log(`  Payout: gross R${p.gross_amount} fee R${p.fee_amount} net R${p.net_amount} [${p.status}]`);
  console.log("────────────────────────────────────────────────────────────");
  console.log("Done. Log in as the partner to see it in the UI.");
}

main().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });
