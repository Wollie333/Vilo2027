import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  Flag,
  Layers,
  Radio,
  Trophy,
  Zap,
} from "lucide-react";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { LiveStandings } from "@/components/affiliate/race/LiveStandings";
import { LINE, Medal, Podium } from "@/components/affiliate/race/RaceBits";
import { Link } from "@/i18n/navigation";
import { getBrandName } from "@/lib/brand";
import { loadCampaignLeaderboard } from "@/lib/affiliate/leaderboard";
import { loadCampaignResults } from "@/lib/affiliate/finalize";

// Public per-campaign leaderboard. Unauthenticated, live day one, built to the
// approved Founding Race design. Only first name + last initial is shown — the
// standings are public, the partners' identities are not.
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wielo.co.za";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await loadCampaignLeaderboard(params.slug);
  if (!data) return { title: "Competition not found" };
  const brand = await getBrandName();
  return {
    title: `${data.campaign.name} leaderboard · ${brand}`,
    description: `Live standings for the ${data.campaign.name} on ${brand}.`,
    alternates: { canonical: `${BASE_URL}/competitions/${data.campaign.slug}` },
  };
}

function zar(n: number): string {
  return `R${Math.round(n).toLocaleString("en-ZA")}`;
}

export default async function CompetitionLeaderboardPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await loadCampaignLeaderboard(params.slug);
  if (!data) notFound();

  const { campaign, rows, prizes } = data;
  // A draft or archived campaign is not public, and 'partners'/'hidden'
  // leaderboards never render on this unauthenticated route.
  if (campaign.status === "draft" || campaign.status === "archived") notFound();
  if ((campaign.competition?.leaderboard_visibility ?? "public") !== "public") {
    notFound();
  }

  // This route is UNAUTHENTICATED. The rows carry each partner's real full name
  // and referral slug for the portal's own use — neither may reach a public
  // visitor. Collapse them to the anonymised publicName / empty slug BEFORE they
  // are handed to any client component (LiveStandings is "use client", so its
  // props are serialised into the page payload). Matches toPublicRows(), which
  // the poll endpoint already applies. The visible output is unchanged
  // (usePublicNames already renders publicName).
  const publicRows = rows.map((r) => ({
    ...r,
    name: r.publicName,
    slug: "",
  }));

  // Official final winners — only revealed once an admin has published them.
  const finalResults = await loadCampaignResults(campaign.id);
  const publishedWinners =
    finalResults?.publishedAt && finalResults.winners.length > 0
      ? finalResults.winners
      : [];

  const brand = await getBrandName();
  const isLive =
    campaign.status === "active" &&
    (!campaign.endsAt || Date.parse(campaign.endsAt) > Date.now());

  const placingPrizes = prizes
    .filter((p) => typeof p.placing === "number")
    .sort((a, b) => (a.placing ?? 0) - (b.placing ?? 0));
  const milestonePrizes = prizes.filter((p) => p.milestone);
  const monthlyPrize = prizes.find((p) => p.monthly_top_net_change);

  const topFloor = placingPrizes.find((p) => p.floor)?.floor ?? null;

  return (
    <div className="bg-white text-brand-ink">
      <SiteHeader />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden border-b bg-brand-dark text-white"
        style={{ borderColor: LINE }}
      >
        {/* Admin-assigned hero image (from the Wielo media library), behind a
            dark scrim so the white hero text stays legible. */}
        {campaign.heroImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={campaign.heroImageUrl}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/80 to-brand-dark/50" />
          </>
        ) : null}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-[1120px] px-5 py-14 lg:px-8 lg:py-16">
          <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-emerald-300/90">
            The {brand} {campaign.name} · Season 1
          </span>
          <h1 className="mt-3 max-w-[15ch] font-display text-[34px] font-extrabold leading-[1.03] tracking-tight sm:text-[46px]">
            Who&rsquo;s brought the most hosts home?
          </h1>
          <p className="mt-4 max-w-[52ch] text-[15.5px] leading-relaxed text-emerald-50/80">
            {data.partnerSlots} group owners. One point for every host of theirs
            with a live listing on {brand}. Not who sold the most — who{" "}
            <span className="font-semibold text-white">
              helped the most hosts
            </span>{" "}
            get up and running.
          </p>
          <div className="mt-8 flex flex-wrap items-stretch gap-3">
            <HeroStat
              value={String(data.partnerSlots)}
              label="Partners racing"
            />
            <HeroStat
              value={data.totalListings.toLocaleString("en-ZA")}
              label="Hosts live right now"
            />
            {data.monthsTotal ? (
              <HeroStat
                value={`${data.monthsElapsed ?? 0}`}
                suffix={`of ${data.monthsTotal}`}
                label="Months elapsed"
              />
            ) : null}
            {data.prizePotZar > 0 ? (
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-3.5">
                <div className="font-display text-[26px] font-extrabold tabular-nums leading-none text-emerald-200">
                  {data.prizePotZar >= 1000
                    ? `R${Math.round(data.prizePotZar / 1000)}k`
                    : zar(data.prizePotZar)}
                </div>
                <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.09em] text-emerald-200/80">
                  In prizes {topFloor ? "+ rate floors" : ""}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1120px] px-5 py-10 lg:px-8 lg:py-12">
        {/* ── Official final winners (only once an admin has published) ── */}
        {publishedWinners.length > 0 ? (
          <section className="mb-8 rounded-card border border-amber-300 bg-gradient-to-br from-amber-50 to-white p-5 shadow-card sm:p-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="font-display text-[21px] font-extrabold text-brand-ink">
                Final winners
              </h2>
            </div>
            <p className="mt-1 text-[13px] text-brand-mute">
              The {campaign.name} has ended — congratulations to our champions.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {publishedWinners.map((w) => (
                <div
                  key={w.affiliateId}
                  className="rounded-2xl border bg-white p-4"
                  style={{ borderColor: LINE }}
                >
                  <div className="text-[26px] leading-none">
                    {w.placing === 1
                      ? "🥇"
                      : w.placing === 2
                        ? "🥈"
                        : w.placing === 3
                          ? "🥉"
                          : `#${w.placing}`}
                  </div>
                  <div className="mt-2 font-display text-[16px] font-bold text-brand-ink">
                    {w.publicName}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                    {w.cash > 0 ? (
                      <span className="rounded-pill bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                        {zar(w.cash)} cash
                      </span>
                    ) : null}
                    {w.floorPct > 0 ? (
                      <span className="rounded-pill bg-brand-primary/10 px-2 py-0.5 font-semibold text-brand-primary">
                        {w.floorPct}% rate floor
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Podium ──────────────────────────────────────────── */}
        {rows.length > 0 ? (
          <>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="font-display text-[21px] font-extrabold text-brand-ink">
                  The front three
                </h2>
                <p className="mt-0.5 text-[13px] text-brand-mute">
                  Cash, and a permanent commission floor that pays for years.
                </p>
              </div>
              <span className="hidden text-[12px] text-brand-mute sm:inline">
                Updated nightly · last recompute 01:15
              </span>
            </div>
            <Podium rows={publicRows} prizes={prizes} usePublicNames />
          </>
        ) : null}

        {/* ── Standings ───────────────────────────────────────── */}
        <div
          className="overflow-hidden rounded-card border bg-white shadow-card"
          style={{ borderColor: LINE }}
        >
          <div
            className="flex flex-wrap items-center gap-3 border-b px-5 py-4"
            style={{ borderColor: LINE }}
          >
            <Trophy className="h-[18px] w-[18px] text-brand-primary" />
            <h3 className="font-display text-[16px] font-bold text-brand-ink">
              Full standings
            </h3>
            <span
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border bg-[#F4F7F5] px-2.5 py-[3px] text-[11.5px] font-semibold text-[#5B7065]"
              style={{ borderColor: LINE }}
            >
              <span className="h-1.5 w-1.5 rounded-pill bg-[#94A3B8]" />
              {isLive
                ? "Live · listings currently published"
                : "Final standings"}
            </span>
            <div className="ml-auto text-[12px] text-brand-mute">
              Season total
            </div>
          </div>
          <LiveStandings
            slug={campaign.slug}
            initialRows={publicRows}
            usePublicNames
          />
        </div>

        {/* ── Scoring + prizes ────────────────────────────────── */}
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <div
            className="rounded-card border bg-white p-6 shadow-card lg:col-span-3"
            style={{ borderColor: LINE }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-brand-mute">
              How the score works
            </span>
            <h3 className="mt-2 font-display text-[22px] font-extrabold leading-snug text-brand-ink">
              One point for every host of yours with a live listing.
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-brand-mute">
              That&rsquo;s the entire system — no formulas, no bonuses, no fine
              print.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <RuleCard
                icon={<Radio className="h-4 w-4" />}
                title="Only live listings count"
                body="If a host leaves, the point goes with them. Your score always reflects what's actually there."
              />
              <RuleCard
                icon={<Layers className="h-4 w-4" />}
                title="Each listing counts separately"
                body="Someone managing fifteen properties is worth fifteen points."
              />
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-brand-mute">
              We score listings, not signups — a host who actually gets
              published is a host who&rsquo;s been properly helped. Conversions
              aren&rsquo;t scored here, because you&rsquo;re already paid for
              those, every month, for as long as they stay.
            </p>
          </div>

          <div
            className="rounded-card border bg-white p-6 shadow-card lg:col-span-2"
            style={{ borderColor: LINE }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-brand-mute">
              The prizes
            </span>
            <h3 className="mt-2 font-display text-[22px] font-extrabold text-brand-ink">
              {data.prizePotZar > 0
                ? `${zar(data.prizePotZar)} — and a floor worth more.`
                : "Prizes to be announced."}
            </h3>
            <div className="mt-4 divide-y" style={{ borderColor: LINE }}>
              {placingPrizes.map((p) => (
                <div
                  key={p.placing}
                  className="flex items-center gap-3 py-2.5"
                  style={{ borderColor: LINE }}
                >
                  <Medal place={p.placing!} className="h-8 w-8 text-[13px]" />
                  <div className="flex-1">
                    <div className="font-display text-[14px] font-bold text-brand-ink">
                      {p.cash ? zar(p.cash) : "—"}
                    </div>
                    <div className="text-[11.5px] text-brand-mute">
                      cash prize
                    </div>
                  </div>
                  {p.floor ? (
                    <div className="text-right">
                      <div className="font-display text-[14px] font-bold text-brand-primary">
                        {Math.round(p.floor * 100)}%
                      </div>
                      <div className="text-[11.5px] text-brand-mute">
                        permanent floor
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {topFloor ? (
              <div className="mt-4 rounded-xl bg-brand-dark p-4 text-white">
                <p className="text-[12.5px] leading-relaxed text-emerald-50/85">
                  <span className="font-semibold text-white">
                    The floor beats the cash.
                  </span>{" "}
                  Win first and you move to {Math.round(topFloor * 100)}% for
                  good — and still climb higher as your book grows. Across a
                  decent book that floor out-earns the cheque in year one, and
                  keeps paying every year after.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Momentum prizes ─────────────────────────────────── */}
        {monthlyPrize || milestonePrizes.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {monthlyPrize ? (
              <MomentumCard
                icon={<CalendarDays className="h-4 w-4" />}
                title="Monthly prize"
                body={
                  <>
                    <span className="font-semibold text-brand-ink">
                      {zar(monthlyPrize.monthly_top_net_change!)}
                    </span>{" "}
                    to whoever adds the most live listings that month. Scored on
                    the month — six can beat ninety.
                  </>
                }
              />
            ) : null}
            {milestonePrizes.map((p) => (
              <MomentumCard
                key={p.milestone}
                icon={
                  p.milestone?.startsWith("first_to") ? (
                    <Flag className="h-4 w-4" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )
                }
                title={MILESTONE_TITLES[p.milestone ?? ""] ?? "Milestone"}
                body={
                  <>
                    <span className="font-semibold text-brand-ink">
                      {p.cash ? zar(p.cash) : "A prize"}
                    </span>{" "}
                    {MILESTONE_BODY[p.milestone ?? ""] ??
                      "for reaching this milestone."}
                  </>
                }
              />
            ))}
          </div>
        ) : null}

        {/* ── CTA ─────────────────────────────────────────────── */}
        <div
          className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border bg-brand-light/60 px-6 py-6 sm:flex-row"
          style={{ borderColor: LINE }}
        >
          <div>
            <h3 className="font-display text-[19px] font-extrabold text-brand-ink">
              {data.partnerSlots} people are going to do this.
            </h3>
            <p className="mt-1 text-[13px] text-brand-mute">
              You bring {brand} to your community, and you earn from every host
              who joins — every month, for as long as they stay.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex h-11 shrink-0 items-center gap-[7px] rounded-pill bg-brand-primary px-[22px] text-[14px] font-semibold text-white shadow-glow transition-colors hover:bg-brand-secondary"
          >
            Talk to us <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>

      <div className="border-t py-8 text-center" style={{ borderColor: LINE }}>
        <p className="text-[12px] text-brand-mute">
          The {brand} Founding Partner Programme
          {campaign.rulesDocSlug ? (
            <>
              {" "}
              ·{" "}
              <Link
                href={`/legal/${campaign.rulesDocSlug}`}
                className="underline underline-offset-2 hover:text-brand-ink"
              >
                Full contest rules
              </Link>
            </>
          ) : null}
        </p>
        <p className="mt-1 text-[11px] text-brand-mute/70">
          Standings recompute nightly from currently-active listings. Prize
          amounts in ZAR.
        </p>
      </div>

      <SiteFooter />
    </div>
  );
}

const MILESTONE_TITLES: Record<string, string> = {
  first_to_5: "First to 5",
  first_to_10: "First to 10",
  first_to_25: "First to 25",
  any_reaching_5_in_30d: "Fast start",
  any_reaching_10_in_30d: "Fast start",
  first_host_live: "First host live",
};

const MILESTONE_BODY: Record<string, string> = {
  first_to_5: "once, to the first partner to reach five points.",
  first_to_10: "once, to the first partner to reach ten points.",
  first_to_25: "once, to the first partner to reach twenty-five points.",
  any_reaching_5_in_30d:
    "to any partner reaching five points in their first 30 days. Not a race — everyone who gets there gets it.",
  any_reaching_10_in_30d:
    "to any partner reaching ten points in their first 30 days. Not a race — everyone who gets there gets it.",
  first_host_live: "to the first partner to get a host live.",
};

function HeroStat({
  value,
  label,
  suffix,
}: {
  value: string;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.12] bg-white/5 px-5 py-3.5">
      <div className="font-display text-[26px] font-extrabold tabular-nums leading-none">
        {value}
        {suffix ? (
          <span className="text-[15px] font-bold text-emerald-200/70">
            {" "}
            {suffix}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.09em] text-emerald-200/70">
        {label}
      </div>
    </div>
  );
}

function RuleCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-xl border bg-brand-light/60 p-4"
      style={{ borderColor: LINE }}
    >
      <div className="flex items-center gap-2 text-brand-secondary">
        {icon}
        <span className="font-display text-[13.5px] font-bold">{title}</span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-mute">
        {body}
      </p>
    </div>
  );
}

function MomentumCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div
      className="rounded-card border bg-white p-5 shadow-card"
      style={{ borderColor: LINE }}
    >
      <div className="flex items-center gap-2 text-brand-secondary">
        {icon}
        <span className="font-display text-[13.5px] font-bold">{title}</span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-mute">
        {body}
      </p>
    </div>
  );
}
