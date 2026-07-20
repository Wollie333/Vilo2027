import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { Link } from "@/i18n/navigation";

// Public per-campaign leaderboard (WS-1.3). Unauthenticated, live-day-one.
// Score is a live read (total mode) over the referral graph — read-only, no
// money. Only affiliate first-name + initial is shown (public by design, no PII).
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wielo.co.za";
const TOP_N = 50;

type Prize = {
  placing?: number;
  cash?: number;
  floor?: number;
  milestone?: string;
  monthly_top_net_change?: number;
};

type Competition = {
  scoring_mode?: string;
  leaderboard_visibility?: "public" | "partners" | "hidden";
  prizes?: Prize[];
} | null;

// Privacy-friendly display name: first name + last initial, else the slug.
function anonName(
  full: string | null,
  headline: string | null,
  slug: string,
): string {
  const display = (headline ?? "").trim();
  if (display) return display;
  const name = (full ?? "").trim();
  if (!name) return slug;
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

async function getCampaign(slug: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("affiliate_campaigns")
    .select(
      "id, slug, name, status, starts_at, ends_at, competition, rules_doc_slug",
    )
    .ilike("slug", slug)
    .maybeSingle();
  if (!data || data.status === "draft" || data.status === "archived")
    return null;
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const campaign = await getCampaign(params.slug);
  if (!campaign) return { title: "Competition not found" };
  const brandName = await getBrandName();
  const title = `${campaign.name} leaderboard · ${brandName}`;
  return {
    title,
    description: `Live standings for the ${campaign.name} on ${brandName}.`,
    alternates: { canonical: `${BASE_URL}/competitions/${campaign.slug}` },
  };
}

export default async function CompetitionLeaderboardPage({
  params,
}: {
  params: { slug: string };
}) {
  const campaign = await getCampaign(params.slug);
  if (!campaign) notFound();

  const brandName = await getBrandName();
  const competition = (campaign.competition ?? null) as Competition;
  const visibility = competition?.leaderboard_visibility ?? "public";
  // Only the public leaderboard renders on this unauthenticated route. 'partners'
  // and 'hidden' campaigns are not exposed here.
  if (visibility !== "public") notFound();

  const admin = createAdminClient();

  // Live standings (total mode). campaign_active_listings is service-role-only.
  const { data: rawScores } = await admin.rpc("campaign_active_listings", {
    p_campaign_id: campaign.id,
  });
  const scores = (rawScores ?? []) as {
    affiliate_id: string;
    active_listings: number;
  }[];

  // Resolve display names for the ranked affiliates.
  const affiliateIds = scores.map((s) => s.affiliate_id);
  const nameByAffiliate = new Map<string, string>();
  if (affiliateIds.length) {
    const { data: accounts } = await admin
      .from("affiliate_accounts")
      .select("id, user_id, slug, display_headline")
      .in("id", affiliateIds);
    const userIds = (accounts ?? []).map((a) => a.user_id);
    const { data: profiles } = userIds.length
      ? await admin
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const fullByUser = new Map(
      (profiles ?? []).map((p) => [p.id, p.full_name]),
    );
    for (const a of accounts ?? []) {
      nameByAffiliate.set(
        a.id,
        anonName(fullByUser.get(a.user_id) ?? null, a.display_headline, a.slug),
      );
    }
  }

  const ranked = scores
    .filter((s) => s.active_listings > 0)
    .sort((a, b) => b.active_listings - a.active_listings)
    .slice(0, TOP_N)
    .map((s, i) => ({
      rank: i + 1,
      name: nameByAffiliate.get(s.affiliate_id) ?? "—",
      listings: s.active_listings,
    }));

  const prizes = (competition?.prizes ?? []).filter(
    (p): p is Prize & { placing: number; cash: number } =>
      typeof p.placing === "number" && typeof p.cash === "number",
  );

  const medal = (rank: number) =>
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  const isLive =
    campaign.status === "active" &&
    (!campaign.ends_at || Date.parse(campaign.ends_at) > Date.now());

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          <Trophy className="h-4 w-4 text-brand-primary" />
          {isLive ? "Live leaderboard" : "Final standings"}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink sm:text-3xl">
          {campaign.name}
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-brand-mute">
          Partners are ranked by the number of live listings from the hosts they
          brought to {brandName}. Standings update daily.
        </p>
        {campaign.rules_doc_slug ? (
          <Link
            href={`/legal/${campaign.rules_doc_slug}`}
            className="mt-3 inline-block text-[13px] font-medium text-brand-primary underline underline-offset-2"
          >
            Competition rules
          </Link>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-line bg-brand-light/50 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                <th className="w-16 px-4 py-3">Rank</th>
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3 text-right">Live listings</th>
              </tr>
            </thead>
            <tbody>
              {ranked.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-brand-mute"
                  >
                    No listings on the board yet — the race is wide open.
                  </td>
                </tr>
              ) : (
                ranked.map((r) => (
                  <tr
                    key={r.rank}
                    className="border-b border-brand-line last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="num font-semibold text-brand-ink">
                        {medal(r.rank) ?? `#${r.rank}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-brand-ink">
                      {r.name}
                    </td>
                    <td className="num px-4 py-3 text-right font-semibold text-brand-ink">
                      {r.listings}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {prizes.length ? (
          <div className="mt-8">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              Prizes
            </div>
            <ul className="mt-3 space-y-1.5 text-[14px] text-brand-ink">
              {prizes.map((p) => (
                <li key={p.placing} className="flex items-center gap-2">
                  <span>{medal(p.placing) ?? `#${p.placing}`}</span>
                  <span className="num font-semibold">
                    R{p.cash.toLocaleString("en-ZA")}
                  </span>
                  {typeof p.floor === "number" ? (
                    <span className="text-brand-mute">
                      + {Math.round(p.floor * 100)}% lifetime commission floor
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
