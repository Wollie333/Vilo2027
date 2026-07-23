import type { Metadata } from "next";
import {
  ArrowRight,
  ChevronRight,
  Flag,
  Megaphone,
  Trophy,
} from "lucide-react";
import { notFound } from "next/navigation";

import { LiveStandings } from "@/components/affiliate/race/LiveStandings";
import { getAffiliateForUser } from "@/lib/affiliate/account";
import type { LadderBand } from "@/lib/affiliate/campaigns";
import {
  loadCampaignLeaderboard,
  loadMyRaceStats,
} from "@/lib/affiliate/leaderboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { AffiliateBaseLink } from "../../_components/AffiliateBaseLink";
import { CopyLinkButton } from "../../_components/CopyLinkButton";
import { LandingPageCard } from "../../_components/LandingPageCard";

import { RaceTabs } from "./RaceTabs";

export const metadata: Metadata = { title: "The Race" };
export const dynamic = "force-dynamic";

function zar(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}

export default async function PartnerRacePage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const me = await getAffiliateForUser(admin, user.id);
  if (!me) return null;

  const data = await loadCampaignLeaderboard(params.slug);
  if (!data) notFound();
  const { campaign, rows, pausedRows, prizes } = data;
  const mine = await loadMyRaceStats(
    campaign.id,
    me.id,
    campaign.structure,
    rows,
    pausedRows,
  );

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://wielo.co.za";
  const raceLink = `${appUrl}/c/${campaign.slug}/${me.slug}`;
  const raceLinkShort = raceLink.replace(/^https?:\/\//, "");

  const endsLabel = campaign.endsAt
    ? new Date(campaign.endsAt).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const daysLeft = campaign.endsAt
    ? Math.max(
        0,
        Math.ceil((Date.parse(campaign.endsAt) - Date.now()) / 86_400_000),
      )
    : null;

  const bands: LadderBand[] =
    campaign.structure?.model === "ladder"
      ? (campaign.structure.bands ?? [])
      : [];
  const sortedBands = [...bands].sort(
    (a, b) =>
      (a.max ?? Number.POSITIVE_INFINITY) - (b.max ?? Number.POSITIVE_INFINITY),
  );

  // Conversion bonus earned (kind='conversion_bonus') for this campaign.
  const { data: bonusRows } = await admin
    .from("affiliate_commissions")
    .select("commission_amount, kind, campaign_id, referral_id, status")
    .eq("affiliate_id", me.id)
    .eq("campaign_id", campaign.id)
    .neq("status", "voided");
  const bonusEarned = (bonusRows ?? [])
    .filter((r) => r.kind === "conversion_bonus")
    .reduce((s, r) => s + Number(r.commission_amount), 0);
  const bonusHosts = new Set(
    (bonusRows ?? [])
      .filter((r) => r.kind === "conversion_bonus")
      .map((r) => r.referral_id),
  ).size;
  const earnedHere = (bonusRows ?? []).reduce(
    (s, r) => s + Number(r.commission_amount),
    0,
  );

  // Co-branded landing presentation.
  const { data: presentation } = await admin
    .from("affiliate_accounts")
    .select("display_headline, bio, photo_url, public_phone")
    .eq("id", me.id)
    .maybeSingle();

  const currentBandIdx = sortedBands.findIndex(
    (b) => b.max !== null && mine.book <= (b.max ?? 0),
  );

  // ── OVERVIEW panel ──────────────────────────────────────────────
  const overview = (
    <section>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-4">
        <div className="bg-brand-dark p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
            Your rank
          </div>
          <div className="num mt-1.5 font-display text-[22px] font-bold leading-none text-white">
            {mine.rank ? `#${mine.rank}` : "—"}{" "}
            <span className="text-[12px] font-semibold text-white/50">
              of {data.partnerSlots}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-brand-accent">
            {mine.paused ? "paused" : "in the race"}
          </div>
        </div>
        <StatCell label="Score · active listings" value={String(mine.listings)}>
          {mine.netThisMonth >= 0 ? `+${mine.netThisMonth}` : mine.netThisMonth}{" "}
          this month
        </StatCell>
        <StatCell label="Current race rate" value={`${mine.ratePct}%`}>
          on {zar(mine.book)} /mo book
        </StatCell>
        <StatCell label="Earned in this race" value={zar(earnedHere)}>
          {bonusEarned > 0
            ? `incl. ${zar(bonusEarned)} bonuses`
            : "ladder + bonuses"}
        </StatCell>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* LADDER */}
          <section className="am-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
              <div className="smallcaps">
                Commission ladder · trailing-month book
              </div>
              <span className="tag green">
                <span className="d" />
                Lifetime on race referrals
              </span>
            </div>
            <div className="space-y-2.5 p-5">
              {sortedBands.map((b, i) => {
                const isNow = i === currentBandIdx;
                const passed = currentBandIdx >= 0 && i < currentBandIdx;
                const lo = i === 0 ? 0 : (sortedBands[i - 1].max ?? 0);
                const range =
                  b.max === null
                    ? `${zar(lo)}+ /mo`
                    : `${zar(lo)} – ${zar(b.max)} /mo`;
                return (
                  <div key={i} className={`rung ${isNow ? "now" : ""}`}>
                    <span
                      className={`num w-12 font-display text-[16px] font-bold ${isNow ? "text-brand-secondary" : "text-brand-mute"}`}
                    >
                      {Math.round(b.rate * 100)}%
                    </span>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-brand-ink">
                        {range}
                      </div>
                      {isNow ? (
                        <div className="mt-1.5 flex items-center gap-3">
                          <div className="flex-1">
                            <div className="pbar">
                              <div style={{ width: `${mine.progressPct}%` }} />
                            </div>
                          </div>
                          <span className="num text-[11px] font-semibold text-brand-secondary">
                            {zar(mine.book)}
                          </span>
                        </div>
                      ) : !passed &&
                        i === currentBandIdx + 1 &&
                        mine.toNextBook != null ? (
                        <div className="mt-0.5 text-[11.5px] text-brand-mute">
                          {zar(mine.toNextBook)} more book to reach
                        </div>
                      ) : null}
                    </div>
                    {passed ? (
                      <span className="tag gray">
                        <span className="d" />
                        Passed
                      </span>
                    ) : isNow ? (
                      <span className="tag green">
                        <span className="d" />
                        You are here
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-brand-line bg-brand-light/60 px-5 py-3 text-[11.5px] text-brand-mute">
              Your rate applies to your whole race book and re-checks monthly as
              hosts join or leave. If you win a prize floor, you never drop
              below it.
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          {/* SHARE */}
          <section className="am-card overflow-hidden">
            <div className="smallcaps border-b border-brand-line px-5 py-3.5">
              Share your race link
            </div>
            <div className="p-5">
              <div className="copyfield">
                <Flag className="h-4 w-4 shrink-0 text-brand-mute" />
                <span className="mono flex-1 truncate text-[12px] text-brand-ink">
                  {raceLinkShort}
                </span>
                <CopyLinkButton
                  value={raceLink}
                  className="btn-pri h-9 px-3.5"
                />
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <a
                  className="btn-ghost"
                  href={`https://wa.me/?text=${encodeURIComponent(raceLink)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
                <a
                  className="btn-ghost"
                  href={`mailto:?body=${encodeURIComponent(raceLink)}`}
                >
                  Email
                </a>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-brand-mute">
                Hosts who sign up through this link count toward your score and
                earn the race ladder — for life.
              </p>
            </div>
          </section>
          {/* CONVERSION BONUS */}
          <section className="am-card overflow-hidden">
            <div className="smallcaps border-b border-brand-line px-5 py-3.5">
              Conversion bonuses
            </div>
            <div className="space-y-2 p-5 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-brand-mute">Monthly plan activates</span>
                <span className="num font-bold text-brand-ink">R 250</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-mute">Annual plan activates</span>
                <span className="num font-bold text-brand-ink">R 400</span>
              </div>
              <div className="flex justify-between border-t border-brand-line pt-2">
                <span className="font-semibold text-brand-ink">
                  Earned so far
                </span>
                <span className="num font-bold text-brand-secondary">
                  {zar(bonusEarned)} · {bonusHosts} host
                  {bonusHosts === 1 ? "" : "s"}
                </span>
              </div>
              <p className="pt-1 text-[11px] leading-relaxed text-brand-mute">
                Paid once per referred host, when their first paid subscription
                starts. Separate from ladder commission.
              </p>
            </div>
          </section>
        </div>
      </div>
    </section>
  );

  // ── LINKS & PAGE panel ──────────────────────────────────────────
  const links = (
    <div className="space-y-6">
      <p className="max-w-2xl text-[13px] leading-relaxed text-brand-mute">
        Your race link opens your own co-branded landing page. Fill in the
        personal parts below — hosts see a familiar face, not a cold ad.
      </p>
      <LandingPageCard
        slug={me.slug}
        headline={(presentation?.display_headline as string | null) ?? null}
        bio={(presentation?.bio as string | null) ?? null}
        photoUrl={(presentation?.photo_url as string | null) ?? null}
        publicPhone={(presentation?.public_phone as string | null) ?? null}
      />
      <section className="am-card overflow-hidden">
        <div className="smallcaps border-b border-brand-line px-5 py-3.5">
          Your race link
        </div>
        <div className="p-5">
          <div className="copyfield">
            <Flag className="h-4 w-4 shrink-0 text-brand-mute" />
            <span className="mono flex-1 truncate text-[12.5px] text-brand-ink">
              {raceLinkShort}
            </span>
            <CopyLinkButton value={raceLink} />
          </div>
        </div>
      </section>
    </div>
  );

  // ── LEADERBOARD panel ───────────────────────────────────────────
  const leaderboard = (
    <section className="am-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-brand-line px-5 py-4">
        <Trophy className="h-[18px] w-[18px] text-brand-primary" />
        <h3 className="font-display text-[16px] font-bold text-brand-ink">
          Standings
        </h3>
        <span className="tag gray">
          <span className="d" />
          Updated nightly
        </span>
      </div>
      <LiveStandings
        slug={campaign.slug}
        initialRows={rows}
        highlightAffiliateId={me.id}
        usePublicNames={false}
      />
    </section>
  );

  // ── MARKETING panel ─────────────────────────────────────────────
  const marketing = (
    <AffiliateBaseLink suffix="/marketing" className="brow">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-accent text-brand-secondary">
        <Megaphone className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-brand-ink">
          Marketing library
        </div>
        <div className="text-[12.5px] text-brand-mute">
          Ready-to-share posts, banners and captions for the race.
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute" />
    </AffiliateBaseLink>
  );

  // ── RULES & PRIZES panel ────────────────────────────────────────
  const rules = (
    <div className="space-y-6">
      <section className="am-card overflow-hidden">
        <div className="smallcaps border-b border-brand-line px-5 py-3.5">
          Prizes
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          {prizes.length === 0 ? (
            <div className="text-[12.5px] text-brand-mute">
              No cash prizes on this campaign — the ladder rate is the reward.
            </div>
          ) : (
            prizes.map((p, i) => (
              <div key={i} className="rung">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#FFFBEB] text-[#B45309]">
                  <Trophy className="h-[18px] w-[18px]" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-brand-ink">
                    {p.placing
                      ? `Placing #${p.placing}`
                      : p.milestone
                        ? p.milestone.replace(/_/g, " ")
                        : p.monthly_top_net_change
                          ? "Monthly top mover"
                          : "Prize"}
                  </div>
                  <div className="num text-[11.5px] text-brand-mute">
                    {p.cash ? zar(p.cash) : ""}
                    {p.monthly_top_net_change
                      ? zar(p.monthly_top_net_change)
                      : ""}
                    {p.floor ? ` · ${Math.round(p.floor * 100)}% floor` : ""}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      {campaign.rulesDocSlug ? (
        <p className="text-[12px] text-brand-mute">
          <a
            href={`/legal/${campaign.rulesDocSlug}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-primary hover:underline"
          >
            Full competition rules
          </a>{" "}
          · standings recompute nightly from currently-active listings.
        </p>
      ) : null}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div>
        <nav className="flex items-center gap-1.5 text-[11.5px] text-brand-mute">
          <AffiliateBaseLink suffix="/competitions" className="hover:underline">
            Campaigns
          </AffiliateBaseLink>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-brand-ink">{campaign.name}</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-[20px] font-extrabold leading-none text-brand-ink">
                {campaign.name}
              </h1>
              <span className="tag amber">
                <span className="d" />
                {campaign.status === "active" ? "Live" : campaign.status}
                {endsLabel ? ` · ends ${endsLabel}` : ""}
              </span>
            </div>
            <div className="mt-1.5 text-[12.5px] text-brand-mute">
              {daysLeft != null ? `${daysLeft} days left · ` : ""}your campaign
              link: <span className="mono text-brand-ink">{raceLinkShort}</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 pb-0.5">
            <CopyLinkButton value={raceLink} className="btn-sec h-9" />
          </div>
        </div>
      </div>

      <RaceTabs panels={{ overview, links, leaderboard, marketing, rules }} />
    </div>
  );
}

function StatCell({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="smallcaps">{label}</div>
      <div className="num mt-1.5 font-display text-[22px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      <div className="num mt-1 text-[11px] text-brand-mute">{children}</div>
    </div>
  );
}
