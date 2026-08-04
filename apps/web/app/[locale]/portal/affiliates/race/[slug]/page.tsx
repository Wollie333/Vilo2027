import type { Metadata } from "next";
import { ChevronRight, Flag, Gift, Megaphone, Trophy } from "lucide-react";
import { notFound } from "next/navigation";

import { LiveStandings } from "@/components/affiliate/race/LiveStandings";
import { getAffiliateForUser } from "@/lib/affiliate/account";
import {
  describeCommissionStructure,
  type LadderBand,
} from "@/lib/affiliate/campaigns";
import {
  campaignPartnerLink,
  displayLink,
  funnelResourceLink,
} from "@/lib/affiliate/links";
import { listShareableFunnels } from "@/lib/affiliate/resources";
import {
  loadCampaignLeaderboard,
  loadMyRaceStats,
  type CampaignPrize,
} from "@/lib/affiliate/leaderboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { AffiliateBaseLink } from "../../_components/AffiliateBaseLink";
import { CopyLinkButton } from "../../_components/CopyLinkButton";
import { LandingPageCard } from "../../_components/LandingPageCard";
import {
  type LibraryAsset,
  MarketingLibrary,
} from "../../_components/MarketingLibrary";

import { RaceTabs } from "./RaceTabs";

export const metadata: Metadata = { title: "The Race" };
export const dynamic = "force-dynamic";

function zar(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}

