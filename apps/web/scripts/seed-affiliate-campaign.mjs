// Seed + TEST the CAMPAIGN affiliate path through the REAL money path.
//
// The default-programme path is already proven (seed-affiliate-default.mjs).
// This one exercises the CAMPAIGN layer, which had never run against real data:
//   campaign-tagged referral -> published listings (scoring) -> charge
//   -> accrue_affiliate_commission (LADDER rate + CONVERSION BONUS, campaign-stamped)
//   -> recompute_affiliate_campaign_rates (whole-book re-level)
//   -> clear -> snapshot_campaign_scores (leaderboard + trend)
// Nothing fakes a commission row; every rand comes out of the production RPCs.
//
//   node --env-file=.env.local scripts/seed-affiliate-campaign.mjs           # from apps/web
//   node --env-file=.env.local scripts/seed-affiliate-campaign.mjs --clean-only
//
// Re-runnable: fixed UUIDs (0e… namespace, distinct from the default seed's 0c…),
// scoped cleanup first. Touches ONLY campaign-tagged rows + its own test hosts —
// it never disturbs the default-programme seed.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Run from apps/web with: node --env-file=.env.local scripts/seed-affiliate-campaign.mjs");
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PARTNER_SLUG = "wollie-steenkamp";
const CAMPAIGN_SLUG = "founding-race";
const PLAN_SLUG = "pro";
const PASSWORD = "WieloStarter123!";
const CLEAN_ONLY = process.argv.includes("--clean-only");

// Campaign-referred hosts (0e namespace). listings = how many published
// properties each has (drives scoring); charges = current-month subscription
// charges (drives the ladder book + conversion bonus).
const HOSTS = [
  { key: "a", email: "camp-host-a@wielostarter.com", name: "Lerato Dlamini", uid: "0e000000-0000-4000-8000-0000000000a1", hid: "0e000000-0000-4000-8000-0000000000a2", sid: "0e000000-0000-4000-8000-0000000000a3", listings: 3, charges: 2 },
  { key: "b", email: "camp-host-b@wielostarter.com", name: "Pieter Botha", uid: "0e000000-0000-4000-8000-0000000000b1", hid: "0e000000-0000-4000-8000-0000000000b2", sid: "0e000000-0000-4000-8000-0000000000b3", listings: 2, charges: 1 },
  { key: "c", email: "camp-host-c@wielostarter.com", name: "Aisha Patel", uid: "0e000000-0000-4000-8000-0000000000c1", hid: "0e000000-0000-4000-8000-0000000000c2", sid: "0e000000-0000-4000-8000-0000000000c3", listings: 1, charges: 1 },
];
const HOST_HIDS = HOSTS.map((h) => h.hid);
const PROP_ID = (key, i) => `0e000000-0000-4000-8000-c${key}${String(i).padStart(10, "0")}`;
const CHARGE_ID = (key, i) => `0e000000-0000-4000-8000-e${key}${String(i).padStart(10, "0")}`;
const REF_ID = (key) => `0e000000-0000-4000-8000-d${key}0000000000`;
const CLICK_ID = (key) => `0e000000-0000-4000-8000-a${key}0000000000`;

const nowIso = () => new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
// A date inside the CURRENT calendar month (the ladder book only counts this
// month), backed off a few days so it is safely not in the future.
const thisMonth = (dayOffset) => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(28, now.getUTCDate()) - dayOffset, 12, 0, 0));
  return d.toISOString();
};

