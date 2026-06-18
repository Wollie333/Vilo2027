// ─────────────────────────────────────────────────────────────────────────
// Specials pricing — the SINGLE source of truth for what a booked special
// costs and for the savings badge shown on every special surface.
//
// The guiding rule (plan §"Pricing integration") is REUSE the canonical
// engine, never fork it: a per-night special is just a normal stay priced with
// ONE synthetic max-priority absolute seasonal rule, so seasonal/weekend can
// never leak in while occupancy scaling + cleaning + add-ons all flow normally.
// A flat special bypasses the nightly engine entirely (a truly flat package
// total) but returns the SAME PriceBreakdown shape so the invoice/ledger/host
// UI render identically.
//
// Pure, non-client module — safe to import from server actions and to unit-test.
// Recalculated server-side in the booking action; any client estimate is
// advisory and never trusted.
// ─────────────────────────────────────────────────────────────────────────

import {
  computeAddonSubtotal,
  type PricingModel,
} from "@/app/[locale]/dashboard/addons/schemas";
import { round2 } from "@/lib/format";
import {
  nightsBetween,
  priceStay,
  type AddonLine,
  type PriceBreakdown,
  type PricingUnit,
  type SeasonalRule,
  type StayAddon,
} from "@/lib/pricing";

export type SpecialPriceMode = "flat" | "per_night";

/** The minimal special-pricing config the engine needs. */
export type SpecialPricingConfig = {
  priceMode: SpecialPriceMode;
  /** The package total when priceMode === 'flat'. */
  flatTotal: number | null;
  /** The override nightly rate when priceMode === 'per_night'. */
  perNightPrice: number | null;
  currency: string;
};

export type PriceSpecialStayInput = SpecialPricingConfig & {
  /** 'YYYY-MM-DD' inclusive. */
  checkIn: string;
  /** 'YYYY-MM-DD' exclusive (the morning the guest leaves). */
  checkOut: string;
  /** The room or whole-property priceable unit (guests already set). */
  unit: PricingUnit;
  /** Total guests across the stay — drives per-guest add-on maths. */
  totalGuests: number;
  /**
   * Add-ons to fold in: compulsory (always) + any guest-selected optional ones.
   * Engine StayAddon shape — for per-night models the quantity already carries
   * the night count (see defaultAddonQuantity).
   */
  addons?: StayAddon[];
};

/**
 * The one synthetic seasonal rule a per-night special is priced with. It is an
 * `absolute` rule spanning the whole stay at the highest possible priority, so
 * it always wins over (in fact, replaces) any real seasonal/weekend rate. Pass
 * THIS rule as the ONLY rule to priceStay — never load real seasonal pricing —
 * and seasonal can never leak into a special, while extra-guest occupancy fees
 * still stack (resolveNightlyRate keeps them for per_room_plus_extra).
 */
export function syntheticPerNightRule(
  checkIn: string,
  checkOut: string,
  perNightPrice: number,
  label = "Special",
): SeasonalRule {
  return {
    roomId: null,
    startDate: checkIn,
    endDate: checkOut, // inclusive end; covers every night (last night < checkOut)
    adjustmentType: "absolute",
    adjustmentValue: Math.max(0, perNightPrice),
    label,
    priority: Number.MAX_SAFE_INTEGER,
    minNights: null,
    isActive: true,
    createdAt: null,
  };
}

function addonLines(
  addons: StayAddon[] | undefined,
  totalGuests: number,
): { lines: AddonLine[]; total: number } {
  const lines: AddonLine[] = (addons ?? []).map((a) => ({
    label: a.label,
    pricingModel: a.pricingModel,
    unitPrice: a.unitPrice,
    quantity: a.quantity,
    addonId: a.addonId ?? null,
    subtotal: round2(
      computeAddonSubtotal(
        a.pricingModel,
        a.unitPrice,
        a.quantity,
        totalGuests,
      ),
    ),
  }));
  return { lines, total: round2(lines.reduce((s, a) => s + a.subtotal, 0)) };
}

/**
 * A flat special is a package total — occupancy, seasonal, weekend, and per-room
 * cleaning are all ignored for the accommodation portion. We build a synthetic
 * PriceBreakdown (no per-night lines, seasonalNights/weekendNights 0) so every
 * downstream consumer renders it like any other priced stay, WITHOUT abusing
 * priceStay (which would re-introduce nightly maths). Compulsory + selected
 * optional add-ons are added on top of the flat total.
 */
