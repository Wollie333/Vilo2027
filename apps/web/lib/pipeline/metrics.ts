import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { Audience } from "./queries";

// Sales metrics for the admin Pipeline. All reads use the service-role client
// (funnel tables are super-admin-only under RLS) and every caller is gated by
// requirePermission('pipeline.view') at the page. Stage durations are
// reconstructed from the append-only pipeline_activities timeline: a lead enters
// its first stage at created_at, and every later stage-change activity carries
// meta.stage_id, so consecutive entries give the time spent in each stage.

const SOURCE_LABELS: Record<string, string> = {
  host_funnel: "Host funnel",
  affiliate_funnel: "Affiliate funnel",
  affiliate_referral: "Affiliate referral",
  competition: "Competition",
  direct: "Direct",
};

export type StageMetric = {
  stageId: string;
  label: string;
  isWon: boolean;
  isLost: boolean;
  count: number; // leads currently sitting in this stage
  reached: number; // leads that ever entered this stage
  avgHoursInStage: number | null; // avg completed time spent before moving on
};

export type SourceMetric = {
  sourceKind: string;
  label: string;
  count: number;
  won: number;
  conversionPct: number;
};

export type OwnerMetric = { name: string; count: number; won: number };

export type PipelineMetrics = {
  audience: Audience;
  total: number;
  open: number;
  won: number;
  lost: number;
  newThisWeek: number;
  newThisMonth: number;
  wonRatePct: number; // won / total
  winRateClosedPct: number; // won / (won + lost)
  lostRatePct: number; // lost / total
  avgScore: number;
  avgAgeDaysOpen: number | null; // avg age of still-open leads
  avgDaysToWon: number | null; // avg created → won
  staleOpen: number; // open leads with no activity in 14+ days
  stages: StageMetric[];
  sources: SourceMetric[];
  owners: OwnerMetric[];
  generatedAt: string;
};

type LeadRow = {
  id: string;
  stage_id: string;
  status: string;
  score: number | null;
  source_kind: string;
  owner_staff_id: string | null;
  created_at: string;
};

