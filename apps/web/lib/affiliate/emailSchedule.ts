// Per-campaign cadence for the SCHEDULED competition emails (the clock-driven
// sequence: kickoff / standings digest / ending-soon). The WHETHER a scheduled
// mail sends is governed by the global notification_overrides master/channel
// toggles (one lens: the campaign Email tab); this file governs only the WHEN.
//
// Stored on affiliate_campaigns.email_schedule (jsonb). Kickoff has no timing
// control — it fires once when the competition goes live — so only the digest
// cadence and the ending-soon lead time live here. Read by the P2b scheduler.

export type DigestCadence = "weekly" | "biweekly" | "monthly";

export type CampaignEmailSchedule = {
  /** Standings digest — how often, and (for weekly/biweekly) which weekday. */
  standingsDigest: {
    cadence: DigestCadence;
    /** 0=Sun … 6=Sat. Ignored when cadence is "monthly" (sends on the 1st). */
    weekday: number;
  };
  /** "Ending soon" — how many days before the close date it fires. */
  endingSoon: { leadDays: number };
};

export const DEFAULT_EMAIL_SCHEDULE: CampaignEmailSchedule = {
  standingsDigest: { cadence: "weekly", weekday: 1 }, // Mondays
  endingSoon: { leadDays: 14 },
};

const CADENCES: DigestCadence[] = ["weekly", "biweekly", "monthly"];

/** Normalise the raw jsonb (which may be `{}`, partial, or malformed from an
 *  older shape) into a fully-populated, safe schedule. Never throws. */
export function parseEmailSchedule(raw: unknown): CampaignEmailSchedule {
  const o = (raw ?? {}) as Record<string, unknown>;
  const digest = (o.standings_digest ?? o.standingsDigest ?? {}) as Record<
    string,
    unknown
  >;
  const ending = (o.ending_soon ?? o.endingSoon ?? {}) as Record<
    string,
    unknown
  >;

  const cadence = CADENCES.includes(digest.cadence as DigestCadence)
    ? (digest.cadence as DigestCadence)
    : DEFAULT_EMAIL_SCHEDULE.standingsDigest.cadence;

  const weekdayRaw = Number(digest.weekday ?? digest.week_day);
  const weekday =
    Number.isInteger(weekdayRaw) && weekdayRaw >= 0 && weekdayRaw <= 6
      ? weekdayRaw
      : DEFAULT_EMAIL_SCHEDULE.standingsDigest.weekday;

  const leadRaw = Number(ending.lead_days ?? ending.leadDays);
  const leadDays =
    Number.isInteger(leadRaw) && leadRaw >= 1 && leadRaw <= 90
      ? leadRaw
      : DEFAULT_EMAIL_SCHEDULE.endingSoon.leadDays;

  return { standingsDigest: { cadence, weekday }, endingSoon: { leadDays } };
}

/** Serialise to the snake_case jsonb shape stored in the column + read by SQL. */
export function serialiseEmailSchedule(
  s: CampaignEmailSchedule,
): Record<string, unknown> {
  return {
    standings_digest: {
      cadence: s.standingsDigest.cadence,
      weekday: s.standingsDigest.weekday,
    },
    ending_soon: { lead_days: s.endingSoon.leadDays },
  };
}

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** One-line human summary, e.g. "Weekly · Mondays" or "Monthly · on the 1st". */
export function describeDigestCadence(
  d: CampaignEmailSchedule["standingsDigest"],
): string {
  if (d.cadence === "monthly") return "Monthly · on the 1st";
  const every = d.cadence === "biweekly" ? "Every 2 weeks" : "Weekly";
  return `${every} · ${WEEKDAY_LABELS[d.weekday] ?? "Mondays"}s`;
}