function flatSpecialBreakdown(input: PriceSpecialStayInput): PriceBreakdown {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const baseSubtotal = round2(Math.max(0, input.flatTotal ?? 0));
  const { lines: addons, total: addonsTotal } = addonLines(
    input.addons,
    input.totalGuests,
  );
  return {
    nights,
    units: [
      {
        roomId: input.unit.roomId,
        nights: [],
        baseSubtotal,
        cleaningFee: 0,
      },
    ],
    baseSubtotal,
    weekendNights: 0,
    seasonalNights: 0,
    discount: {
      wholeSaving: 0,
      losSaving: 0,
      losKind: null,
      losPct: 0,
      discountTotal: 0,
      total: baseSubtotal,
    },
    cleaningTotal: 0,
    addons,
    addonsTotal,
    couponDiscount: 0,
    couponCode: null,
    total: round2(baseSubtotal + addonsTotal),
    currency: input.currency,
    // A flat package is a fixed deal — its own length is its minimum.
    effectiveMinNights: nights,
  };
}

/**
 * Price a special stay end-to-end and return a fully-itemised PriceBreakdown —
 * the SAME shape priceStay returns. Flat → synthetic package breakdown;
 * per-night → the canonical engine with the single synthetic absolute rule so
 * seasonal/weekend never apply while occupancy + cleaning + add-ons do.
 */
export function priceSpecialStay(input: PriceSpecialStayInput): PriceBreakdown {
  if (input.priceMode === "flat") {
    return flatSpecialBreakdown(input);
  }
  return priceStay({
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    units: [input.unit],
    // ONLY the synthetic rule — real seasonal pricing is deliberately never loaded.
    seasonalRules: [
      syntheticPerNightRule(
        input.checkIn,
        input.checkOut,
        input.perNightPrice ?? 0,
      ),
    ],
    currency: input.currency,
    totalGuests: input.totalGuests,
    listingMinNights: 1,
    isWholeCombo: false,
    wholePct: null,
    weeklyPct: null,
    monthlyPct: null,
    addons: input.addons,
  });
}

export type SpecialSavings = {
  /** What the same stay would cost at the normal/seasonal rate (null if none). */
  wasPrice: number | null;
  savingsAmount: number | null;
  savingsPct: number | null;
};

const NO_SAVINGS: SpecialSavings = {
  wasPrice: null,
  savingsAmount: null,
  savingsPct: null,
};

/**
 * The savings badge maths. `wasPrice` is the normal/seasonal total for the same
 * stay; `specialPrice` is what the special charges. Returns nulls when there is
 * no genuine saving (badge is then hidden), per the plan's "skip badge if
 * savings ≤ 0".
 */
export function specialSavings(
  wasPrice: number,
  specialPrice: number,
): SpecialSavings {
  if (!(wasPrice > 0)) return NO_SAVINGS;
  const saving = round2(wasPrice - specialPrice);
  if (!(saving > 0)) return NO_SAVINGS;
  return {
    wasPrice: round2(wasPrice),
    savingsAmount: saving,
    savingsPct: Math.round((saving / wasPrice) * 100),
  };
}

export type PriceSpecialWithSavingsInput = SpecialPricingConfig & {
  checkIn: string;
  checkOut: string;
  unit: PricingUnit;
  totalGuests: number;
  /**
   * The property/room's REAL seasonal rules overlapping the stay — used ONLY to
   * compute the was-price shadow. They never touch the special's own price.
   */
  seasonalRules: SeasonalRule[];
  /** Compulsory add-ons — folded into BOTH the special and the shadow. */
  requiredAddons?: StayAddon[];
};

/**
 * Price the special AND its normal-rate shadow in one call, then derive the
 * savings badge. The shadow uses the canonical engine with the REAL seasonal
 * rules + normal occupancy + cleaning; the special uses priceSpecialStay. The
 * same compulsory add-ons are folded into both sides, so the saving reflects the
 * accommodation deal (add-ons cancel out in the difference but still scale the
 * percentage against the full package — matching the plan).
 */
export function priceSpecialWithSavings(input: PriceSpecialWithSavingsInput): {
  special: PriceBreakdown;
  normal: PriceBreakdown;
  savings: SpecialSavings;
} {
  const special = priceSpecialStay({
    priceMode: input.priceMode,
    flatTotal: input.flatTotal,
    perNightPrice: input.perNightPrice,
    currency: input.currency,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    unit: input.unit,
    totalGuests: input.totalGuests,
    addons: input.requiredAddons,
  });

  const normal = priceStay({
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    units: [input.unit],
    seasonalRules: input.seasonalRules,
    currency: input.currency,
    totalGuests: input.totalGuests,
    listingMinNights: 1,
    isWholeCombo: false,
    wholePct: null,
    weeklyPct: null,
    monthlyPct: null,
    addons: input.requiredAddons,
  });

  return {
    special,
    normal,
    savings: specialSavings(normal.total, special.total),
  };
}

export type { PricingModel };
