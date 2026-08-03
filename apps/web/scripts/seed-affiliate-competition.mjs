// Competition (Founding Race) commission path — the SoT's core money mechanic.
//
// Proves, through the REAL accrue_affiliate_commission RPC against the REAL
// founding-race campaign (flat 60% lifetime, per WIELO_FOUNDING_PROGRAMME.md):
//   1. a campaign referral earns the CAMPAIGN rate (60% of NET), not the 25% default;
//   2. the commission row is stamped with the campaign_id;
//   3. the rate is LOCKED on the referral (commission_snapshot) and SURVIVES the
//      campaign ending — the exact bug the snapshot mechanic fixes (SoT §2.2/B.1):
//      an ended campaign must NOT drop the referral back to 25% at the next charge.
// No campaign config is mutated except a temporary status flip (restored).
//
//   node --env-file=.env.local scripts/seed-affiliate-competition.mjs   # from apps/web

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Run from apps/web with: node --env-file=.env.local scripts/seed-affiliate-competition.mjs");
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PARTNER_SLUG = "wollie-steenkamp";
const CAMPAIGN_SLUG = "founding-race";
const PLAN_SLUG = "pro"; // real Starter product, R999
const PASSWORD = "WieloStarter123!";
const nowIso = () => new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Isolated 0f… namespace.
const V = (tag, n = 0) => `0f000000-0000-4000-8000-${tag}${String(n).padStart(12 - tag.length, "0")}`;
const HID = V("2", 1), UID_FIXED = V("1", 1), SID = V("3", 1), REF_ID = V("4", 1);
const CHARGE = (i) => V("5", i);

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

async function chargeAndAccrue(realUid, i, price, cur, planId) {
  const id = CHARGE(i);
  const when = daysAgo(30 - i);
  await up("platform_ledger", [{
    id, user_id: realUid, host_id: HID, subscription_id: SID, product_id: planId, plan: PLAN_SLUG,
    billing_cycle: "monthly", type: "charge", status: "completed", amount: price, currency: cur,
    vat_amount: 0, setup_fee_amount: 0, is_prorated_upgrade: false, provider: "competition",
    provider_reference: `COMP-${i}`, environment: "test", paid_at: when, period_start: when, created_at: when,
  }]);
  await rpc("accrue_affiliate_commission", { p_ledger_id: id });
  return id;
}

async function main() {
  const { data: partner } = await admin.from("affiliate_accounts").select("id, currency").eq("slug", PARTNER_SLUG).maybeSingle();
  if (!partner) throw new Error(`No affiliate '${PARTNER_SLUG}' — run seed-affiliate-default.mjs first`);
  const { data: campaign } = await admin.from("affiliate_campaigns").select("id, status, commission_structure").eq("slug", CAMPAIGN_SLUG).maybeSingle();
  if (!campaign) throw new Error(`No campaign '${CAMPAIGN_SLUG}'`);
  const { data: plan } = await admin.from("products").select("id, price").eq("slug", PLAN_SLUG).maybeSingle();
  const cur = partner.currency ?? "ZAR";
  const cs = campaign.commission_structure; // {model:'flat', flat_rate:0.6, ...}
  const expected = round2(plan.price * Number(cs.flat_rate)); // 999 * 0.6 = 599.40
  const startStatus = campaign.status;

  console.log(`Partner ${PARTNER_SLUG} · campaign ${CAMPAIGN_SLUG} (${cs.model} ${Number(cs.flat_rate) * 100}%) · Starter R${plan.price}`);
  console.log(`─── COMPETITION COMMISSION (expect R${expected} per charge) ───────`);
  let allPass = true;

  // Clean prior test rows for this referral.
  await del("affiliate_commissions", { affiliate_id: partner.id, referred_host_id: HID });
  await del("affiliate_referrals", { id: REF_ID });
  await del("platform_ledger", { host_id: HID });
  await del("subscriptions", { host_id: HID });

  // Referred host bound THROUGH the campaign link: campaign_id set + rate snapshot locked.
  const realUid = await ensureUser("comp-host@wielostarter.com");
  await up("user_profiles", [{ id: realUid, role: "host", full_name: "Comp Host", email: "comp-host@wielostarter.com", email_verified_at: nowIso() }]);
  await up("hosts", [{ id: HID, user_id: realUid, handle: "comp-host", display_name: "Comp Host" }]);
  await up("subscriptions", [{ id: SID, host_id: HID, plan: "pro", status: "active" }]);
  await up("affiliate_referrals", [{
    id: REF_ID, affiliate_id: partner.id, referred_user_id: realUid, referred_host_id: HID,
    campaign_id: campaign.id, commission_snapshot: cs, source: "competition", bound_at: daysAgo(40),
  }]);

  // Test 1 — campaign active: earns 60%, stamped with campaign_id.
  await chargeAndAccrue(realUid, 1, plan.price, cur, plan.id);
  {
    const { data: c } = await admin.from("affiliate_commissions")
      .select("commission_amount, rate_value, campaign_id, kind").eq("affiliate_id", partner.id).eq("referred_host_id", HID);
    const row = (c ?? [])[0];
    const amtOk = row && round2(row.commission_amount) === expected;
    const campOk = row && row.campaign_id === campaign.id;
    const pass = amtOk && campOk && (c ?? []).length === 1;
    allPass = allPass && pass;
    console.log(`  [${pass ? "PASS" : "FAIL"}] active campaign → 60% + campaign stamp`);
    console.log(`         R${round2(row?.commission_amount)} (want R${expected}) · rate ${row?.rate_value}% · campaign_id ${campOk ? "stamped ✓" : "MISSING ✗"}`);
  }

  // Test 2 — campaign ENDED: the locked rate must survive (SoT §2.2). Flip status,
  // charge again, assert STILL 60% (not a drop to the 25% default), then restore.
  await admin.from("affiliate_campaigns").update({ status: "ended" }).eq("id", campaign.id);
  try {
    await chargeAndAccrue(realUid, 2, plan.price, cur, plan.id);
    const { data: c2 } = await admin.from("affiliate_commissions")
      .select("commission_amount").eq("affiliate_id", partner.id).eq("referred_host_id", HID).eq("source_ledger_id", CHARGE(2));
    const row2 = (c2 ?? [])[0];
    const pass2 = row2 && round2(row2.commission_amount) === expected;
    allPass = allPass && pass2;
    console.log(`  [${pass2 ? "PASS" : "FAIL"}] campaign ENDED → rate survives (locked on referral)`);
    console.log(`         R${round2(row2?.commission_amount)} (want R${expected} — a drop to R${round2(plan.price * 0.25)} would be the pre-snapshot bug)`);
  } finally {
    await admin.from("affiliate_campaigns").update({ status: startStatus }).eq("id", campaign.id);
    console.log(`  (campaign status restored to '${startStatus}')`);
  }

  console.log("────────────────────────────────────────────────────");
  console.log(allPass ? "COMPETITION COMMISSION PASSES ✓ (60% lifetime, survives campaign end)" : "COMPETITION COMMISSION FAILED ✗");
  if (!allPass) process.exit(1);
}

main().catch((e) => { console.error("COMPETITION TEST FAILED:", e.message); process.exit(1); });
