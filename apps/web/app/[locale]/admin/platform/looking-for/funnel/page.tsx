import { ArrowLeft } from "lucide-react";

import {
  AdminStatBand,
  type AdminStat,
} from "@/app/[locale]/admin/_components/AdminStatBand";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import {
  FUNNEL_RANGES,
  loadLookingForFunnel,
  type FunnelRangeKey,
} from "@/lib/funnel/report";
import { LF_STEP_LABELS, type LfStep } from "@/lib/funnel/shared";

export const dynamic = "force-dynamic";

// WS-7 — the Looking-For funnel read-out. Deliberately the minimum needed to
// decide ad spend: where landers drop out, what share of starts publish, and
// whether a published request gets 2 quotes inside 24 hours (>70% is the gate
// before guest spend scales).

function pct(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

export default async function LookingForFunnelPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  await requirePermission("platform.settings");

  const range = (FUNNEL_RANGES.find((r) => r.key === searchParams.range)?.key ??
    "30d") as FunnelRangeKey;
  const f = await loadLookingForFunnel(range);

  const stats: AdminStat[] = [
    { label: "Landing views", value: f.landingViews },
    {
      label: "Wizard starts",
      value: f.wizardStarts,
      sub: `${pct(f.wizardStarts, f.landingViews)} of landings`,
    },
    {
      label: "Reached review",
      value: f.reviewReached,
      sub: `${pct(f.reviewReached, f.wizardStarts)} of starts`,
    },
    {
      label: "Accounts created",
      value: f.accountsCreated,
      sub: "passwordless leads",
    },
    {
      label: "Published",
      value: f.published,
      tone: "primary",
      sub: `${pct(f.published, f.wizardStarts)} of starts`,
    },
  ];

  // The launch gate: >70% of published requests carry 2 quotes within 24h.
  const gateRate =
    f.postsCreated > 0
      ? Math.round((f.postsWithTwoQuotesIn24h / f.postsCreated) * 100)
      : 0;

  const quoteStats: AdminStat[] = [
    { label: "Requests posted", value: f.postsCreated, sub: "source of truth" },
    {
      label: "Got any quote",
      value: f.postsWithAnyQuote,
      sub: `${pct(f.postsWithAnyQuote, f.postsCreated)} of posted`,
    },
    {
      label: "2+ quotes in 24h",
      value: f.postsWithTwoQuotesIn24h,
      tone: gateRate >= 70 ? "primary" : "amber",
      sub: `${pct(f.postsWithTwoQuotesIn24h, f.postsCreated)} — gate is 70%`,
    },
    {
      label: "Median to 1st quote",
      value:
        f.medianHoursToFirstQuote === null
          ? "—"
          : `${f.medianHoursToFirstQuote.toFixed(1)}h`,
      sub: "publish → first quote",
    },
  ];

  const maxStep = Math.max(1, ...f.stepCompletions.map((s) => s.count));

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/platform/looking-for"
          className="inline-flex items-center gap-1.5 text-sm text-brand-mute hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Looking-For
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-ink">
              Looking-For funnel
            </h1>
            <p className="mt-1 text-[13px] text-brand-mute">
              Cookieless, no PII — sessions are a daily-rotating hash. Landing
              and step numbers start from when instrumentation went live; the
              quote metrics below are computed from the requests themselves and
              cover all history in range.
            </p>
          </div>
          <nav className="flex items-center gap-1 rounded-pill border border-brand-line bg-white p-1">
            {FUNNEL_RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/admin/platform/looking-for/funnel?range=${r.key}`}
                className={
                  r.key === range
                    ? "rounded-pill bg-brand-primary px-3 py-1.5 text-[12.5px] font-semibold text-white"
                    : "rounded-pill px-3 py-1.5 text-[12.5px] font-medium text-brand-mute hover:bg-brand-light"
                }
              >
                {r.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-[15px] font-bold text-brand-ink">
          Acquisition
        </h2>
        <AdminStatBand stats={stats} cols={5} />
      </section>

      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-[15px] font-bold text-brand-ink">
          Where the wizard loses people
        </h2>
        <p className="mt-1 text-[12.5px] text-brand-mute">
          A step counts once per session, on forward progress only.
        </p>
        <div className="mt-4 space-y-3">
          {f.stepCompletions.map((s) => (
            <div key={s.step}>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-brand-ink">
                  {LF_STEP_LABELS[s.step as LfStep]}
                </span>
                <span className="num text-brand-mute">
                  {s.count}
                  {f.wizardStarts > 0 ? (
                    <span className="ml-1.5 text-[11px]">
                      ({pct(s.count, f.wizardStarts)})
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-pill bg-brand-light">
                <div
                  className="h-full rounded-pill bg-brand-primary"
                  style={{
                    width: `${Math.round((s.count / maxStep) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[15px] font-bold text-brand-ink">
          Does a posted request get answered?
        </h2>
        <AdminStatBand stats={quoteStats} cols={4} />
        <p className="text-[12.5px] text-brand-mute">
          {f.publishedByLead} of {f.published} tracked publishes came from
          signed-out leads — that is the funnel guest ad spend feeds.
        </p>
      </section>
    </div>
  );
}
