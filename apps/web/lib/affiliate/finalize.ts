import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { anonName } from "./leaderboard";

// Campaign finalization read layer. The winners themselves are computed in SQL
// (compute_campaign_results, run by the finalize-ended-campaigns cron / the close
// action) and stored on affiliate_campaigns.results as the minimal facts. Here we
// resolve names for display — both the real name (admin) and the anonymised
// publicName (public final leaderboard).

export type CampaignWinner = {
  placing: number;
  affiliateId: string;
  name: string;
  /** first name + last initial — the public final page never shows a surname. */
  publicName: string;
  slug: string;
  score: number;
  cash: number;
  /** floor prize as a percentage (0.2 → 20), for display. */
  floorPct: number;
};

export type CampaignResults = {
  status: string;
  computedAt: string | null;
  publishedAt: string | null;
  winners: CampaignWinner[];
};

type RawWinner = {
  placing: number;
  affiliate_id: string;
  score: number;
  cash: number;
  floor: number;
};

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
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
  const ids = raw.map((w) => w.affiliate_id);
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

  const winners: CampaignWinner[] = raw
    .map((w) => {
      const meta = nameById.get(w.affiliate_id);
      const full = meta?.name ?? "Partner";
      return {
        placing: w.placing,
        affiliateId: w.affiliate_id,
        name: full,
        publicName: anonName(full, meta?.slug || "Partner"),
        slug: meta?.slug ?? "",
        score: Number(w.score),
        cash: Number(w.cash),
        floorPct: Math.round(Number(w.floor) * 10_000) / 100,
      };
    })
    .sort((a, b) => a.placing - b.placing);

  return {
    status: c.status as string,
    computedAt: c.results_computed_at as string | null,
    publishedAt: c.results_published_at as string | null,
    winners,
  };
}
