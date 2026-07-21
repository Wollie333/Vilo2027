import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { ladderRateForBook, nextLadderRung } from "./campaigns";
import type { CommissionStructure, Competition, LadderBand } from "./campaigns";

// ONE loader behind both leaderboard views — the public race page and the
// partner's own Race tab. They must never disagree about a standing, so the
// score, the ranking and the month's movement are all computed here.
//
// Score = live listings from the hosts a partner brought in (campaign_active_
// listings, the same RPC the scoring cron snapshots). "This month" is the change
// since the first snapshot of the current month in affiliate_campaign_daily_
// scores — so it is a real measured delta, not a guess. Before the first
// snapshot of a month exists there is nothing to compare against and the
// movement reads 0 rather than inventing a number.

export type LeaderboardRow = {
  affiliateId: string;
  rank: number;
  name: string;
  /** first name + last initial for the PUBLIC page; full name in the portal. */
  publicName: string;
  slug: string;
  photoUrl: string | null;
  communityName: string | null;
  communityMembers: number | null;
  region: string | null;
  listings: number;
  netThisMonth: number;
};

export type CampaignPrize = {
  placing?: number;
  cash?: number;
  floor?: number;
  milestone?: string;
  monthly_top_net_change?: number;
};

export type LeaderboardData = {
  campaign: {
    id: string;
    slug: string;
    name: string;
    status: string;
    startsAt: string | null;
    endsAt: string | null;
    rulesDocSlug: string | null;
    maxParticipants: number | null;
    competition: Competition | null;
    structure: CommissionStructure | null;
  };
  rows: LeaderboardRow[];
  /** Sum of every partner's live listings — the hero's "hosts live right now". */
  totalListings: number;
  /** Places in the race: the cap when set, else the number taking part. */
  partnerSlots: number;
  prizes: CampaignPrize[];
  /** Total cash across placing prizes + milestones, for the hero pill. */
  prizePotZar: number;
  monthsElapsed: number | null;
  monthsTotal: number | null;
};

