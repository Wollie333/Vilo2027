// Pure, unit-testable maths for competition host free-trials. No I/O, no
// server-only imports — imported by both the server resolver (./trialOffer) and
// the finalize signup action, and covered by ./trialRule.test.ts.

const DAY_MS = 86_400_000;

/**
 * When a competition host's free access ends, per the Founding Programme doc
 * (`docs/strategy/WIELO_FOUNDING_PROGRAMME.md` §5.2–5.3): a fixed cohort cutoff
 * (`cohort_end`, e.g. 31 Dec) with a rolling minimum of `floor_days` free days
 * for late joiners:
 *
 *   trial_ends_at = max(cohort_end, activation + floor_days)
 *
 * This one formula reproduces every documented case — an October/November joiner
 * lands on the fixed cohort date (3 / 2 months), while a December-onward joiner
 * gets their guaranteed rolling floor. `cohort_end` is read as the END of that
 * calendar day in SA time (UTC+2). Returns an ISO instant, or null when neither
 * bound is configured (the caller treats that as "no trial").
 */
export function computeFoundingTrialEnd(
  activationMs: number,
  cfg: { cohort_end: string | null; floor_days: number | null },
): string | null {
  const bounds: number[] = [];
  if (cfg.cohort_end) {
    const t = Date.parse(`${cfg.cohort_end}T23:59:59+02:00`);
    if (!Number.isNaN(t)) bounds.push(t);
  }
  if (cfg.floor_days != null && cfg.floor_days >= 0) {
    bounds.push(activationMs + cfg.floor_days * DAY_MS);
  }
  if (bounds.length === 0) return null;
  return new Date(Math.max(...bounds)).toISOString();
}

/**
 * Is a campaign live right now — status `active` AND within [starts_at, ends_at)?
 * Mirrors the authoritative gate in `app/r/[slug]/route.ts` (kept in sync so the
 * cookie-drop path and the trial resolver agree on "active competition").
 */
export function isCampaignWindowOpen(
  status: string | null,
  startsAt: string | null,
  endsAt: string | null,
  nowMs: number,
): boolean {
  if (status !== "active") return false;
  const started = !startsAt || Date.parse(startsAt) <= nowMs;
  const notEnded = !endsAt || Date.parse(endsAt) > nowMs;
  return started && notEnded;
}