type ActivityRow = {
  lead_id: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

const DAY = 86_400_000;
const HOUR = 3_600_000;

export async function getPipelineMetrics(
  audience: Audience,
): Promise<PipelineMetrics> {
  const admin = createAdminClient();
  const now = Date.now();

  const [{ data: stageRows }, { data: leadRows }] = await Promise.all([
    admin
      .from("pipeline_stages")
      .select("id, label, sort_order, is_won, is_lost")
      .eq("audience", audience)
      .order("sort_order"),
    admin
      .from("pipeline_leads")
      .select(
        "id, stage_id, status, score, source_kind, owner_staff_id, created_at",
      )
      .eq("audience", audience),
  ]);

  const stages = stageRows ?? [];
  const leads = (leadRows ?? []) as LeadRow[];
  const initialStageId = stages[0]?.id ?? null;
  const wonStageIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id));

  // ── Timeline: pull every stage-change activity for these leads in one query.
  const leadIds = leads.map((l) => l.id);
  let activities: ActivityRow[] = [];
  if (leadIds.length) {
    const { data: actRows } = await admin
      .from("pipeline_activities")
      .select("lead_id, meta, created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: true });
    activities = (actRows ?? []) as ActivityRow[];
  }

  // Group stage-change events per lead (only activities that name a stage).
  const changesByLead = new Map<string, { stageId: string; at: number }[]>();
  for (const a of activities) {
    const sid = a.meta?.stage_id;
    if (typeof sid !== "string") continue;
    const arr = changesByLead.get(a.lead_id) ?? [];
    arr.push({ stageId: sid, at: new Date(a.created_at).getTime() });
    changesByLead.set(a.lead_id, arr);
  }

  // ── Per-stage accumulators.
  const currentCount = new Map<string, number>();
  const reached = new Map<string, Set<string>>(); // stageId → set of leadIds
  const durationSum = new Map<string, number>(); // stageId → summed ms
  const durationN = new Map<string, number>();
  const touch = (m: Map<string, Set<string>>, sid: string, leadId: string) => {
    const set = m.get(sid) ?? new Set<string>();
    set.add(leadId);
    m.set(sid, set);
  };

  let scoreSum = 0;
  let openAgeSum = 0;
  let openCount = 0;
  let won = 0;
  let lost = 0;
  let staleOpen = 0;
  let daysToWonSum = 0;
  let daysToWonN = 0;
  let newThisWeek = 0;
  let newThisMonth = 0;

  const bySource = new Map<string, { count: number; won: number }>();
  const byOwner = new Map<string, { count: number; won: number }>();

  for (const l of leads) {
    const createdMs = new Date(l.created_at).getTime();
    scoreSum += l.score ?? 0;
    if (now - createdMs < 7 * DAY) newThisWeek++;
    if (now - createdMs < 30 * DAY) newThisMonth++;

    currentCount.set(l.stage_id, (currentCount.get(l.stage_id) ?? 0) + 1);

    const src = bySource.get(l.source_kind) ?? { count: 0, won: 0 };
    src.count++;
    if (l.status === "won") src.won++;
    bySource.set(l.source_kind, src);

    if (l.owner_staff_id) {
      const o = byOwner.get(l.owner_staff_id) ?? { count: 0, won: 0 };
      o.count++;
      if (l.status === "won") o.won++;
      byOwner.set(l.owner_staff_id, o);
    }

    if (l.status === "won") won++;
    else if (l.status === "lost") lost++;
    else {
      openCount++;
      openAgeSum += now - createdMs;
    }

    // Build the ordered stage timeline: initial entry + each change (dedup
    // consecutive repeats). Reached = every distinct stage the lead touched.
    const events: { stageId: string; at: number }[] = [];
    if (initialStageId) events.push({ stageId: initialStageId, at: createdMs });
    for (const c of changesByLead.get(l.id) ?? []) {
      if (events[events.length - 1]?.stageId !== c.stageId) events.push(c);
    }
    // A lead whose current stage was never emitted as an event still "reached" it.
    if (events[events.length - 1]?.stageId !== l.stage_id) {
      events.push({ stageId: l.stage_id, at: now });
    }

    const seen = new Set<string>();
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      if (!seen.has(e.stageId)) {
        seen.add(e.stageId);
        touch(reached, e.stageId, l.id);
      }
      // Completed duration = time until the NEXT stage entry.
      const next = events[i + 1];
      if (next) {
        const d = next.at - e.at;
        if (d >= 0) {
          durationSum.set(e.stageId, (durationSum.get(e.stageId) ?? 0) + d);
          durationN.set(e.stageId, (durationN.get(e.stageId) ?? 0) + 1);
        }
      }
    }

    // Time to win: first event that lands on a won stage.
    if (l.status === "won") {
      const wonEvent = events.find((e) => wonStageIds.has(e.stageId));
      if (wonEvent) {
        daysToWonSum += wonEvent.at - createdMs;
        daysToWonN++;
      }
    }

    // Stale = open with no activity in 14+ days (created or any later change).
    if (l.status === "open") {
      const lastAt = Math.max(
        createdMs,
        ...(changesByLead.get(l.id) ?? []).map((c) => c.at),
      );
      if (now - lastAt >= 14 * DAY) staleOpen++;
    }
  }

  const total = leads.length;
  const closed = won + lost;

  const stageMetrics: StageMetric[] = stages.map((s) => {
    const n = durationN.get(s.id) ?? 0;
    return {
      stageId: s.id,
      label: s.label,
      isWon: s.is_won,
      isLost: s.is_lost,
      count: currentCount.get(s.id) ?? 0,
      reached: reached.get(s.id)?.size ?? 0,
      avgHoursInStage: n ? (durationSum.get(s.id) ?? 0) / n / HOUR : null,
    };
  });

  const sources: SourceMetric[] = [...bySource.entries()]
    .map(([sourceKind, v]) => ({
      sourceKind,
      label: SOURCE_LABELS[sourceKind] ?? sourceKind,
      count: v.count,
      won: v.won,
      conversionPct: v.count ? Math.round((v.won / v.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Resolve owner names in one batch.
  const ownerIds = [...byOwner.keys()];
  const ownerNames = new Map<string, string>();
  if (ownerIds.length) {
    const { data: people } = await admin
      .from("user_profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    for (const p of people ?? [])
      ownerNames.set(p.id, p.full_name ?? "Unnamed");
  }
  const owners: OwnerMetric[] = [...byOwner.entries()]
    .map(([id, v]) => ({
      name: ownerNames.get(id) ?? "Unassigned",
      count: v.count,
      won: v.won,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    audience,
    total,
    open: openCount,
    won,
    lost,
    newThisWeek,
    newThisMonth,
    wonRatePct: total ? Math.round((won / total) * 100) : 0,
    winRateClosedPct: closed ? Math.round((won / closed) * 100) : 0,
    lostRatePct: total ? Math.round((lost / total) * 100) : 0,
    avgScore: total ? Math.round(scoreSum / total) : 0,
    avgAgeDaysOpen: openCount ? openAgeSum / openCount / DAY : null,
    avgDaysToWon: daysToWonN ? daysToWonSum / daysToWonN / DAY : null,
    staleOpen,
    stages: stageMetrics,
    sources,
    owners,
    generatedAt: new Date(now).toISOString(),
  };
}
