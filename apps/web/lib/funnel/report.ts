import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { summariseQuoteLatency } from "./quoteMetrics";
import { FUNNEL_LOOKING_FOR, LF_STEPS, type LfStep } from "./shared";

// WS-7 — the read-out. Answers the four questions the launch plan asks before
// any ad spend: how many landers start the wizard, which step loses them, what
// share of starts publish, and whether a published request gets 2 quotes inside
// 24 hours (the >70% gate before guest spend scales).
//
// The quote metric is derived from the source of truth (looking_for_posts vs
// looking_for_responses), NOT from events — it must stay correct even for posts
// created before instrumentation existed.

export const FUNNEL_RANGES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
] as const;

export type FunnelRangeKey = (typeof FUNNEL_RANGES)[number]["key"];

export type LookingForFunnelReport = {
  since: string;
  landingViews: number;
  wizardStarts: number;
  reviewReached: number;
  accountsCreated: number;
  published: number;
  publishedByLead: number;
  stepCompletions: { step: LfStep; label: string; count: number }[];
  /** Posts actually created in the window (source of truth, not events). */
  postsCreated: number;
  postsWithAnyQuote: number;
  postsWithTwoQuotesIn24h: number;
  /** Median hours from publish to the FIRST quote; null when no quotes yet. */
  medianHoursToFirstQuote: number | null;
};

export function rangeDays(key: FunnelRangeKey): number {
  return FUNNEL_RANGES.find((r) => r.key === key)?.days ?? 30;
}

export async function loadLookingForFunnel(
  range: FunnelRangeKey = "30d",
): Promise<LookingForFunnelReport> {
  const admin = createAdminClient();
  const since = new Date(
    Date.now() - rangeDays(range) * 86_400_000,
  ).toISOString();

  const countEvent = async (event: string, step?: LfStep) => {
    let q = admin
      .from("funnel_events")
      .select("id", { count: "exact", head: true })
      .eq("funnel", FUNNEL_LOOKING_FOR)
      .eq("event", event)
      .gte("created_at", since);
    if (step) q = q.eq("step", step);
    const { count } = await q;
    return count ?? 0;
  };

  const [
    landingViews,
    wizardStarts,
    reviewReached,
    accountsCreated,
    published,
    publishedByLead,
    stepCounts,
    { data: posts },
  ] = await Promise.all([
    countEvent("landing_view"),
    countEvent("wizard_start"),
    countEvent("review_reached"),
    countEvent("account_created"),
    countEvent("published"),
    admin
      .from("funnel_events")
      .select("id", { count: "exact", head: true })
      .eq("funnel", FUNNEL_LOOKING_FOR)
      .eq("event", "published")
      .eq("is_lead", true)
      .gte("created_at", since)
      .then((r) => r.count ?? 0),
    Promise.all(LF_STEPS.map((s) => countEvent("step_complete", s))),
    admin
      .from("looking_for_posts")
      .select("id, created_at")
      .gte("created_at", since),
  ]);

  // Quote latency per published request — the >70%-in-24h launch gate.
  const postRows = posts ?? [];
  const postIds = postRows.map((p) => p.id);
  const { data: responses } = postIds.length
    ? await admin
        .from("looking_for_responses")
        .select("post_id, sent_at")
        .in("post_id", postIds)
    : { data: [] as { post_id: string; sent_at: string }[] };

  const quotes = summariseQuoteLatency(postRows, responses ?? []);

  return {
    since,
    landingViews,
    wizardStarts,
    reviewReached,
    accountsCreated,
    published,
    publishedByLead,
    stepCompletions: LF_STEPS.map((step, i) => ({
      step,
      label: step,
      count: stepCounts[i] ?? 0,
    })),
    ...quotes,
  };
}
