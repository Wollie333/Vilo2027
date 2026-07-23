import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { anonName } from "./leaderboard";

// Campaign finalization read layer. Winners are computed in SQL
// (compute_campaign_results, run by the finalize-ended-campaigns cron / the close
// action) and stored on affiliate_campaigns.results as typed facts:
//   { kind:'placing', placing, affiliate_id, score, cash, floor }
//   { kind:'milestone', milestone, affiliate_id, cash, floor:0 }
//   { kind:'monthly', period:'YYYY-MM', affiliate_id, score(net change), cash, floor:0 }
// Here we resolve names + build human labels (real name for admin, anonymised
// publicName for the public final).

export type PrizeKind = "placing" | "milestone" | "monthly";

export type RawWinner = {
  kind: PrizeKind;
  placing?: number;
  milestone?: string;
  period?: string;
  affiliate_id: string;
  score?: number;
  cash: number;
  floor: number;
};

export type CampaignWinner = {
  kind: PrizeKind;
  placing: number | null;
  label: string;
  affiliateId: string;
  name: string;
  /** first name + last initial — the public final page never shows a surname. */
  publicName: string;
  slug: string;
  score: number | null;
  cash: number;
  floorPct: number;
};

export type PrizeAward = {
  id: string;
  affiliateId: string;
  name: string;
  slug: string;
  label: string;
  amount: number;
  currency: string;
  status: "owed" | "paid" | "void";
  reference: string | null;
  paidAt: string | null;
};

export type CampaignResults = {
  status: string;
  computedAt: string | null;
  publishedAt: string | null;
  winners: CampaignWinner[];
  /** Cash prizes recorded as payable on publish (empty before publish). */
  prizes: PrizeAward[];
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1] ?? ""} ${y ?? ""}`.trim();
}

/** Human label for a raw prize entry — reused by the admin display, the public
 *  page, the awarded-floor `won_via`, and the prize-payout row. */
export function winnerLabel(w: {
  kind: string;
  placing?: number | null;
  milestone?: string | null;
  period?: string | null;
}): string {
  if (w.kind === "placing" && w.placing) return `${ordinal(w.placing)} place`;
  if (w.kind === "milestone") {
    if (w.milestone === "first_to_10") return "First to 10 listings";
    if (w.milestone === "any_reaching_5_in_30d") return "First to 5 in 30 days";
    return "Milestone prize";
  }
  if (w.kind === "monthly" && w.period) {
    return `Top mover — ${monthLabel(w.period)}`;
  }
  return "Prize";
}

export async function loadCampaignResults(
  campaignId: string,
): Promise<CampaignResults | null> {
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("affiliate_campaigns")
    .select("status, results, results_computed_at, results_published_at")
    .eq("id", campaignId)
    .maybeSingle();
  if (!c) return null;

  const raw = (Array.isArray(c.results) ? c.results : []) as RawWinner[];
  const ids = Array.from(new Set(raw.map((w) => w.affiliate_id)));
  const nameById = new Map<string, { name: string; slug: string }>();
  if (ids.length) {
    const { data: accts } = await admin
      .from("affiliate_accounts")
      .select("id, user_id, slug")
      .in("id", ids);
    const userIds = (accts ?? []).map((a) => a.user_id);
    const { data: profs } = userIds.length
      ? await admin
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const byUser = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
    for (const a of accts ?? []) {
      nameById.set(a.id, {
        name: byUser.get(a.user_id) || "Partner",
        slug: a.slug as string,
      });
    }
  }

  const kindRank: Record<string, number> = {
    placing: 0,
    milestone: 1,
    monthly: 2,
  };
  const winners: CampaignWinner[] = raw
    .map((w) => {
      const meta = nameById.get(w.affiliate_id);
      const full = meta?.name ?? "Partner";
      return {
        kind: w.kind,
        placing: w.placing ?? null,
        label: winnerLabel(w),
        affiliateId: w.affiliate_id,
        name: full,
        publicName: anonName(full, meta?.slug || "Partner"),
        slug: meta?.slug ?? "",
        score: w.score ?? null,
        cash: Number(w.cash ?? 0),
        floorPct: Math.round(Number(w.floor ?? 0) * 10_000) / 100,
      };
    })
    .sort(
      (a, b) =>
        (kindRank[a.kind] ?? 9) - (kindRank[b.kind] ?? 9) ||
        (a.placing ?? 99) - (b.placing ?? 99) ||
        a.label.localeCompare(b.label),
    );

  // Cash-prize payables (exist only once published). Reuse the winner names,
  // resolving any stragglers directly.
  const { data: prizeRows } = await admin
    .from("affiliate_prize_awards")
    .select(
      "id, affiliate_id, label, amount, currency, status, reference, paid_at",
    )
    .eq("campaign_id", campaignId)
    .order("status", { ascending: true })
    .order("amount", { ascending: false });

  const prizeIds = Array.from(
    new Set((prizeRows ?? []).map((p) => p.affiliate_id)),
  ).filter((id) => !nameById.has(id));
  if (prizeIds.length) {
    const { data: accts } = await admin
      .from("affiliate_accounts")
      .select("id, user_id, slug")
      .in("id", prizeIds);
    const userIds = (accts ?? []).map((a) => a.user_id);
    const { data: profs } = userIds.length
      ? await admin
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const byUser = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
    for (const a of accts ?? []) {
      nameById.set(a.id, {
        name: byUser.get(a.user_id) || "Partner",
        slug: a.slug as string,
      });
    }
  }

  const prizes: PrizeAward[] = (prizeRows ?? []).map((p) => ({
    id: p.id as string,
    affiliateId: p.affiliate_id as string,
    name: nameById.get(p.affiliate_id)?.name ?? "Partner",
    slug: nameById.get(p.affiliate_id)?.slug ?? "",
    label: p.label as string,
    amount: Number(p.amount),
    currency: (p.currency as string) ?? "ZAR",
    status: p.status as "owed" | "paid" | "void",
    reference: (p.reference as string | null) ?? null,
    paidAt: (p.paid_at as string | null) ?? null,
  }));

  return {
    status: c.status as string,
    computedAt: c.results_computed_at as string | null,
    publishedAt: c.results_published_at as string | null,
    winners,
    prizes,
  };
}
