import { z } from "zod";

import type { CommissionStructure, Competition, LadderBand } from "./campaigns";

// WS-1i — the campaign BUILDER's contract. Kept pure (no server-only, no I/O) so
// the validation that guards real commission money is unit-tested.
//
// Why this is strict: `commission_structure` is read by the accrual resolver, so
// a malformed ladder silently mis-pays partners for as long as nobody notices.
// The rules below make the malformed shapes impossible to save:
//   • rates are entered as PERCENT in the UI and stored as fractions 0..1
//   • a ladder needs exactly ONE open-ended top band (max = null)
//   • band ceilings must be unique and ascending
//   • a campaign cannot go ACTIVE without a structure that resolves

export const CAMPAIGN_STATUSES = [
  "draft",
  "active",
  "ended",
  "archived",
] as const;
export const ELIGIBLE_PARTNERS = ["all", "tagged", "invite"] as const;
export const ELIGIBLE_REFERRALS = [
  "all_time",
  "referred_in_window",
  "activated_in_window",
] as const;
export const SCORING_MODES = ["total", "net_change"] as const;
export const LEADERBOARD_VISIBILITY = ["public", "partners", "hidden"] as const;
export const COMMISSION_MODELS = ["ladder", "flat", "inherit"] as const;
export const COMMISSION_DURATIONS = ["once", "recurring", "lifetime"] as const;

const rateFraction = z.number().min(0).max(1);

export const ladderBandSchema = z.object({
  // null = the open-ended top band.
  max: z.number().positive().nullable(),
  rate: rateFraction,
});

export const commissionStructureSchema = z
  .object({
    model: z.enum(COMMISSION_MODELS),
    scope: z.string().max(40).optional(),
    duration: z.enum(COMMISSION_DURATIONS).optional(),
    recurring_periods: z.number().int().positive().max(120).optional(),
    bands: z.array(ladderBandSchema).max(12).optional(),
    flat_rate: z.number().min(0).optional(),
    flat_type: z.enum(["percent", "amount"]).optional(),
    conversion_bonus: z
      .object({
        monthly: z.number().min(0).max(100_000).optional(),
        annual: z.number().min(0).max(100_000).optional(),
      })
      .optional(),
  })
  .superRefine((cs, ctx) => {
    if (cs.model === "ladder") {
      const bands = cs.bands ?? [];
      if (bands.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A ladder needs at least one band.",
        });
        return;
      }
      const openEnded = bands.filter((b) => b.max === null);
      if (openEnded.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "A ladder needs exactly one top band with no ceiling — that is the rate above every other rung.",
        });
      }
      const ceilings = bands
        .filter((b) => b.max !== null)
        .map((b) => b.max as number);
      if (new Set(ceilings).size !== ceilings.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Two bands share the same ceiling.",
        });
      }
    }
    if (cs.model === "flat") {
      if (cs.flat_rate === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A flat structure needs a rate.",
        });
      } else if (cs.flat_type !== "amount" && cs.flat_rate > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A percent rate must be between 0 and 100%.",
        });
      }
    }
    if (cs.duration === "recurring" && !cs.recurring_periods) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Recurring commission needs a number of payments.",
      });
    }
  });

export const prizeSchema = z.object({
  placing: z.number().int().positive().max(100).optional(),
  cash: z.number().min(0).max(1_000_000).optional(),
  floor: rateFraction.optional(),
  milestone: z.string().max(60).optional(),
  monthly_top_net_change: z.number().min(0).max(1_000_000).optional(),
});

export const competitionSchema = z.object({
  // Explicit key schema: single-arg z.record() reads the argument as the KEY
  // type here, which typed `events` as Record<number, unknown>.
  events: z.record(z.string(), z.number()).optional(),
  scoring_mode: z.enum(SCORING_MODES).optional(),
  count_active_only: z.boolean().optional(),
  each_listing_counts: z.boolean().optional(),
  tie_breaker: z.string().max(60).optional(),
  leaderboard_visibility: z.enum(LEADERBOARD_VISIBILITY).optional(),
  prizes: z.array(prizeSchema).max(30).optional(),
});

export const campaignInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers and dashes.",
      )
      .max(60),
    status: z.enum(CAMPAIGN_STATUSES),
    starts_at: z.string().nullable(),
    ends_at: z.string().nullable(),
    eligible_partners: z.enum(ELIGIBLE_PARTNERS),
    eligible_referrals: z.enum(ELIGIBLE_REFERRALS),
    rules_doc_slug: z.string().trim().max(80).nullable(),
    commission_structure: commissionStructureSchema,
    competition: competitionSchema,
  })
  .superRefine((c, ctx) => {
    if (
      c.starts_at &&
      c.ends_at &&
      Date.parse(c.ends_at) <= Date.parse(c.starts_at)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ends_at"],
        message: "The end date must be after the start date.",
      });
    }
    // A live campaign pays real commission — it may not run on "inherit with no
    // rates" or a ladder that resolves to nothing.
    if (c.status === "active" && c.commission_structure.model === "ladder") {
      const bands = c.commission_structure.bands ?? [];
      if (bands.every((b) => b.rate === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["status"],
          message: "Every band pays 0% — that campaign would pay nobody.",
        });
      }
    }
  });

export type CampaignInput = z.infer<typeof campaignInputSchema>;

/** Bands ascending, open-ended band last — the order the ladder is read in. */
export function sortBandsForDisplay(bands: LadderBand[]): LadderBand[] {
  return [...bands].sort(
    (a, b) =>
      (a.max ?? Number.POSITIVE_INFINITY) - (b.max ?? Number.POSITIVE_INFINITY),
  );
}

/** UI percent (25) → stored fraction (0.25), rounded to 4dp. */
export function pctToRate(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.round(Math.min(100, Math.max(0, pct)) * 100) / 10_000;
}

/** Stored fraction (0.25) → UI percent (25). */
export function rateToPct(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.round(rate * 10_000) / 100;
}

/** A one-line summary of the competition config for the list view. */
export function describeCompetition(comp: Competition | null): string {
  if (!comp) return "No competition";
  const prizes = comp.prizes?.length ?? 0;
  const mode = comp.scoring_mode === "net_change" ? "net change" : "total";
  const vis = comp.leaderboard_visibility ?? "public";
  return `${mode} scoring · ${prizes} prize${prizes === 1 ? "" : "s"} · ${vis} leaderboard`;
}

/** Plain-language ladder summary, e.g. "10% → 25% across 4 rungs". */
export function describeLadder(cs: CommissionStructure | null): string {
  if (!cs) return "—";
  if (cs.model !== "ladder")
    return cs.model === "flat" ? "Flat rate" : "Inherit";
  const bands = sortBandsForDisplay(cs.bands ?? []);
  if (!bands.length) return "Ladder (no rungs)";
  const first = rateToPct(bands[0]!.rate);
  const last = rateToPct(bands[bands.length - 1]!.rate);
  return `${first}% → ${last}% across ${bands.length} rung${bands.length === 1 ? "" : "s"}`;
}
