import type { Metadata } from "next";
import { Trophy } from "lucide-react";

import { getAffiliateForUser } from "@/lib/affiliate/account";
import {
  describeCommissionStructure,
  ladderRateForBook,
  nextLadderRung,
  type CommissionStructure,
  type LadderBand,
} from "@/lib/affiliate/campaigns";
import { getPublishedLegalDocument } from "@/lib/legalDocuments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { CampaignCard } from "../_components/CampaignCard";

export const metadata: Metadata = { title: "Competitions" };
export const dynamic = "force-dynamic";

const zar = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

export default async function AffiliateCompetitionsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const me = await getAffiliateForUser(admin, user.id);
  if (!me) return null; // layout shows the terms gate

  async function placesLeftFor(
    campaignId: string,
    cap: number | null,
  ): Promise<number | null> {
    if (cap == null) return null;
    const { count } = await admin
      .from("affiliate_campaign_enrollments")
      .select("affiliate_id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "active");
    return Math.max(0, cap - (count ?? 0));
  }

  // Active campaigns (any partner may join 'all'/'tagged'); projection price is
  // the live subscription plan price (config-driven — admin edits the product).
  const [{ data: campaigns }, { data: enrollments }, { data: planProduct }] =
    await Promise.all([
      admin
        .from("affiliate_campaigns")
        .select(
          "id, slug, name, status, ends_at, eligible_partners, commission_structure, competition, rules_doc_slug, max_participants",
        )
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      admin
        .from("affiliate_campaign_enrollments")
        .select("campaign_id, status")
        .eq("affiliate_id", me.id)
        .eq("status", "active"),
      admin
        .from("products")
        .select("price")
        .eq("slug", "pro")
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  const perHostPrice = Number(planProduct?.price ?? 599);
  const enrolledIds = new Set(
    (enrollments ?? []).map((e) => e.campaign_id as string),
  );
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://wielo.co.za";

  const list = campaigns ?? [];

  // Live standings per campaign (total mode). Compute my score + rank.
  const cards = await Promise.all(
    list.map(async (c) => {
      const cs = (c.commission_structure ?? {
        model: "inherit",
      }) as CommissionStructure;
      const bands: LadderBand[] = cs.model === "ladder" ? (cs.bands ?? []) : [];

      const { data: scores } = await admin.rpc("campaign_active_listings", {
        p_campaign_id: c.id,
      });
      const rows = (
        (scores ?? []) as {
          affiliate_id: string;
          active_listings: number;
        }[]
      )
        .filter((s) => s.active_listings > 0)
        .sort((a, b) => b.active_listings - a.active_listings);
      const myIdx = rows.findIndex((s) => s.affiliate_id === me.id);
      const myScore = myIdx >= 0 ? rows[myIdx].active_listings : 0;
      const rank = myIdx >= 0 ? myIdx + 1 : null;

      // Projection calculator (potential, CPA-safe).
      const potentialBook = myScore * perHostPrice;
      const potentialRate = bands.length
        ? ladderRateForBook(bands, potentialBook)
        : 0;
      const rung = bands.length ? nextLadderRung(bands, potentialBook) : null;

      const ladderText = bands.length
        ? [...bands]
            .sort(
              (a, b) =>
                (a.max ?? Number.POSITIVE_INFINITY) -
                (b.max ?? Number.POSITIVE_INFINITY),
            )
            .map((b, i, arr) => {
              const lo = i === 0 ? 0 : (arr[i - 1].max ?? 0);
              const hi = b.max;
              const band =
                hi === null
                  ? `${zar(lo)}+ /mo book`
                  : `${zar(lo)}–${zar(hi)} /mo book`;
              return `${band} → ${Math.round(b.rate * 100)}%`;
            })
        : [];

      return {
        id: c.id,
        name: c.name,
        structureSummary: describeCommissionStructure(cs),
        ladderText,
        campaignLink: `${appUrl}/r/${me.slug}?c=${c.slug}`,
        // The campaign link is shown only once the partner has opted in (joined),
        // so appearing on the leaderboard is a deliberate act.
        enrolled: enrolledIds.has(c.id),
        score: myScore,
        rank,
        calculator: {
          listings: myScore,
          perHost: zar(perHostPrice),
          potentialBook: zar(potentialBook),
          potentialRatePct: Math.round(potentialRate * 100),
          potentialMonthly: zar(potentialBook * potentialRate),
          toNext: rung
            ? {
                amount: zar(rung.toNext),
                nextRatePct: Math.round(rung.nextRate * 100),
              }
            : null,
        },
        rulesHref: c.rules_doc_slug ? `/legal/${c.rules_doc_slug}` : null,
        // Accepting this exact version is a condition of entry (enforced in
        // enrollInCampaignAction, not just here).
        rulesVersion: c.rules_doc_slug
          ? ((await getPublishedLegalDocument(c.rules_doc_slug))?.version ??
            null)
          : null,
        // Places left on a capped competition (null = unlimited). Display only —
        // the cap is enforced by the DB when the join actually happens.
        placesLeft: await placesLeftFor(
          c.id as string,
          c.max_participants as number | null,
        ),
        campaignSlug: c.slug as string,
      };
    }),
  );

  return (
    <div>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        <Trophy className="h-3.5 w-3.5 text-brand-primary" />
        Competitions
      </div>
      <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-brand-mute">
        Time-boxed partner competitions with their own commission structure and
        a public leaderboard. Share your campaign link, get hosts live, and
        climb.
      </p>

      {cards.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-brand-line bg-white p-8 text-center text-sm text-brand-mute">
          No competitions are running right now. Check back soon.
        </div>
      ) : (
        <div className="mt-6 grid gap-5">
          {cards.map((c) => (
            <CampaignCard key={c.id} campaignId={c.id} {...c} />
          ))}
        </div>
      )}
    </div>
  );
}
