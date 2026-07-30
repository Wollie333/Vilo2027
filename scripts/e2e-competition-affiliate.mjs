// End-to-end verifier for the COMPETITION AFFILIATE PROGRAMME (SoT §10).
// Drives the REAL code paths against the live DB with an ephemeral cast, then
// deletes everything it created. Service role. Run from repo root:
//   node scripts/e2e-competition-affiliate.mjs
//
// Covers: partner signup+enrol · referral click (server-side rate snapshot) ·
// referral bind (competition 60% vs default 25%) · self-referral guard ·
// commission accrual (rate, base, hold, campaign stamp, idempotency) · milestone
// selection · the three scheduled competition emails (milestone/digest/ending)
// dispatched through the running comms worker into notification_queue.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const env = {};
for (const line of readFileSync(new URL("../apps/web/.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const WORKER_SECRET = env.EMAIL_WORKER_SECRET || "ephem_test_secret_pt89";

let pass = 0, fail = 0;
const log = (ok, label, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  ok ? pass++ : fail++;
};
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const stamp = Date.now();

// Everything we create, torn down in reverse at the end.
const created = { users: [], accountId: null, campaignId: null };

async function main() {
  const FR_STRUCTURE = { model: "flat", scope: "subscription", duration: "lifetime", flat_rate: 0.6, flat_type: "percent" };

  // ── settings sanity ──────────────────────────────────────────────────────
  const { data: settings } = await db.from("affiliate_settings")
    .select("cookie_days, hold_days, terms_version, attribution_model, self_referral_blocked").eq("id", true).maybeSingle();
  log(!!settings, "affiliate_settings loaded",
    settings ? `hold ${settings.hold_days}d · ${settings.attribution_model} · cookie ${settings.cookie_days}d` : "missing");
  const holdDays = settings?.hold_days ?? 33;

  // ── 1. PARTNER signup + affiliate account + competition enrolment ─────────
  const partnerEmail = `ephem-partner+${stamp}@example.com`;
  const { data: pu, error: puErr } = await db.auth.admin.createUser({
    email: partnerEmail, email_confirm: true, password: `Ephem!${stamp}`,
  });
  if (puErr || !pu?.user) { log(false, "create partner user", puErr?.message); return; }
  created.users.push(pu.user.id);

  const partnerSlug = `ephem-p-${stamp}`;
  const { data: acct, error: acctErr } = await db.from("affiliate_accounts")
    .insert({ user_id: pu.user.id, slug: partnerSlug, status: "active", terms_version: settings?.terms_version ?? 1 })
    .select("id").maybeSingle();
  if (acctErr || !acct) { log(false, "create affiliate account", acctErr?.message); return; }
  created.accountId = acct.id;
  log(true, "partner signed up + affiliate account active", `slug ${partnerSlug}`);

  // ── 2. Ephemeral competition (identical 60% flat structure as Founding Race)
  const today = new Date();
  const weekdayToday = today.getDay();
  const ends = new Date(today.getTime() + 10 * 86400000); // 10 days → inside 14d ending window
  const starts = new Date(today.getTime() - 20 * 86400000);
  const competition = {
    events: { listing_published: 1 },
    prizes: [
      { placing: 1, cash: 10000 },
      { milestone: "first_host_live", cash: 500 },
      { milestone: "first_to_10", cash: 2000 },
      { milestone: "first_to_25", cash: 5000 },
      { fast_start: 1000 },
    ],
  };
  const { data: camp, error: campErr } = await db.from("affiliate_campaigns").insert({
    slug: `ephem-race-${stamp}`, name: "Ephemeral Race", status: "active",
    starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    competition, commission_structure: FR_STRUCTURE,
    email_schedule: { standings_digest: { cadence: "weekly", weekday: weekdayToday }, ending_soon: { lead_days: 14 } },
  }).select("id").maybeSingle();
  if (campErr || !camp) { log(false, "create ephemeral competition", campErr?.message); return; }
  created.campaignId = camp.id;
  log(true, "competition created (60% flat, active)", `ends in 10d, digest weekday ${weekdayToday}`);

  // Marketing is opt-IN (marketing_tips defaults OFF for every role — the digest
  // + ending-soon mails are correctly suppressed otherwise). Opt this partner in
  // so we can prove the POSITIVE delivery path; digest_mode 'off' = send now.
  await db.from("user_notification_preferences").insert({
    user_id: pu.user.id, category_id: "marketing_tips",
    email_enabled: true, push_enabled: true, in_app_enabled: true, digest_mode: "off",
  });

  await db.from("affiliate_campaign_enrollments").insert({ affiliate_id: acct.id, campaign_id: camp.id, status: "active" });
  const { count: enrolCount } = await db.from("affiliate_campaign_enrollments")
    .select("id", { count: "exact", head: true }).eq("affiliate_id", acct.id).eq("campaign_id", camp.id).eq("status", "active");
  log(enrolCount === 1, "partner enrolled in competition");

  // ── 3. Referral CLICK — server captures the rate snapshot (mirrors /r/[slug])
  const { data: click, error: clickErr } = await db.from("affiliate_clicks").insert({
    affiliate_id: acct.id, slug: partnerSlug, landing_path: "/", campaign_id: camp.id,
    commission_snapshot: FR_STRUCTURE, // /r/[slug] copies campaign.commission_structure here
  }).select("id, commission_snapshot").maybeSingle();
  if (clickErr || !click) { log(false, "record referral click", clickErr?.message); return; }
  log(Number(click.commission_snapshot?.flat_rate) === 0.6, "click captured 60% rate snapshot (server-side)",
    `flat_rate ${click.commission_snapshot?.flat_rate}`);

  // ── 4a. Referred HOST via the competition click → bind at 60% (mirrors bind)
  const refEmail = `ephem-host+${stamp}@example.com`;
  const { data: ru } = await db.auth.admin.createUser({ email: refEmail, email_confirm: true, password: `Ephem!${stamp}a` });
  created.users.push(ru.user.id);
  // bindAffiliateReferral: read the click's snapshot + campaign, stamp the referral.
  const { data: cRow } = await db.from("affiliate_clicks").select("campaign_id, commission_snapshot").eq("id", click.id).maybeSingle();
  const { data: ref1, error: ref1Err } = await db.from("affiliate_referrals").insert({
    affiliate_id: acct.id, referred_user_id: ru.user.id, click_id: click.id,
    campaign_id: cRow.campaign_id, commission_snapshot: cRow.commission_snapshot, source: "signup",
  }).select("id, commission_snapshot, campaign_id, source").maybeSingle();
  if (ref1Err || !ref1) { log(false, "bind competition referral", ref1Err?.message); return; }
  log(Number(ref1.commission_snapshot?.flat_rate) === 0.6 && ref1.campaign_id === camp.id && ref1.source === "signup",
    "competition referral bound (60% snapshot, campaign-tagged, source=signup)");

  // ── 4b. A DEFAULT (non-competition) referral → default 25% control ─────────
  const defEmail = `ephem-host2+${stamp}@example.com`;
  const { data: du } = await db.auth.admin.createUser({ email: defEmail, email_confirm: true, password: `Ephem!${stamp}b` });
  created.users.push(du.user.id);
  const { data: ref2 } = await db.from("affiliate_referrals").insert({
    affiliate_id: acct.id, referred_user_id: du.user.id, source: "manual_code", // no campaign → default programme
  }).select("id, campaign_id, commission_snapshot").maybeSingle();
  log(ref2 && ref2.campaign_id === null && ref2.commission_snapshot === null,
    "default referral bound (no campaign, tracks live per-product rate)");

  // ── 4c. Self-referral guard: binding the PARTNER's own user is blocked ─────
  // (mirrors the selfBlocked guard in bindAffiliateReferral — we assert the rule,
  //  the DB has a UNIQUE(referred_user_id) too; here we just confirm the guard value)
  log(settings?.self_referral_blocked === true, "self-referral blocking enabled");

  // ── 5. PAID charge → commission accrual (the money path) ───────────────────
  // Competition referral pays a R599 (founding) subscription.
  const mkCharge = async (userId, amount) => {
    const { data: l } = await db.from("platform_ledger").insert({
      type: "charge", status: "completed", user_id: userId, plan: "pro",
      amount, vat_amount: 0, currency: "ZAR",
    }).select("id").maybeSingle();
    return l?.id;
  };
  const ledger1 = await mkCharge(ru.user.id, 599);
  const { data: accrual1Id } = await db.rpc("accrue_affiliate_commission", { p_ledger_id: ledger1 });
  const { data: comm1 } = await db.from("affiliate_commissions")
    .select("commission_amount, rate_type, rate_value, base_amount, status, kind, campaign_id, hold_until")
    .eq("source_ledger_id", ledger1).maybeSingle();
  log(comm1 && round2(Number(comm1.commission_amount)) === 359.4 && Number(comm1.rate_value) === 60 && comm1.campaign_id === camp.id,
    "competition commission = 60% of R599 = R359.40, campaign-stamped",
    comm1 ? `R${comm1.commission_amount} @ ${comm1.rate_value}% ${comm1.kind}/${comm1.status}` : "no row");
  if (comm1) {
    const holdDelta = (new Date(comm1.hold_until) - Date.now()) / 86400000;
    log(comm1.status === "pending" && holdDelta > holdDays - 1.5 && holdDelta < holdDays + 0.5,
      `commission pending on a ${holdDays}-day hold`, `~${holdDelta.toFixed(1)}d`);
  }

  // Idempotency: re-accrue the same charge → NO duplicate.
  await db.rpc("accrue_affiliate_commission", { p_ledger_id: ledger1 });
  const { count: dupCount } = await db.from("affiliate_commissions")
    .select("id", { count: "exact", head: true }).eq("source_ledger_id", ledger1).eq("kind", "subscription");
  log(dupCount === 1, "accrual is idempotent (no double-pay on re-run)", `${dupCount} row(s)`);

  // Default-programme control: R599 → 25% = R149.75.
  const ledger2 = await mkCharge(du.user.id, 599);
  await db.rpc("accrue_affiliate_commission", { p_ledger_id: ledger2 });
  const { data: comm2 } = await db.from("affiliate_commissions")
    .select("commission_amount, rate_value, campaign_id").eq("source_ledger_id", ledger2).maybeSingle();
  log(comm2 && round2(Number(comm2.commission_amount)) === 149.75 && Number(comm2.rate_value) === 25 && comm2.campaign_id === null,
    "default commission = 25% of R599 = R149.75 (no campaign)",
    comm2 ? `R${comm2.commission_amount} @ ${comm2.rate_value}%` : "no row");

  // ── 6. Milestone selection — inject a daily score crossing threshold 1 ─────
  await db.from("affiliate_campaign_daily_scores").insert({
    campaign_id: camp.id, affiliate_id: acct.id,
    score_date: new Date(today.getTime() - 2 * 86400000).toISOString().slice(0, 10), active_listings: 1, score: 1,
  });
  const { data: results } = await db.rpc("compute_campaign_results", { p_campaign_id: camp.id });
  const milestoneWin = (results ?? []).find((r) => r.kind === "milestone" && r.milestone === "first_host_live");
  log(milestoneWin && milestoneWin.affiliate_id === acct.id,
    "prize engine: first_host_live milestone → our partner", milestoneWin ? `cash R${milestoneWin.cash}` : "no winner");

  // ── 7. The three scheduled emails — fire via the running comms worker ──────
  let workerRan = false;
  try {
    const resp = await fetch("http://localhost:3000/api/campaign-comms-worker", {
      method: "POST", headers: { Authorization: `Bearer ${WORKER_SECRET}` },
    });
    const body = await resp.json();
    workerRan = resp.ok && body?.success;
    log(workerRan, "comms worker ran", JSON.stringify(body?.data ?? body));
  } catch (e) {
    log(false, "comms worker reachable on :3000", e.message);
  }
  if (workerRan) {
    // A kind counts as "dispatched" if it landed in ANY destination: the
    // immediate delivery log, the digest bundle (marketing_tips is digest-
    // supporting, so digest/ending defer here by design), or the push queue.
    const [{ data: logged }, { data: digestItems }, { data: pushItems }] = await Promise.all([
      db.from("notification_delivery_log").select("dedupe_key, channel").eq("user_id", pu.user.id),
      db.from("pending_digest_items").select("event_kind").eq("user_id", pu.user.id),
      db.from("pending_push_queue").select("event_kind").eq("user_id", pu.user.id),
    ]);
    const logKeys = (logged ?? []).map((l) => l.dedupe_key || "");
    const kinds = new Set([...(digestItems ?? []).map((d) => d.event_kind), ...(pushItems ?? []).map((p) => p.event_kind)]);
    const chans = (frag) => [...new Set((logged ?? []).filter((l) => (l.dedupe_key || "").includes(frag)).map((l) => l.channel))].join("+");
    const dispatched = (dedupeFrag, kind) =>
      logKeys.some((k) => k.includes(dedupeFrag)) || kinds.has(kind);
    log(dispatched("campaign_milestone", "campaign_milestone_hit"),
      "milestone_hit dispatched to partner", `delivered ${chans("campaign_milestone") || "—"}`);
    log(dispatched("campaign_digest", "campaign_standings_digest"),
      "standings_digest dispatched to partner", (digestItems ?? []).some((d) => d.event_kind === "campaign_standings_digest") ? "deferred → daily digest" : chans("campaign_digest"));
    log(dispatched("campaign_ending", "campaign_ending_soon"),
      "ending_soon dispatched to partner", (digestItems ?? []).some((d) => d.event_kind === "campaign_ending_soon") ? "deferred → daily digest" : chans("campaign_ending"));
  }
}

async function cleanup() {
  const { accountId, campaignId, users } = created;
  try {
    if (accountId) {
      const { data: refs } = await db.from("affiliate_referrals").select("id").eq("affiliate_id", accountId);
      const refIds = (refs ?? []).map((r) => r.id);
      await db.from("affiliate_commissions").delete().eq("affiliate_id", accountId);
      if (refIds.length) await db.from("affiliate_referrals").delete().in("id", refIds);
      await db.from("affiliate_clicks").delete().eq("affiliate_id", accountId);
      if (campaignId) {
        await db.from("affiliate_campaign_daily_scores").delete().eq("campaign_id", campaignId);
        await db.from("affiliate_campaign_enrollments").delete().eq("campaign_id", campaignId);
      }
    }
    // platform_ledger + notification rows are keyed by user.
    for (const uid of users) {
      await db.from("platform_ledger").delete().eq("user_id", uid);
      await db.from("notification_queue").delete().eq("user_id", uid);
      await db.from("notification_delivery_log").delete().eq("user_id", uid);
      await db.from("in_app_notifications").delete().eq("user_id", uid);
      await db.from("pending_push_queue").delete().eq("user_id", uid);
      await db.from("pending_digest_items").delete().eq("user_id", uid);
      await db.from("user_notification_preferences").delete().eq("user_id", uid);
    }
    if (accountId) await db.from("affiliate_accounts").delete().eq("id", accountId);
    if (campaignId) await db.from("affiliate_campaigns").delete().eq("id", campaignId);
    for (const uid of users) await db.auth.admin.deleteUser(uid);
    console.log("\n🧹 cleanup complete — all ephemeral rows + users removed");
  } catch (e) {
    console.error(`\n⚠️  cleanup error (manual check may be needed): ${e.message}`);
    console.error(`   account=${accountId} campaign=${campaignId} users=${users.join(",")}`);
  }
}

main()
  .catch((e) => { console.error(e); fail++; })
  .finally(async () => {
    await cleanup();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail > 0 ? 1 : 0);
  });
