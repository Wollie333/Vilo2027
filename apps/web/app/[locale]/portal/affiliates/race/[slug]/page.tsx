import type { Metadata } from "next";
import {
  CalendarDays,
  ChevronRight,
  ExternalLink,
  Flag,
  Trophy,
  Zap,
} from "lucide-react";
import { notFound } from "next/navigation";

import {
  LINE,
  NetPill,
  StandingsTable,
} from "@/components/affiliate/race/RaceBits";
import { Link } from "@/i18n/navigation";
import { getAffiliateForUser } from "@/lib/affiliate/account";
import {
  loadCampaignLeaderboard,
  loadMyRaceStats,
} from "@/lib/affiliate/leaderboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

// The partner's own view of a race — same standings as the public page, plus
// where THEY stand, what their rate is, and how far the next rung is.
export const metadata: Metadata = { title: "The Race" };
export const dynamic = "force-dynamic";

function zar(n: number): string {
  return `R${Math.round(n).toLocaleString("en-ZA")}`;
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
  if (!me) return null; // the shell renders the terms gate

  const data = await loadCampaignLeaderboard(params.slug);
  if (!data) notFound();
  const { campaign, rows, prizes } = data;

  const mine = await loadMyRaceStats(
    campaign.id,
    me.id,
    campaign.structure,
    rows,
  );

  const monthsLeft =
    campaign.endsAt != null
      ? Math.max(
          0,
          Math.ceil(
            (Date.parse(campaign.endsAt) - Date.now()) / (30 * 86_400_000),
          ),
        )
      : null;

  const leaderNet = rows.length
    ? Math.max(...rows.map((r) => r.netThisMonth))
    : 0;
  const monthlyPrize = prizes.find((p) => p.monthly_top_net_change);
  const milestonePrizes = prizes.filter((p) => p.milestone).slice(0, 2);
  const perHost = 599;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pb-1">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <span>Affiliates</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">{campaign.name}</span>
          </nav>
          <h1 className="mt-1 font-display text-[24px] font-extrabold leading-none text-brand-ink">
            {campaign.name}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2 pb-0.5">
          {monthsLeft != null ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-[#FDE9C8] bg-[#FFFBEB] px-2.5 py-[3px] text-[11.5px] font-semibold text-[#B45309]">
              <span className="h-1.5 w-1.5 rounded-pill bg-[#F59E0B]" />
              {monthsLeft} months left
            </span>
          ) : null}
          {data.monthsTotal ? (
            <span className="text-[12px] text-brand-mute">
              Season 1 · {data.monthsTotal} months
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Personal stat strip ─────────────────────────────── */}
      <div className="mb-5 mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Your rank">
          <span className="font-display text-[30px] font-extrabold tabular-nums leading-none text-brand-ink">
            {mine.rank ?? "—"}
          </span>
          <span className="pb-1 text-[12px] text-brand-mute">
            of {data.partnerSlots} partners
          </span>
        </StatCard>

        <StatCard label="Hosts live · your score">
          <span className="font-display text-[30px] font-extrabold tabular-nums leading-none text-brand-ink">
            {mine.listings}
          </span>
          <span className="mb-1">
            <NetPill net={mine.netThisMonth} />
          </span>
        </StatCard>

        <StatCard label="Your commission rate">
          <span className="font-display text-[30px] font-extrabold tabular-nums leading-none text-brand-primary">
            {mine.ratePct}%
          </span>
          <span className="pb-1 text-[12px] text-brand-mute">
            {mine.nextRatePct != null && mine.toNextBook != null
              ? `${zar(mine.toNextBook)} more → ${mine.nextRatePct}%`
              : "top rate"}
          </span>
        </StatCard>

        <div
          className="rounded-card border bg-brand-dark p-4 text-white shadow-card"
          style={{ borderColor: "#0A1510" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-emerald-200/70">
            Your book at full conversion
          </span>
          <div className="mt-1.5 flex items-end gap-2">
            <span className="font-display text-[30px] font-extrabold tabular-nums leading-none">
              {zar(mine.listings * perHost)}
            </span>
            <span className="pb-1 text-[12px] text-emerald-100/60">/mo</span>
          </div>
        </div>
      </div>

      {/* ── Distance to next rung ───────────────────────────── */}
      {mine.nextRatePct != null && mine.toNextBook != null ? (
        <div
          className="mb-5 rounded-card border bg-white p-5 shadow-card"
          style={{ borderColor: LINE }}
        >
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-brand-ink">
              {zar(mine.toNextBook)} more monthly book takes your whole book to{" "}
              {mine.nextRatePct}%
            </span>
            <span className="text-[12px] text-brand-mute">
              {zar(mine.book)} → {zar(mine.book + mine.toNextBook)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E4EFE8]">
            <div
              className="h-full rounded-full bg-brand-primary transition-all"
              style={{ width: `${mine.progressPct}%` }}
            />
          </div>
          <p className="mt-2.5 text-[12px] text-brand-mute">
            When your rate climbs it climbs on your{" "}
            <span className="font-semibold text-brand-ink">whole book</span> —
            including the hosts you signed on day one. It&rsquo;s recalculated
            monthly on what&rsquo;s actually collected, so it can move down too.
          </p>
        </div>
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
            Standings
          </h3>
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border bg-[#F4F7F5] px-2.5 py-[3px] text-[11.5px] font-semibold text-[#5B7065]"
            style={{ borderColor: LINE }}
          >
            <span className="h-1.5 w-1.5 rounded-pill bg-[#94A3B8]" />
            Updated nightly
          </span>
          {campaign.status === "active" ? (
            <a
              href={`/competitions/${campaign.slug}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-primary hover:text-brand-secondary"
            >
              View public page <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
        <StandingsTable
          rows={rows}
          highlightAffiliateId={me.id}
          usePublicNames={false}
        />
      </div>

      {/* ── Prize reminders ─────────────────────────────────── */}
      <div className="mb-2 mt-5 grid gap-3 sm:grid-cols-3">
        {monthlyPrize ? (
          <ReminderCard
            icon={<CalendarDays className="h-4 w-4" />}
            title="This month"
          >
            You added{" "}
            <span className="font-semibold text-brand-ink">
              {mine.netThisMonth}
            </span>{" "}
            live listings. Leader added{" "}
            <span className="font-semibold text-brand-ink">{leaderNet}</span>.{" "}
            {zar(monthlyPrize.monthly_top_net_change!)} to whoever adds most.
          </ReminderCard>
        ) : null}
        {milestonePrizes.map((p) => (
          <ReminderCard
            key={p.milestone}
            icon={
              p.milestone?.startsWith("first_to") ? (
                <Flag className="h-4 w-4" />
              ) : (
                <Zap className="h-4 w-4" />
              )
            }
            title={MILESTONE_TITLES[p.milestone ?? ""] ?? "Milestone"}
          >
            {p.cash ? zar(p.cash) : "A prize"} —{" "}
            {MILESTONE_BODY[p.milestone ?? ""] ??
              "for reaching this milestone."}
          </ReminderCard>
        ))}
      </div>

      {campaign.rulesDocSlug ? (
        <p className="mt-4 text-[12px] text-brand-mute">
          <Link
            href={`/legal/${campaign.rulesDocSlug}`}
            className="font-medium text-brand-primary hover:underline"
          >
            Full competition rules
          </Link>{" "}
          · standings recompute nightly from currently-active listings.
        </p>
      ) : null}
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
  first_to_5: "first partner to five points takes it.",
  first_to_10: "first partner to ten points takes it.",
  first_to_25: "first partner to twenty-five points takes it.",
  any_reaching_5_in_30d: "five points in your first 30 days.",
  any_reaching_10_in_30d: "ten points in your first 30 days.",
  first_host_live: "first partner to get a host live.",
};

function StatCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-card border bg-white p-4 shadow-card"
      style={{ borderColor: LINE }}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-brand-mute">
        {label}
      </span>
      <div className="mt-1.5 flex items-end gap-2">{children}</div>
    </div>
  );
}

function ReminderCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-card border bg-white p-4 shadow-card"
      style={{ borderColor: LINE }}
    >
      <div className="flex items-center gap-2 text-brand-secondary">
        {icon}
        <span className="font-display text-[13px] font-bold">{title}</span>
      </div>
      <p className="mt-1.5 text-[12px] text-brand-mute">{children}</p>
    </div>
  );
}
