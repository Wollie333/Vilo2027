import { ArrowLeft, Workflow } from "lucide-react";

import { requirePermission } from "@/lib/admin/requirePermission";
import { getPipelineMetrics } from "@/lib/pipeline/metrics";
import type { Audience } from "@/lib/pipeline/queries";

export const dynamic = "force-dynamic";

const AUDIENCES: { key: Audience; label: string; dot: string }[] = [
  { key: "host", label: "Hosts", dot: "#10B981" },
  { key: "affiliate", label: "Affiliates", dot: "#6366F1" },
];

function fmtDays(n: number | null): string {
  if (n == null) return "—";
  if (n < 1) return "<1 day";
  return `${n.toFixed(1)} days`;
}

function fmtHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return "<1h";
  if (h < 48) return `${Math.round(h)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export default async function PipelineMetricsPage({
  searchParams,
}: {
  searchParams: { audience?: string };
}) {
  await requirePermission("pipeline.view");

  const audience: Audience =
    searchParams.audience === "affiliate" ? "affiliate" : "host";
  const m = await getPipelineMetrics(audience);

  const primary = [
    { l: "Total leads", v: String(m.total) },
    { l: "Open", v: String(m.open) },
    { l: "Won", v: String(m.won), accent: true },
    { l: "Lost", v: String(m.lost) },
    { l: "Conversion", v: `${m.wonRatePct}%`, hint: "won ÷ all leads" },
    { l: "Win rate", v: `${m.winRateClosedPct}%`, hint: "won ÷ closed" },
  ];
  const secondary = [
    { l: "New this week", v: String(m.newThisWeek) },
    { l: "New this month", v: String(m.newThisMonth) },
    { l: "Avg lead score", v: String(m.avgScore) },
    { l: "Avg age (open)", v: fmtDays(m.avgAgeDaysOpen) },
    { l: "Avg time to win", v: fmtDays(m.avgDaysToWon) },
    { l: "Stale (14d+)", v: String(m.staleOpen), warn: m.staleOpen > 0 },
  ];

  const maxReached = Math.max(1, ...m.stages.map((s) => s.reached));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8">
      {/* Header */}
      <a
        href={`/admin/pipeline?audience=${audience}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-mute transition hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to board
      </a>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em]">
            Pipeline metrics
          </h1>
          <p className="mt-0.5 text-[13.5px] text-brand-mute">
            Lead volume, conversion and how long leads spend in each stage.
          </p>
        </div>
        <a
          href="/admin/pipeline/funnels"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-secondary transition hover:bg-brand-light"
        >
          <Workflow className="h-4 w-4" />
          Landing pages
        </a>
      </div>

      {/* Audience tabs */}
      <div className="mt-4 inline-flex gap-1 rounded-full border border-brand-line bg-[#F1F6F3] p-[3px]">
        {AUDIENCES.map((a) => {
          const on = a.key === audience;
          return (
            <a
              key={a.key}
              href={`/admin/pipeline/metrics?audience=${a.key}`}
              className={`inline-flex h-[34px] items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition ${
                on
                  ? "bg-white text-brand-secondary shadow-card"
                  : "text-brand-mute hover:text-brand-ink"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: a.dot }}
              />
              {a.label}
            </a>
          );
        })}
      </div>

      {/* Primary KPIs */}
      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-card border border-brand-line bg-white shadow-card sm:grid-cols-3 lg:grid-cols-6">
        {primary.map((k, i) => (
          <Tile key={k.l} {...k} border={i > 0} />
        ))}
      </div>

      {/* Secondary stats */}
      <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-card border border-brand-line bg-white shadow-card sm:grid-cols-3 lg:grid-cols-6">
        {secondary.map((k, i) => (
          <Tile key={k.l} {...k} border={i > 0} />
        ))}
      </div>

      {/* Stage funnel + durations */}
      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-mute">
          Stage funnel &amp; duration
        </h2>
        <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-brand-line px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-brand-mute sm:grid-cols-[1.6fr_1fr_auto_auto]">
            <span>Stage</span>
            <span className="hidden text-right sm:block">Reached</span>
            <span className="text-right">In stage now</span>
            <span className="text-right">Avg time</span>
          </div>
          {m.stages.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-brand-mute">
              No stages configured.
            </div>
          ) : (
            m.stages.map((s) => (
              <div
                key={s.stageId}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-brand-line px-4 py-3 last:border-0 sm:grid-cols-[1.6fr_1fr_auto_auto]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {s.isWon ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                    ) : null}
                    <span
                      className={`truncate text-[13.5px] font-semibold ${
                        s.isWon
                          ? "text-brand-secondary"
                          : s.isLost
                            ? "text-brand-mute"
                            : "text-brand-ink"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {/* Reached bar (mobile shows it here) */}
                  <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[#EEF4F0] sm:hidden">
                    <div
                      className={`h-full rounded-full ${s.isWon ? "bg-brand-primary" : "bg-[#A7E8CB]"}`}
                      style={{ width: `${(s.reached / maxReached) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-[#EEF4F0]">
                    <div
                      className={`h-full rounded-full ${s.isWon ? "bg-brand-primary" : "bg-[#A7E8CB]"}`}
                      style={{ width: `${(s.reached / maxReached) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-[12.5px] font-semibold tabular-nums text-brand-mute">
                    {s.reached}
                  </span>
                </div>
                <span className="text-right text-[13.5px] font-bold tabular-nums">
                  {s.count}
                </span>
                <span className="w-14 text-right text-[12.5px] tabular-nums text-brand-mute">
                  {fmtHours(s.avgHoursInStage)}
                </span>
              </div>
            ))
          )}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-brand-mute">
          “Reached” counts every lead that ever entered a stage; “Avg time” is
          the average time a lead spent there before moving on.
        </p>
      </section>

      {/* Sources + owners */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-mute">
            By source
          </h2>
          <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-brand-line px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-brand-mute">
              <span>Source</span>
              <span className="text-right">Leads</span>
              <span className="text-right">Won</span>
              <span className="text-right">Conv.</span>
            </div>
            {m.sources.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-brand-mute">
                No leads yet.
              </div>
            ) : (
              m.sources.map((s) => (
                <div
                  key={s.sourceKind}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-brand-line px-4 py-2.5 text-[13px] last:border-0"
                >
                  <span className="truncate font-medium text-brand-ink">
                    {s.label}
                  </span>
                  <span className="text-right tabular-nums">{s.count}</span>
                  <span className="text-right tabular-nums text-brand-secondary">
                    {s.won}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-brand-primary">
                    {s.conversionPct}%
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-mute">
            By owner
          </h2>
          <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-brand-line px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-brand-mute">
              <span>Owner</span>
              <span className="text-right">Leads</span>
              <span className="text-right">Won</span>
            </div>
            {m.owners.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-brand-mute">
                No leads assigned to an owner yet.
              </div>
            ) : (
              m.owners.map((o) => (
                <div
                  key={o.name}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-brand-line px-4 py-2.5 text-[13px] last:border-0"
                >
                  <span className="truncate font-medium text-brand-ink">
                    {o.name}
                  </span>
                  <span className="text-right tabular-nums">{o.count}</span>
                  <span className="text-right tabular-nums text-brand-secondary">
                    {o.won}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Tile({
  l,
  v,
  hint,
  accent,
  warn,
  border,
}: {
  l: string;
  v: string;
  hint?: string;
  accent?: boolean;
  warn?: boolean;
  border?: boolean;
}) {
  return (
    <div
      className={`px-4 py-3.5 ${border ? "border-l border-brand-line" : ""}`}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-brand-mute">
        {l}
      </div>
      <div
        className={`mt-1 font-display text-[26px] font-extrabold tabular-nums leading-none tracking-[-0.02em] ${
          accent
            ? "text-brand-primary"
            : warn
              ? "text-red-600"
              : "text-brand-ink"
        }`}
      >
        {v}
      </div>
      {hint ? (
        <div className="mt-1 text-[10.5px] text-brand-mute">{hint}</div>
      ) : null}
    </div>
  );
}
