import "server-only";

import { formatMoney } from "@/lib/format";
import { dispatchEvent } from "@/lib/notifications/dispatch";
import type { createAdminClient } from "@/lib/supabase/admin";

import {
  DEFAULT_EMAIL_SCHEDULE,
  parseEmailSchedule,
  type CampaignEmailSchedule,
} from "./emailSchedule";
import { winnerLabel } from "./finalize";

// ──────────────────────────────────────────────────────────────────────────
// Campaign comms sweep — the P2b scheduler (SoT §10.7).
//
// Runs daily (pinged by the drain-campaign-comms pg_cron). For every ACTIVE
// competition it fires the three clock-/state-driven sequence emails, each
// through dispatchEvent so the Communications override layer + the recipient's
// own prefs gate WHETHER it sends; this file only decides WHEN and to WHOM.
//
//   • campaign_milestone_hit   — the moment a partner is first past a threshold
//     (1 / 10 / 25 live listings). One winner per milestone, ever. The winner is
//     picked from the daily-score history exactly like compute_campaign_results,
//     so the heads-up email and the eventual close-time award always agree.
//   • campaign_standings_digest — on the per-campaign cadence (weekly / biweekly
//     / monthly, from affiliate_campaigns.email_schedule).
//   • campaign_ending_soon      — once, when the campaign enters its final
//     lead-days window (survives a missed day via the per-user dedupe key).
//
// Never throws out of a single campaign/recipient — one bad row must not stop
// the sweep. Returns counts for observability.
// ──────────────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof createAdminClient>;

const MILESTONES: { key: string; threshold: number }[] = [
  { key: "first_host_live", threshold: 1 },
  { key: "first_to_10", threshold: 10 },
  { key: "first_to_25", threshold: 25 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const firstName = (full: string | null | undefined): string =>
  (full ?? "").trim().split(/\s+/)[0] || "";

type UserProfile = { email: string | null; full_name: string | null } | null;

type Recipient = {
  affiliateId: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  score: number;
  /** 1-indexed competition rank (ties share a rank). */
  rank: number;
};

type Campaign = {
  id: string;
  name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  competition: Record<string, unknown> | null;
  email_schedule: unknown;
};

/** SA wall-clock Date for a given instant (Africa/Johannesburg, no DST). Its
 *  getFullYear/getMonth/getDate/getDay read the SA calendar day. */
function saLocal(instant: Date): Date {
  return new Date(
    instant.toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }),
  );
}

/** Midnight of a SA wall-clock Date, for whole-day arithmetic. */
function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function humanTimeLeft(days: number): string {
  if (days <= 1) return "1 day";
  if (days < 14) return `${days} days`;
  return `${Math.round(days / 7)} weeks`;
}

function isDigestDueToday(
  sched: CampaignEmailSchedule,
  saToday: Date,
  startsAt: string | null,
): boolean {
  const c = sched.standingsDigest;
  if (c.cadence === "monthly") return saToday.getDate() === 1;
  if (saToday.getDay() !== c.weekday) return false;
  if (c.cadence === "weekly") return true;
  // biweekly: only on an even week count since the campaign started.
  if (!startsAt) return true;
  const weeks = Math.floor(
    (midnight(saToday).getTime() -
      midnight(saLocal(new Date(startsAt))).getTime()) /
      (7 * DAY_MS),
  );
  return weeks % 2 === 0;
}

/** Has ANY delivery of this global-scope dedupe key already gone out? Used for
 *  the once-ever, one-winner milestone gate. */
async function firedGlobally(admin: Db, dedupeKey: string): Promise<boolean> {
  const { data } = await admin
    .from("notification_delivery_log")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .limit(1);
  return !!data && data.length > 0;
}

/** Has this recipient already received this exact (user, dedupe_key) message? */
async function firedForUser(
  admin: Db,
  userId: string,
  dedupeKey: string,
): Promise<boolean> {
  const { data } = await admin
    .from("notification_delivery_log")
    .select("id")
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .limit(1);
  return !!data && data.length > 0;
}

/** Everyone in the competition — enrolled OR signed up through it — ranked by
 *  their live active-listing score. Mirrors the kickoff recipient set. */
