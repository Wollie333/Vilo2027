import { BarChart3, Workflow } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/requirePermission";
import { type Audience, getBoard } from "@/lib/pipeline/queries";

import { PipelineBoard } from "./_components/PipelineBoard";

export const dynamic = "force-dynamic";

const AUDIENCES: { key: Audience; label: string; dot: string }[] = [
  { key: "host", label: "Hosts", dot: "#10B981" },
  { key: "affiliate", label: "Affiliates", dot: "#6366F1" },
];

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: { audience?: string };
}) {
  await requirePermission("pipeline.view");

  const audience: Audience =
    searchParams.audience === "affiliate" ? "affiliate" : "host";
  const board = await getBoard(audience);

  // Tab counts (lightweight head counts for both boards).
  const admin = createAdminClient();
  const counts: Record<string, number> = {};
  await Promise.all(
    AUDIENCES.map(async (a) => {
      const { count } = await admin
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("audience", a.key);
      counts[a.key] = count ?? 0;
    }),
  );

  const kpis = [
    { l: "New today", v: String(board.kpis.newToday) },
    { l: "In progress", v: String(board.kpis.inProgress) },
    { l: "Won", v: String(board.kpis.won), accent: true },
    { l: "Total leads", v: String(board.kpis.total) },
    { l: "Conversion", v: `${board.kpis.conversionPct}%` },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-brand-line bg-white px-4 pb-4 pt-5 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em]">
              Pipeline
            </h1>
            <p className="mt-0.5 text-[13.5px] text-brand-mute">
              Every lead from the funnel pages, by stage. Drag a card to move
              it.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/admin/pipeline/metrics?audience=${audience}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-secondary transition hover:bg-brand-light"
            >
              <BarChart3 className="h-4 w-4" />
              Metrics
            </a>
            <a
              href="/admin/pipeline/funnels"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-secondary transition hover:bg-brand-light"
            >
              <Workflow className="h-4 w-4" />
              Landing pages
            </a>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-card border border-brand-line bg-white shadow-card sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((k, i) => (
            <div
              key={k.l}
              className={`border-brand-line px-4 py-3.5 ${i > 0 ? "border-l" : ""}`}
            >
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-brand-mute">
                {k.l}
              </div>
              <div
                className={`mt-1 font-display text-[30px] font-extrabold tabular-nums leading-none tracking-[-0.02em] ${
                  k.accent ? "text-brand-primary" : ""
                }`}
              >
                {k.v}
              </div>
            </div>
          ))}
        </div>

        {/* Audience tabs */}
        <div className="mt-4 inline-flex gap-1 rounded-full border border-brand-line bg-[#F1F6F3] p-[3px]">
          {AUDIENCES.map((a) => {
            const on = a.key === audience;
            return (
              <a
                key={a.key}
                href={`/admin/pipeline?audience=${a.key}`}
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
                <span
                  className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                    on
                      ? "bg-brand-accent text-brand-secondary"
                      : "bg-brand-line text-brand-mute"
                  }`}
                >
                  {counts[a.key] ?? 0}
                </span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Board */}
      <PipelineBoard stages={board.stages} />
    </div>
  );
}