// ── Prize explainer (partner-facing) ────────────────────────────────────────
// Turn a raw CampaignPrize into a plain-language card: WHAT it is, HOW MUCH, and
// crucially WHEN it pays — grouped by timing so a partner reads it at a glance.
function ordinal(n: number): string {
  const v = n % 100;
  const suffix =
    v >= 11 && v <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${suffix}`;
}

// Partner-voiced copy for each SoT milestone (see campaignConfig MILESTONES).
const MILESTONE_COPY: Record<string, { title: string; detail: string }> = {
  first_host_live: {
    title: "First referred host goes live",
    detail:
      "The first time a host you referred publishes a live listing in the race.",
  },
  first_to_10: {
    title: "First to 10 live listings",
    detail:
      "Be the first partner in the race to reach 10 live listings across your referred hosts.",
  },
  first_to_25: {
    title: "First to 25 live listings",
    detail:
      "Be the first partner in the race to reach 25 live listings across your referred hosts.",
  },
  any_reaching_5_in_30d: {
    title: "Fast Start",
    detail:
      "Get 5 of your referred hosts live within your first 30 days in the race.",
  },
};

type PrizeBucket = "standings" | "milestone" | "monthly" | "other";
type DescribedPrize = {
  bucket: PrizeBucket;
  sort: number;
  title: string;
  amount: string;
  detail: string;
  floorLine: string | null;
};

function describePartnerPrize(
  p: CampaignPrize,
  endsLabel: string | null,
): DescribedPrize | null {
  const floorPct = p.floor ? Math.round(p.floor * 100) : 0;
  const floorLine = floorPct ? `+${floorPct}% permanent rate floor` : null;
  const cash = p.cash ? zar(p.cash) : null;

  if (p.placing) {
    return {
      bucket: "standings",
      sort: p.placing,
      title: `${ordinal(p.placing)} place`,
      amount: cash ?? floorLine ?? "—",
      detail: `Paid when the race ends${
        endsLabel ? ` on ${endsLabel}` : ""
      } to the ${ordinal(p.placing)}-place partner on the final leaderboard.`,
      floorLine: cash ? floorLine : null,
    };
  }
  if (p.milestone) {
    const c = MILESTONE_COPY[p.milestone] ?? {
      title: p.milestone.replace(/_/g, " "),
      detail: "Paid the first time you reach it, once verified.",
    };
    return {
      bucket: "milestone",
      sort: p.cash ?? 0,
      title: c.title,
      amount: cash ?? floorLine ?? "—",
      detail: c.detail,
      floorLine: cash ? floorLine : null,
    };
  }
  if (p.monthly_top_net_change) {
    return {
      bucket: "monthly",
      sort: 0,
      title: "Monthly top mover",
      amount: `${zar(p.monthly_top_net_change)} / month`,
      detail:
        "Paid each month of the race to the partner who adds the most net live listings that month.",
      floorLine,
    };
  }
  // Fallback — a prize with only a floor, or cash with no trigger set. Never
  // render a bare "Prize" with no amount.
  if (cash || floorPct) {
    return {
      bucket: "other",
      sort: 0,
      title: floorPct && !cash ? "Rate floor" : "Race prize",
      amount: cash ?? floorLine ?? "—",
      detail: floorPct
        ? "A permanent rate floor locked to your account — your commission rate never drops below it."
        : "Awarded during the race.",
      floorLine: cash ? floorLine : null,
    };
  }
  return null;
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
  const raceLink = campaignPartnerLink(appUrl, me.slug, campaign.slug);
  const raceLinkShort = displayLink(raceLink);

  // Shareable pipeline capture pages, each wrapped in this partner's attributed,
  // race-tagged link (Resources tab). Auto-lists active host funnels for now;
  // admin per-competition curation is a fast-follow.
  const shareableFunnels = await listShareableFunnels();
  const resourceItems = shareableFunnels.map((f) => {
    const url = funnelResourceLink(appUrl, me.slug, f.slug, campaign.slug);
    return { ...f, url, urlShort: displayLink(url) };
  });

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

  // Conversion bonuses come from the campaign's commission structure (admin-set),
  // so the amounts shown always match what's actually paid — never hardcoded.
  const convBonus = campaign.structure?.conversion_bonus ?? {};
  const comp = campaign.competition;
  const listingPoints = comp?.events?.listing_published ?? 1;
  const startsLabel = campaign.startsAt
    ? new Date(campaign.startsAt).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

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

  // This campaign's OWN marketing assets — shown only inside its race.
  const { data: campaignAssets } = await admin
    .from("marketing_assets")
    .select(
      "id, category, title, description, body, link_url, file_url, mime_type, width",
    )
    .eq("campaign_id", campaign.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const currentBandIdx = sortedBands.findIndex(
    (b) => b.max !== null && mine.book <= (b.max ?? 0),
  );

  // What this partner has actually WON in this campaign — the rate floors (locked
  // for life) and any cash prizes (owed/paid). RLS would already scope these, but
  // we key on me.id explicitly since we read with the service client.
  const [{ data: myFloors }, { data: myPrizes }] = await Promise.all([
    admin
      .from("affiliate_campaign_floors")
      .select("floor_rate, won_via, awarded_at")
      .eq("campaign_id", campaign.id)
      .eq("affiliate_id", me.id)
      .order("awarded_at", { ascending: false }),
    admin
      .from("affiliate_prize_awards")
      .select("label, amount, currency, status, paid_at")
      .eq("campaign_id", campaign.id)
      .eq("affiliate_id", me.id)
      .neq("status", "void") // a voided prize is not shown to the partner
      .order("amount", { ascending: false }),
  ]);
  const wonFloors = myFloors ?? [];
  const wonPrizes = myPrizes ?? [];
  const hasWinnings = wonFloors.length > 0 || wonPrizes.length > 0;

  // ── OVERVIEW panel ──────────────────────────────────────────────
  const overview = (
    <section>
      {/* Your winnings — shown once you've been awarded a floor or a cash prize. */}
      {hasWinnings ? (
        <section className="am-card mb-6 overflow-hidden border-amber-300">
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3.5">
            <Trophy className="h-[18px] w-[18px] text-amber-500" />
            <div className="smallcaps">Your winnings</div>
          </div>
          <div className="space-y-2.5 p-5">
            {wonFloors.map((f, i) => (
              <div
                key={`floor-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
              >
                <span className="min-w-0 font-medium text-brand-ink">
                  {Math.round(Number(f.floor_rate) * 100)}% rate floor
                  {f.won_via ? (
                    <span className="text-brand-mute"> — {f.won_via}</span>
                  ) : null}
                </span>
                <span className="tag green shrink-0">
                  <span className="d" />
                  Locked for life
                </span>
              </div>
            ))}
            {wonPrizes.map((p, i) => (
              <div
                key={`prize-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
              >
                <span className="min-w-0 font-medium text-brand-ink">
                  <span className="num">{zar(Number(p.amount))}</span> cash
                  {p.label ? (
                    <span className="text-brand-mute"> — {p.label}</span>
                  ) : null}
                </span>
                <span
                  className={`tag shrink-0 ${p.status === "paid" ? "green" : "amber"}`}
                >
                  <span className="d" />
                  {p.status === "paid" ? "Paid" : "Being processed"}
                </span>
              </div>
            ))}
            <p className="pt-1 text-[11px] leading-relaxed text-brand-mute">
              Rate floors are locked to your account for life. Cash prizes are
              paid out by our team — we&apos;ll be in touch.
            </p>
          </div>
        </section>
      ) : null}

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
          {/* CONVERSION BONUS — only when this campaign actually has one (or the
              partner has already earned it), so we never show an empty card. */}
          {convBonus.monthly || convBonus.annual || bonusEarned > 0 ? (
            <section className="am-card overflow-hidden">
              <div className="smallcaps border-b border-brand-line px-5 py-3.5">
                Conversion bonuses
              </div>
              <div className="space-y-2 p-5 text-[12.5px]">
                {convBonus.monthly ? (
                  <div className="flex justify-between">
                    <span className="text-brand-mute">
                      Monthly plan activates
                    </span>
                    <span className="num font-bold text-brand-ink">
                      {zar(convBonus.monthly)}
                    </span>
                  </div>
                ) : null}
                {convBonus.annual ? (
                  <div className="flex justify-between">
                    <span className="text-brand-mute">
                      Annual plan activates
                    </span>
                    <span className="num font-bold text-brand-ink">
                      {zar(convBonus.annual)}
                    </span>
                  </div>
                ) : null}
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
                  Paid once per referred host, when their first paid
                  subscription starts. Separate from ladder commission.
                </p>
              </div>
            </section>
          ) : null}
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

  // ── RESOURCES panel ─────────────────────────────────────────────
  // Everything a partner can share for this race: their OWN co-branded page link,
  // plus the ready-made capture pages. Every link is wrapped in this partner's
  // attributed, race-tagged /r/ or /partners/ URL — anyone who signs up through
  // it is bound to the partner + competition at capture time, so it survives a
  // later signup on another device.
  const resources = (
    <div className="space-y-6">
      <p className="max-w-2xl text-[13px] leading-relaxed text-brand-mute">
        Everything you can share for this race — your own page and ready-made
        capture pages. Every link is tied to you and counts toward the race,
        even if a host finishes signing up later on another device.
      </p>

      {/* The partner's own co-branded race page. */}
      <div>
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-brand-ink">
          Your page
        </div>
        <section className="am-card overflow-hidden">
          <div className="flex items-start gap-3 border-b border-brand-line px-5 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent text-brand-primary">
              <Flag className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[14px] font-bold text-brand-ink">
                Your co-branded race page
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-brand-mute">
                Hosts land on your own page — a familiar face, not a cold ad.
                Every button on it attributes to you.
              </div>
            </div>
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

      {/* Ready-made capture pages (pipeline funnels). */}
      {resourceItems.length > 0 ? (
        <div>
          <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-brand-ink">
            Capture pages
          </div>
          <div className="space-y-4">
            {resourceItems.map((r) => (
              <section key={r.slug} className="am-card overflow-hidden">
                <div className="flex items-start gap-3 border-b border-brand-line px-5 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent text-brand-primary">
                    <Gift className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[14px] font-bold text-brand-ink">
                      {r.name}
                    </div>
                    {r.headline ? (
                      <div className="mt-0.5 text-[12px] leading-snug text-brand-mute">
                        {r.headline}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="p-5">
                  <div className="copyfield">
                    <Gift className="h-4 w-4 shrink-0 text-brand-mute" />
                    <span className="mono flex-1 truncate text-[12.5px] text-brand-ink">
                      {r.urlShort}
                    </span>
                    <CopyLinkButton value={r.url} />
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}
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
  // This competition's OWN ad creatives — the posts, banners and captions the
  // Wielo team uploads for THIS race (marketing_assets.campaign_id). Scoped only:
  // it never links out to the default-programme library (Resources holds the
  // shareable links; this tab is the competition's ad material).
  const marketing =
    campaignAssets && campaignAssets.length > 0 ? (
      <MarketingLibrary
        assets={campaignAssets as LibraryAsset[]}
        referralLink={raceLink}
      />
    ) : (
      <div className="am-card flex flex-col items-center gap-2 p-10 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="font-display text-[15px] font-bold text-brand-ink">
          No marketing material for this race yet
        </div>
        <p className="max-w-sm text-[12.5px] leading-relaxed text-brand-mute">
          Ready-to-share posts, banners and captions made for this competition
          will appear here as the Wielo team adds them — check back soon.
        </p>
      </div>
    );

  // ── RULES & PRIZES panel ────────────────────────────────────────
  // Everything a partner needs in one place: how the race is scored, the prize
  // table, the commission ladder + bonuses, and the key dates. Every value is
  // read from the campaign config so it always matches the admin setup.
  const scoringRules: string[] = [
    `${listingPoints} point${listingPoints === 1 ? "" : "s"} for every host you refer who has a live listing.`,
    comp?.each_listing_counts
      ? "Each live listing a host publishes counts separately."
      : "Each referred host counts once, no matter how many listings they publish.",
    comp?.count_active_only !== false
      ? "Only currently-active listings count — if a host pauses, that point pauses too."
      : "Listings count once published, whether or not they're currently active.",
    comp?.scoring_mode === "net_change"
      ? "You're scored on your net change in live listings over the period."
      : "You're scored on your total live listings.",
    comp?.tie_breaker
      ? `Ties are broken by ${comp.tie_breaker.replace(/_/g, " ")}.`
      : "Ties are broken by who reached the score first.",
  ];

  const durationLabel =
    campaign.structure?.duration === "lifetime"
      ? "for as long as each host keeps paying"
      : campaign.structure?.duration === "recurring" &&
          campaign.structure?.recurring_periods
        ? `for each host's first ${campaign.structure.recurring_periods} payments`
        : "on each referred subscription";

  // Group prizes by WHEN they pay so the card reads at a glance.
  const describedPrizes = prizes
    .map((p) => describePartnerPrize(p, endsLabel))
    .filter((d): d is DescribedPrize => d !== null);
  const prizeGroups = (
    [
      {
        key: "standings",
        header: "Final standings",
        when: `Paid when the race ends${endsLabel ? ` (${endsLabel})` : ""}, by your final position on the leaderboard.`,
      },
      {
        key: "milestone",
        header: "Milestones",
        when: "One-off rewards — paid the first time you hit each, once verified.",
      },
      {
        key: "monthly",
        header: "Every month",
        when: "Paid every month of the race, not just at the end.",
      },
      { key: "other", header: "Other rewards", when: "" },
    ] as const
  )
    .map((g) => ({
      ...g,
      items: describedPrizes
        .filter((d) => d.bucket === g.key)
        .sort((a, b) => a.sort - b.sort),
    }))
    .filter((g) => g.items.length > 0);

  const rules = (
    <div className="space-y-6">
      {/* How the race works */}
      <section className="am-card overflow-hidden">
        <div className="smallcaps border-b border-brand-line px-5 py-3.5">
          How the race works
        </div>
        <div className="space-y-2.5 p-5">
          <ul className="space-y-2">
            {scoringRules.map((r, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] text-brand-ink">
                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="pt-1 text-[11px] leading-relaxed text-brand-mute">
            Standings recompute nightly from currently-active listings.
          </p>
        </div>
      </section>

      {/* Prizes — grouped by WHEN they pay, each explained: what, how much, when. */}
      <section className="am-card overflow-hidden">
        <div className="smallcaps border-b border-brand-line px-5 py-3.5">
          Prizes
        </div>
        {prizeGroups.length === 0 ? (
          <div className="p-5 text-[12.5px] text-brand-mute">
            No cash prizes on this campaign — the ladder rate is the reward.
          </div>
        ) : (
          <div className="space-y-5 p-5">
            {prizeGroups.map((g) => (
              <div key={g.key}>
                <div className="mb-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-brand-ink">
                    {g.header}
                  </div>
                  {g.when ? (
                    <div className="mt-0.5 text-[11px] leading-snug text-brand-mute">
                      {g.when}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {g.items.map((d, i) => (
                    <div key={i} className="rung">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#FFFBEB] text-[#B45309]">
                        <Trophy className="h-[18px] w-[18px]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-[13px] font-semibold text-brand-ink">
                            {d.title}
                          </div>
                          <div className="num shrink-0 whitespace-nowrap text-[12.5px] font-bold text-brand-primary">
                            {d.amount}
                          </div>
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug text-brand-mute">
                          {d.detail}
                        </div>
                        {d.floorLine ? (
                          <div className="mt-1.5 inline-flex rounded-pill bg-[#FFFBEB] px-2 py-0.5 text-[10.5px] font-semibold text-[#B45309]">
                            {d.floorLine}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Commission & bonuses */}
      <section className="am-card overflow-hidden">
        <div className="smallcaps border-b border-brand-line px-5 py-3.5">
          Commission &amp; bonuses
        </div>
        <div className="space-y-3 p-5">
          {campaign.structure ? (
            <p className="text-[12.5px] leading-relaxed text-brand-ink">
              {describeCommissionStructure(campaign.structure)}
            </p>
          ) : null}
          {sortedBands.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                The ladder
              </div>
              {sortedBands.map((b, i) => (
                <div
                  key={i}
                  className="flex justify-between text-[12.5px] text-brand-ink"
                >
                  <span className="text-brand-mute">
                    {b.max === null
                      ? `${zar(sortedBands[i - 1]?.max ?? 0)}+ monthly book`
                      : `Up to ${zar(b.max)} monthly book`}
                  </span>
                  <span className="num font-bold">
                    {Math.round(b.rate * 100)}%
                  </span>
                </div>
              ))}
              <p className="pt-1 text-[11px] leading-relaxed text-brand-mute">
                Your rate applies to your whole book {durationLabel}. Crossing a
                rung lifts your entire book to the higher rate.
              </p>
            </div>
          ) : null}
          {convBonus.monthly || convBonus.annual ? (
            <div className="space-y-1.5 border-t border-brand-line pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Conversion bonus
              </div>
              {convBonus.monthly ? (
                <div className="flex justify-between text-[12.5px] text-brand-ink">
                  <span className="text-brand-mute">
                    Host activates a monthly plan
                  </span>
                  <span className="num font-bold">
                    {zar(convBonus.monthly)}
                  </span>
                </div>
              ) : null}
              {convBonus.annual ? (
                <div className="flex justify-between text-[12.5px] text-brand-ink">
                  <span className="text-brand-mute">
                    Host activates an annual plan
                  </span>
                  <span className="num font-bold">{zar(convBonus.annual)}</span>
                </div>
              ) : null}
              <p className="pt-1 text-[11px] leading-relaxed text-brand-mute">
                Paid once per referred host when their first paid subscription
                starts — on top of your ladder commission.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Key dates */}
      {startsLabel || endsLabel ? (
        <section className="am-card overflow-hidden">
          <div className="smallcaps border-b border-brand-line px-5 py-3.5">
            Key dates
          </div>
          <div className="space-y-2 p-5 text-[12.5px]">
            {startsLabel ? (
              <div className="flex justify-between">
                <span className="text-brand-mute">Starts</span>
                <span className="font-semibold text-brand-ink">
                  {startsLabel}
                </span>
              </div>
            ) : null}
            {endsLabel ? (
              <div className="flex justify-between">
                <span className="text-brand-mute">Ends</span>
                <span className="font-semibold text-brand-ink">
                  {endsLabel}
                  {daysLeft != null ? ` · ${daysLeft} days left` : ""}
                </span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {campaign.rulesDocSlug ? (
        <p className="text-[12px] text-brand-mute">
          <a
            href={`/legal/${campaign.rulesDocSlug}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-primary hover:underline"
          >
            Read the full competition rules
          </a>{" "}
          for the complete terms and conditions.
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

      <RaceTabs
        panels={{ overview, links, resources, leaderboard, marketing, rules }}
      />
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