async function loadRecipients(
  admin: Db,
  campaignId: string,
): Promise<Recipient[]> {
  const [{ data: enrollments }, { data: signups }] = await Promise.all([
    admin
      .from("affiliate_campaign_enrollments")
      .select("affiliate_id")
      .eq("campaign_id", campaignId)
      .eq("status", "active"),
    admin
      .from("affiliate_accounts")
      .select("id")
      .eq("signup_campaign_id", campaignId)
      .eq("status", "active"),
  ]);
  const ids = Array.from(
    new Set([
      ...(enrollments ?? []).map((e) => e.affiliate_id),
      ...(signups ?? []).map((s) => s.id),
    ]),
  );
  if (!ids.length) return [];

  const [{ data: accts }, { data: scores }] = await Promise.all([
    admin
      .from("affiliate_accounts")
      .select("id, user_id, user:user_profiles!user_id ( email, full_name )")
      .in("id", ids),
    admin.rpc("campaign_active_listings", { p_campaign_id: campaignId }),
  ]);

  const scoreMap = new Map<string, number>(
    ((scores ?? []) as { affiliate_id: string; active_listings: number }[]).map(
      (s) => [s.affiliate_id, s.active_listings],
    ),
  );

  const rows = (accts ?? [])
    .filter((a) => a.user_id)
    .map((a) => {
      const u = (Array.isArray(a.user) ? a.user[0] : a.user) as UserProfile;
      return {
        affiliateId: a.id,
        userId: a.user_id as string,
        email: u?.email ?? null,
        fullName: u?.full_name ?? null,
        score: scoreMap.get(a.id) ?? 0,
        rank: 0,
      };
    })
    .sort(
      (x, y) => y.score - x.score || (x.affiliateId < y.affiliateId ? -1 : 1),
    );

  // Standard competition ranking: equal scores share a rank (1, 2, 2, 4 …).
  let lastScore = Number.NaN;
  let lastRank = 0;
  rows.forEach((r, i) => {
    if (r.score !== lastScore) {
      lastRank = i + 1;
      lastScore = r.score;
    }
    r.rank = lastRank;
  });
  return rows;
}

function prizeCashFor(campaign: Campaign, milestone: string): number {
  const prizes = (campaign.competition?.prizes ?? []) as Record<
    string,
    unknown
  >[];
  const entry = prizes.find((p) => p.milestone === milestone);
  const cash = entry ? Number(entry.cash) : 0;
  return Number.isFinite(cash) ? cash : 0;
}

// ── milestone: first partner past each threshold, one winner ever ────────────
async function sweepMilestones(admin: Db, c: Campaign): Promise<number> {
  const configured = new Set(
    ((c.competition?.prizes ?? []) as Record<string, unknown>[])
      .map((p) => p.milestone)
      .filter((m): m is string => typeof m === "string"),
  );
  let sent = 0;

  for (const { key, threshold } of MILESTONES) {
    if (!configured.has(key)) continue;
    const dedupeKey = `campaign_milestone:${c.id}:${key}`;
    if (await firedGlobally(admin, dedupeKey)) continue;

    // First past the post — earliest daily score to reach the threshold. Same
    // selection as compute_campaign_results, so the email winner == the award.
    const { data: winner } = await admin
      .from("affiliate_campaign_daily_scores")
      .select("affiliate_id")
      .eq("campaign_id", c.id)
      .gte("active_listings", threshold)
      .order("score_date", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!winner?.affiliate_id) continue;

    const { data: acct } = await admin
      .from("affiliate_accounts")
      .select("user_id, user:user_profiles!user_id ( email, full_name )")
      .eq("id", winner.affiliate_id)
      .maybeSingle();
    if (!acct?.user_id) continue;
    const u = (
      Array.isArray(acct.user) ? acct.user[0] : acct.user
    ) as UserProfile;

    const cash = prizeCashFor(c, key);
    await dispatchEvent({
      kind: "campaign_milestone_hit",
      recipientUserId: acct.user_id,
      dedupeKey,
      refs: {
        firstName: firstName(u?.full_name),
        campaignName: c.name ?? "the competition",
        milestoneLabel: winnerLabel({ kind: "milestone", milestone: key }),
        prizeAmount: cash > 0 ? formatMoney(cash, "ZAR") : undefined,
        recipient_email: u?.email ?? undefined,
      },
      supabase: admin,
    });
    sent += 1;
  }
  return sent;
}