async function rpc(fn, args) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`rpc ${fn}: ${error.message}`);
  return data;
}
async function del(table, filter) {
  let q = admin.from(table).delete();
  for (const [k, v] of Object.entries(filter)) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
  const { error } = await q;
  if (error && !/no rows/i.test(error.message)) throw new Error(`delete ${table}: ${error.message}`);
}
async function up(table, rows, onConflict = "id") {
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
}
async function findUser(email) {
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const u = data?.users?.find((x) => x.email === email);
    if (u) return u;
    if (!data || data.users.length < 200) break;
  }
  return null;
}
async function ensureAuthUser(email) {
  const existing = await findUser(email);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function main() {
  const { data: partner } = await admin.from("affiliate_accounts").select("id, user_id, status, currency").eq("slug", PARTNER_SLUG).maybeSingle();
  if (!partner) throw new Error(`No affiliate '${PARTNER_SLUG}'`);
  if (partner.status !== "active") throw new Error(`Partner is ${partner.status}`);
  const { data: camp } = await admin.from("affiliate_campaigns").select("id, status, commission_structure").eq("slug", CAMPAIGN_SLUG).maybeSingle();
  if (!camp) throw new Error(`No campaign '${CAMPAIGN_SLUG}'`);
  if (camp.status !== "active") throw new Error(`Campaign is ${camp.status}, not active — accrual won't use the campaign structure`);
  const { data: plan } = await admin.from("products").select("id, price, currency").eq("slug", PLAN_SLUG).maybeSingle();
  if (!plan) throw new Error(`No product '${PLAN_SLUG}'`);
  const CUR = partner.currency ?? "ZAR";
  console.log(`Partner ${PARTNER_SLUG} · campaign ${CAMPAIGN_SLUG} (${camp.id}) · plan R${plan.price}`);

  // ── CLEAN (campaign-scoped only; never touches the default seed) ───────────
  console.log("Cleaning prior campaign test data…");
  const { data: campComms } = await admin.from("affiliate_commissions").select("id").eq("campaign_id", camp.id);
  const campCommIds = (campComms ?? []).map((r) => r.id);
  if (campCommIds.length) {
    // Emitted ledger rows point back at these commissions (SET NULL on delete,
    // but we remove them so a re-run starts clean).
    await del("platform_ledger", { affiliate_commission_id: campCommIds });
  }
  await del("affiliate_commissions", { campaign_id: camp.id });
  await del("affiliate_referrals", { campaign_id: camp.id });
  await del("affiliate_clicks", { campaign_id: camp.id });
  await del("affiliate_campaign_daily_scores", { campaign_id: camp.id });
  await del("affiliate_campaign_floors", { campaign_id: camp.id, affiliate_id: partner.id });
  await del("affiliate_campaign_enrollments", { campaign_id: camp.id, affiliate_id: partner.id });
  // Test-host artefacts (scoped by the FIXED host_id).
  await del("platform_ledger", { host_id: HOST_HIDS });
  await del("properties", { host_id: HOST_HIDS });
  await del("subscriptions", { host_id: HOST_HIDS });

  if (CLEAN_ONLY) { console.log("Clean-only done."); return; }

  // ── Enroll the partner in the campaign ─────────────────────────────────────
  await up("affiliate_campaign_enrollments",
    [{ affiliate_id: partner.id, campaign_id: camp.id, status: "active", enrolled_at: daysAgo(60) }],
    "affiliate_id,campaign_id");

  // ── Seed campaign-referred hosts with published listings ───────────────────
  for (const h of HOSTS) {
    const uid = await ensureAuthUser(h.email);
    h.realUid = uid;
    await up("user_profiles", [{ id: uid, role: "host", full_name: h.name, email: h.email, email_verified_at: nowIso() }]);
    await up("hosts", [{ id: h.hid, user_id: uid, handle: `camp-host-${h.key}`, display_name: h.name }]);
    // trg_host_default_business auto-creates a business on first insert.
    const { data: biz } = await admin.from("businesses").select("id").eq("host_id", h.hid).order("created_at").limit(1).maybeSingle();
    if (!biz) throw new Error(`no business auto-created for host ${h.key}`);
    // Published listings drive campaign_active_listings (the score).
    const props = Array.from({ length: h.listings }, (_, i) => ({
      id: PROP_ID(h.key, i + 1), host_id: h.hid, business_id: biz.id,
      property_type: "accommodation", name: `${h.name.split(" ")[0]}'s place ${i + 1}`,
      is_published: true, is_suspended: false,
    }));
    await up("properties", props);
    await up("subscriptions", [{ id: h.sid, host_id: h.hid, plan: "pro", status: "active" }]);
    await up("affiliate_referrals", [{ id: REF_ID(h.key), affiliate_id: partner.id, referred_user_id: uid, referred_host_id: h.hid, campaign_id: camp.id, source: "seed", bound_at: daysAgo(55) }]);
    await up("affiliate_clicks", [{ id: CLICK_ID(h.key), affiliate_id: partner.id, slug: PARTNER_SLUG, campaign_id: camp.id, landing_path: "/competitions/founding-race", created_at: daysAgo(56) }]);
    console.log(`  host ${h.key} ${h.name} — ${h.listings} listing(s), ${h.charges} charge(s)`);
  }

  // ── Charges (current month) → REAL campaign accrual ────────────────────────
  for (const h of HOSTS) {
    for (let i = 1; i <= h.charges; i++) {
      const id = CHARGE_ID(h.key, i);
      const when = thisMonth(i * 2);
      await up("platform_ledger", [{
        id, user_id: h.realUid, host_id: h.hid, subscription_id: h.sid,
        product_id: plan.id, plan: PLAN_SLUG, billing_cycle: "monthly",
        type: "charge", status: "completed", amount: plan.price, currency: CUR,
        vat_amount: 0, setup_fee_amount: 0, is_prorated_upgrade: false,
        provider: "seed", provider_reference: `CAMP-${h.key}-${i}`,
        environment: "test", paid_at: when, period_start: when, created_at: when,
      }]);
      const cid = await rpc("accrue_affiliate_commission", { p_ledger_id: id });
      console.log(`  charge ${h.key}#${i} R${plan.price} → commission ${cid ?? "(none)"}`);
    }
  }

  // ── Whole-book re-level (the daily cron) ───────────────────────────────────
  const releveled = await rpc("recompute_affiliate_campaign_rates");
  console.log(`Recompute re-levelled ${releveled} pending row(s) to the current book's ladder rate`);

  // ── Clear the campaign commissions (mimic the hourly clearing cron) ────────
  await admin.from("affiliate_commissions").update({ hold_until: daysAgo(1) })
    .eq("campaign_id", camp.id).eq("status", "pending").eq("entry_type", "accrual");
  const { data: cleared } = await admin.from("affiliate_commissions")
    .update({ status: "cleared", cleared_at: nowIso() })
    .eq("campaign_id", camp.id).eq("status", "pending").eq("entry_type", "accrual").lte("hold_until", nowIso())
    .select("id");
  console.log(`Cleared ${cleared?.length ?? 0} campaign commission(s)`);

  // ── Scoring: a week of history for the trend + today's real snapshot ───────
  // Simulate the daily cron having run: listings climbed over the week.
  const totalListings = HOSTS.reduce((s, h) => s + h.listings, 0);
  for (let d = 7; d >= 1; d--) {
    const date = daysAgo(d).slice(0, 10);
    for (const h of HOSTS) {
      // Ramp: earlier days show fewer listings, converging to today's real count.
      const grown = Math.max(0, h.listings - Math.floor((d - 1) / 3));
      await up("affiliate_campaign_daily_scores",
        [{ campaign_id: camp.id, affiliate_id: partner.id, score_date: date, active_listings: grown, score: grown }],
        "campaign_id,affiliate_id,score_date");
    }
  }
  const scored = await rpc("snapshot_campaign_scores");
  console.log(`Snapshot wrote ${scored} row(s) for today (total live listings = ${totalListings})`);

  // ── REPORT ─────────────────────────────────────────────────────────────────
  console.log("\n─── CAMPAIGN VERIFICATION ──────────────────────────────────");
  const { data: comms } = await admin.from("affiliate_commissions")
    .select("kind, entry_type, rate_type, rate_value, base_amount, commission_amount, status, referred_host_id, campaign_id")
    .eq("campaign_id", camp.id).order("created_at", { ascending: true });
  const hostName = Object.fromEntries(HOSTS.map((h) => [h.hid, h.name]));
  for (const c of comms ?? []) {
    console.log(`  ${(hostName[c.referred_host_id] ?? "?").padEnd(16)} ${c.kind.padEnd(16)} ${c.entry_type.padEnd(8)} ${String(c.rate_value).padStart(6)}${c.rate_type === "percent" ? "%" : ""}  base R${Number(c.base_amount).toFixed(2).padStart(8)} → R${Number(c.commission_amount).toFixed(2).padStart(8)} [${c.status}]`);
  }
  const { data: scores } = await admin.rpc("campaign_active_listings", { p_campaign_id: camp.id });
  console.log(`  Live listings (scoring): ${(scores ?? []).reduce((s, r) => s + Number(r.active_listings), 0)}`);
  const book = await rpc("campaign_ladder_book", { p_affiliate_id: partner.id, p_campaign_id: camp.id, p_asof: nowIso() });
  console.log(`  Current-month ladder book: R${Number(book).toFixed(2)}`);
  const { data: funnel } = await admin.rpc("campaign_funnel", { p_campaign_id: camp.id });
  console.log(`  Funnel: ${JSON.stringify(Array.isArray(funnel) ? funnel[0] : funnel)}`);
  console.log("────────────────────────────────────────────────────────────");
  console.log("Done. Open Admin → Affiliates → Campaigns → Founding Race → Metrics.");
}

main().catch((e) => { console.error("CAMPAIGN SEED FAILED:", e.message); process.exit(1); });
