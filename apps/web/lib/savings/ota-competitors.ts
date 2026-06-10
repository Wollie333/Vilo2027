/**
 * Single source of truth for the host-savings / commission-comparison feature.
 *
 * Vilo takes 0% booking commission — that's the whole pitch. These are the
 * rates the big OTAs would have skimmed off the same direct-booking revenue,
 * so a host can see what each competitor would have cost them.
 *
 * Rates are typical host-side commission for the South African accommodation
 * market and are intentionally easy to tweak in this one place. They are
 * reference figures, not the host's own data — the host's revenue base is
 * always pulled live from the DB (fetch_host_savings).
 */

export interface OtaCompetitor {
  /** Display name. */
  name: string;
  /** Typical host-side commission as a fraction (0.15 = 15%). */
  rate: number;
  /** Where the platform is most relevant. */
  scope: "global" | "za";
  /** One-line context shown under the name. */
  note: string;
}

/**
 * Headline rate for the "Vilo has saved you R X" figure. Kept at 15% to match
 * the platform-wide commission-saved stat (fetch_platform_commission_saved) so
 * every savings number across the app agrees.
 */
export const HEADLINE_OTA_RATE = 0.15;

export const OTA_COMPETITORS: readonly OtaCompetitor[] = [
  {
    name: "Booking.com",
    rate: 0.15,
    scope: "global",
    note: "Standard commission — often higher as a Preferred Partner",
  },
  {
    name: "Airbnb",
    rate: 0.14,
    scope: "global",
    note: "Host-only service fee model",
  },
  {
    name: "Expedia",
    rate: 0.16,
    scope: "global",
    note: "Base compensation, before promotions",
  },
  {
    name: "LekkeSlaap",
    rate: 0.12,
    scope: "za",
    note: "Popular South African self-catering OTA",
  },
  {
    name: "SafariNow",
    rate: 0.12,
    scope: "za",
    note: "South African accommodation marketplace",
  },
  {
    name: "Vrbo",
    rate: 0.08,
    scope: "global",
    note: "Pay-per-booking model",
  },
] as const;

export interface SavingsRow extends OtaCompetitor {
  /** What this OTA would have taken from the host's direct-booking revenue. */
  wouldHavePaid: number;
}

export interface SavingsBreakdown {
  /** Total confirmed direct-booking revenue the calc is based on. */
  directRevenue: number;
  /** Headline amount kept vs the 15% baseline. */
  savedSoFar: number;
  /** Per-OTA "what you'd have paid them" rows, most expensive first. */
  rows: SavingsRow[];
}

/** Pure: turn a revenue base into the savings headline + per-OTA comparison. */
export function computeSavings(directRevenue: number): SavingsBreakdown {
  const rows = OTA_COMPETITORS.map((ota) => ({
    ...ota,
    wouldHavePaid: directRevenue * ota.rate,
  })).sort((a, b) => b.wouldHavePaid - a.wouldHavePaid);

  return {
    directRevenue,
    savedSoFar: directRevenue * HEADLINE_OTA_RATE,
    rows,
  };
}