// ── standings digest: on cadence, to every enrolled partner ──────────────────
async function sweepDigest(
  admin: Db,
  c: Campaign,
  recipients: Recipient[],
  saToday: Date,
  daysUntilEnd: number | null,
): Promise<number> {
  const sched = c.email_schedule
    ? parseEmailSchedule(c.email_schedule)
    : DEFAULT_EMAIL_SCHEDULE;
  if (!isDigestDueToday(sched, saToday, c.starts_at)) return 0;

  const dayStamp = `${saToday.getFullYear()}-${saToday.getMonth() + 1}-${saToday.getDate()}`;
  const leaderScore = recipients[0]?.score ?? 0;
  const weeksLeft =
    daysUntilEnd != null && daysUntilEnd > 0
      ? `${Math.max(1, Math.ceil(daysUntilEnd / 7))} weeks`
      : undefined;
  let sent = 0;

  for (const r of recipients) {
    const dedupeKey = `campaign_digest:${c.id}:${dayStamp}`;
    if (await firedForUser(admin, r.userId, dedupeKey)) continue;
    const gap = leaderScore - r.score;
    await dispatchEvent({
      kind: "campaign_standings_digest",
      recipientUserId: r.userId,
      dedupeKey,
      refs: {
        firstName: firstName(r.fullName),
        campaignName: c.name ?? "the competition",
        rank: `#${r.rank}`,
        score: String(r.score),
        gap: gap > 0 ? `${gap} listing${gap === 1 ? "" : "s"}` : undefined,
        weeksLeft,
        recipient_email: r.email ?? undefined,
      },
      supabase: admin,
    });
    sent += 1;
  }
  return sent;
}

// ── ending soon: once, inside the final lead-days window ─────────────────────
async function sweepEndingSoon(
  admin: Db,
  c: Campaign,
  recipients: Recipient[],
  daysUntilEnd: number | null,
): Promise<number> {
  if (daysUntilEnd == null || daysUntilEnd < 0) return 0;
  const sched = c.email_schedule
    ? parseEmailSchedule(c.email_schedule)
    : DEFAULT_EMAIL_SCHEDULE;
  if (daysUntilEnd > sched.endingSoon.leadDays) return 0;

  const timeLeft = humanTimeLeft(daysUntilEnd);
  const dedupeKey = `campaign_ending:${c.id}`;
  let sent = 0;

  for (const r of recipients) {
    if (await firedForUser(admin, r.userId, dedupeKey)) continue;
    await dispatchEvent({
      kind: "campaign_ending_soon",
      recipientUserId: r.userId,
      dedupeKey,
      refs: {
        firstName: firstName(r.fullName),
        campaignName: c.name ?? "the competition",
        timeLeft,
        rank: `#${r.rank}`,
        recipient_email: r.email ?? undefined,
      },
      supabase: admin,
    });
    sent += 1;
  }
  return sent;
}

export type CampaignCommsResult = {
  campaigns: number;
  milestone: number;
  digest: number;
  endingSoon: number;
};

/** The full daily sweep across every active competition. Never throws. */
export async function runCampaignCommsSweep(
  admin: Db,
  now: Date = new Date(),
): Promise<CampaignCommsResult> {
  const result: CampaignCommsResult = {
    campaigns: 0,
    milestone: 0,
    digest: 0,
    endingSoon: 0,
  };

  const { data: campaigns } = await admin
    .from("affiliate_campaigns")
    .select("id, name, starts_at, ends_at, competition, email_schedule")
    .eq("status", "active")
    .not("competition", "is", null);
  if (!campaigns?.length) return result;

  const saToday = saLocal(now);

  for (const raw of campaigns as unknown as Campaign[]) {
    result.campaigns += 1;
    try {
      const daysUntilEnd = raw.ends_at
        ? Math.round(
            (midnight(saLocal(new Date(raw.ends_at))).getTime() -
              midnight(saToday).getTime()) /
              DAY_MS,
          )
        : null;

      result.milestone += await sweepMilestones(admin, raw);

      const recipients = await loadRecipients(admin, raw.id);
      if (recipients.length) {
        result.digest += await sweepDigest(
          admin,
          raw,
          recipients,
          saToday,
          daysUntilEnd,
        );
        result.endingSoon += await sweepEndingSoon(
          admin,
          raw,
          recipients,
          daysUntilEnd,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[campaign-comms] campaign ${raw.id} failed: ${msg}`);
    }
  }
  return result;
}