/** First name + last initial — the public page never shows a full surname. */
export function anonName(full: string | null, fallback: string): string {
  const name = (full ?? "").trim();
  if (!name) return fallback;
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

function monthsBetween(from: Date, to: Date): number {
  return Math.max(
    0,
    (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth() - from.getMonth()),
  );
}

export async function loadCampaignLeaderboard(
  slug: string,
): Promise<LeaderboardData | null> {
  const admin = createAdminClient();

  const { data: campaign } = await admin
    .from("affiliate_campaigns")
    .select(
      "id, slug, name, status, starts_at, ends_at, rules_doc_slug, max_participants, competition, commission_structure",
    )
    .ilike("slug", slug)
    .maybeSingle();
  if (!campaign) return null;

  const { data: rawScores } = await admin.rpc("campaign_active_listings", {
    p_campaign_id: campaign.id,
  });
  const scores = (rawScores ?? []) as {
    affiliate_id: string;
    active_listings: number;
  }[];

  // Month-start baseline for the "this month" delta.
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  const { data: baseline } = await admin
    .from("affiliate_campaign_daily_scores")
    .select("affiliate_id, active_listings, score_date")
    .eq("campaign_id", campaign.id)
    .gte("score_date", monthStart)
    .order("score_date", { ascending: true });

  // Earliest snapshot this month per affiliate = where they started the month.
  const startOfMonthByAffiliate = new Map<string, number>();
  for (const s of baseline ?? []) {
    if (!startOfMonthByAffiliate.has(s.affiliate_id)) {
      startOfMonthByAffiliate.set(s.affiliate_id, Number(s.active_listings));
    }
  }

  // Partner identities. Everyone ENROLLED appears, even on zero, so a partner
  // who has just joined can see themselves in the race.
  const { data: enrollments } = await admin
    .from("affiliate_campaign_enrollments")
    .select("affiliate_id")
    .eq("campaign_id", campaign.id)
    .eq("status", "active");

  const ids = Array.from(
    new Set([
      ...scores.map((s) => s.affiliate_id),
      ...(enrollments ?? []).map((e) => e.affiliate_id as string),
    ]),
  );

  const rows: LeaderboardRow[] = [];
  if (ids.length) {
    const { data: accounts } = await admin
      .from("affiliate_accounts")
      .select(
        "id, user_id, slug, photo_url, community_name, community_members, region",
      )
      .in("id", ids);
    const userIds = (accounts ?? []).map((a) => a.user_id as string);
    const { data: profiles } = userIds.length
      ? await admin
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameByUser = new Map(
      (profiles ?? []).map((p) => [p.id, p.full_name as string | null]),
    );
    const scoreById = new Map(
      scores.map((s) => [s.affiliate_id, Number(s.active_listings)]),
    );

    for (const a of accounts ?? []) {
      const listings = scoreById.get(a.id as string) ?? 0;
      const started = startOfMonthByAffiliate.get(a.id as string);
      const full = nameByUser.get(a.user_id as string) ?? null;
      rows.push({
        affiliateId: a.id as string,
        rank: 0,
        name: full || "Partner",
        publicName: anonName(full, (a.slug as string) || "Partner"),
        slug: a.slug as string,
        photoUrl: (a.photo_url as string | null) ?? null,
        communityName: (a.community_name as string | null) ?? null,
        communityMembers: (a.community_members as number | null) ?? null,
        region: (a.region as string | null) ?? null,
        listings,
        netThisMonth: started === undefined ? 0 : listings - started,
      });
    }
  }

  rows.sort(
    (a, b) => b.listings - a.listings || b.netThisMonth - a.netThisMonth,
  );
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  const competition = (campaign.competition ?? null) as Competition | null;
  const prizes = (competition?.prizes ?? []) as CampaignPrize[];
  const prizePotZar = prizes.reduce(
    (sum, p) =>
      sum + Number(p.cash ?? 0) + Number(p.monthly_top_net_change ?? 0),
    0,
  );

  const startsAt = campaign.starts_at as string | null;
  const endsAt = campaign.ends_at as string | null;

  return {
    campaign: {
      id: campaign.id as string,
      slug: campaign.slug as string,
      name: campaign.name as string,
      status: campaign.status as string,
      startsAt,
      endsAt,
      rulesDocSlug: (campaign.rules_doc_slug as string | null) ?? null,
      maxParticipants: (campaign.max_participants as number | null) ?? null,
      competition,
      structure: (campaign.commission_structure ??
        null) as CommissionStructure | null,
    },
    rows,
    totalListings: rows.reduce((s, r) => s + r.listings, 0),
    partnerSlots: (campaign.max_participants as number | null) ?? rows.length,
    prizes,
    prizePotZar,
    monthsElapsed: startsAt ? monthsBetween(new Date(startsAt), now) : null,
    monthsTotal:
      startsAt && endsAt
        ? monthsBetween(new Date(startsAt), new Date(endsAt))
        : null,
  };
}

/** The partner's own panel on the Race tab. */
export type MyRaceStats = {
  rank: number | null;
  listings: number;
  netThisMonth: number;
  /** Trailing monthly subscription book, in rand (campaign_ladder_book). */
  book: number;
  ratePct: number;
  nextRatePct: number | null;
  /** Rand of book still needed for the next rung. */
  toNextBook: number | null;
  /** Book value at the current and next rung ceiling, for the progress bar. */
  progressPct: number;
};

export async function loadMyRaceStats(
  campaignId: string,
  affiliateId: string,
  structure: CommissionStructure | null,
  rows: LeaderboardRow[],
): Promise<MyRaceStats> {
  const admin = createAdminClient();
  const mine = rows.find((r) => r.affiliateId === affiliateId);

  let book = 0;
  try {
    const { data } = await admin.rpc("campaign_ladder_book", {
      p_affiliate_id: affiliateId,
      p_campaign_id: campaignId,
      p_asof: new Date().toISOString(),
    });
    book = Number(data ?? 0);
  } catch {
    book = 0;
  }

  const bands: LadderBand[] =
    structure?.model === "ladder" ? (structure.bands ?? []) : [];
  const rate = bands.length ? ladderRateForBook(bands, book) : 0;
  const rung = bands.length ? nextLadderRung(bands, book) : null;

  // Progress across the CURRENT band: how far from its floor to its ceiling.
  let progressPct = 0;
  if (rung) {
    const sorted = [...bands].sort(
      (a, b) =>
        (a.max ?? Number.POSITIVE_INFINITY) -
        (b.max ?? Number.POSITIVE_INFINITY),
    );
    const idx = sorted.findIndex((b) => b.max !== null && book <= (b.max ?? 0));
    const floor = idx > 0 ? (sorted[idx - 1]!.max ?? 0) : 0;
    const ceiling = sorted[idx]?.max ?? floor;
    const span = Math.max(1, ceiling - floor);
    progressPct = Math.max(
      0,
      Math.min(100, Math.round(((book - floor) / span) * 100)),
    );
  } else if (bands.length) {
    progressPct = 100;
  }

  return {
    rank: mine?.rank ?? null,
    listings: mine?.listings ?? 0,
    netThisMonth: mine?.netThisMonth ?? 0,
    book,
    ratePct: Math.round(rate * 100),
    nextRatePct: rung ? Math.round(rung.nextRate * 100) : null,
    toNextBook: rung ? rung.toNext : null,
    progressPct,
  };
}
