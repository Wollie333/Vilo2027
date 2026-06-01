// ─────────────────────────────────────────────────────────────────────────
// Vilo canonical pricing engine — the SINGLE source of truth for what a stay
// costs. Every surface (the authoritative server booking action, the client
// checkout estimate, the host seasonal preview) calls priceStay() so the
// quoted price, the charged price, and the preview can never disagree.
//
// The Vilo Pricing Stack (fixed, documented order):
//   1. Nightly rate  — per night pick ONE: seasonal rule → weekend rate → base.
//   2. Occupancy     — pricing_mode scales that rate by guest count.
//   3. Stay discounts— whole-place combo, then length-of-stay (% off base only).
//   4. Fees & extras — cleaning (once) + add-ons. Never discounted.
//   5. Total         — no success fee.
//
// Seasonal rules: see resolveNightlyRate for the precedence + absolute/percent
// semantics. Pure, non-client module — safe to import from server and client.
// ─────────────────────────────────────────────────────────────────────────

import {
  computeAddonSubtotal,
  type PricingModel,
} from "@/app/dashboard/addons/schemas";

import { applyStayDiscounts, type StayDiscount } from "./discounts";
import { occupancyNightly, type RoomPricing } from "./occupancy";

/** Friday + Saturday nights — the canonical Vilo "weekend" (DOW 5,6, UTC). */
export const VILO_WEEKEND_DAYS = [5, 6] as const;

export type SeasonalAdjustmentType = "absolute" | "percent";

/** One host-defined seasonal rule, in the shape the engine consumes. */
export type SeasonalRule = {
  /** null = listing-wide; a room id = scoped to that room (wins over listing). */
  roomId: string | null;
  /** Inclusive 'YYYY-MM-DD'. A 1-day range = a single-date override. */
  startDate: string;
  /** Inclusive 'YYYY-MM-DD'. */
  endDate: string;
  adjustmentType: SeasonalAdjustmentType;
  /** absolute → the flat nightly room price; percent → +/- % on the room rate. */
  adjustmentValue: number;
  label: string;
  /** Higher wins on overlap. */
  priority: number;
  /** Optional minimum-nights override active inside this range. */
  minNights: number | null;
  isActive: boolean;
  /** ISO timestamp — newest wins as the final tie-break. Optional. */
  createdAt?: string | null;
};

/** A priceable unit: one room, or the whole listing (roomId = null). */
export type PricingUnit = RoomPricing & {
  /** null = the whole-listing unit; otherwise the room id. */
  roomId: string | null;
  weekend_price: number | null;
  cleaning_fee: number;
  guests: number;
};

export type StayAddon = {
  label: string;
  pricingModel: PricingModel;
  unitPrice: number;
  /** For per-night models the quantity already carries the night count. */
  quantity: number;
  /** Catalog add-on id — lets a coupon target one specific add-on. */
  addonId?: string | null;
};

/**
 * A coupon already validated server-side (code match, window, caps, min-spend).
 * The engine only applies its MATHS — never trust it for eligibility.
 *  - scope 'order'         → discounts (discounted accommodation + add-ons)
 *  - scope 'accommodation' → discounts the room/base subtotal (optionally one room)
 *  - scope 'addons'        → discounts the add-ons subtotal
 * Cleaning is never discounted by a coupon.
 */
export type ResolvedCoupon = {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  scope: "order" | "accommodation" | "addons";
  /** Restrict an accommodation coupon to a single room. */
  roomId?: string | null;
  /** Restrict an add-ons coupon to a single add-on. */
  addonId?: string | null;
};

export type PriceStayInput = {
  /** 'YYYY-MM-DD' inclusive. */
  checkIn: string;
  /** 'YYYY-MM-DD' exclusive (the morning the guest leaves). */
  checkOut: string;
  units: PricingUnit[];
  seasonalRules: SeasonalRule[];
  currency: string;
  /** Total guests across the stay — drives per-guest add-on maths. */
  totalGuests: number;
  /** Listing-level minimum nights (folded into effectiveMinNights). */
  listingMinNights: number;
  // ── discounts ──
  isWholeCombo: boolean;
  wholePct: number | null;
  weeklyPct: number | null;
  monthlyPct: number | null;
  addons?: StayAddon[];
  /** A pre-validated coupon to apply as the final discount stage. */
  coupon?: ResolvedCoupon | null;
  /** Override the weekend definition (defaults to Fri+Sat). */
  weekendDays?: readonly number[];
};

export type NightSource = "seasonal" | "weekend" | "base";

export type NightLine = {
  date: string;
  rate: number;
  source: NightSource;
  /** Guest-facing label: the rule label, "Weekend", or "Standard". */
  label: string;
};

export type UnitBreakdown = {
  roomId: string | null;
  nights: NightLine[];
  baseSubtotal: number;
  cleaningFee: number;
};

export type AddonLine = {
  label: string;
  pricingModel: PricingModel;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  addonId?: string | null;
};

export type PriceBreakdown = {
  nights: number;
  units: UnitBreakdown[];
  /** Sum of unit base subtotals, before any discount. */
  baseSubtotal: number;
  weekendNights: number;
  seasonalNights: number;
  discount: StayDiscount;
  cleaningTotal: number;
  addons: AddonLine[];
  addonsTotal: number;
  /** Coupon discount applied (0 when no coupon). */
  couponDiscount: number;
  /** The applied coupon code, or null. */
  couponCode: string | null;
  /** base − stayDiscount + cleaning + addons − couponDiscount. */
  total: number;
  currency: string;
  /** max(listing min, any overlapping active seasonal rule's min). */
  effectiveMinNights: number;
};

/**
 * Coupon maths over an already-priced stay. Returns the rand value to subtract.
 * Cleaning is never eligible. A room-scoped accommodation coupon only sees that
 * room's subtotal.
 */
export function couponDiscountFor(
  coupon: ResolvedCoupon | null | undefined,
  parts: {
    accommodationAfterDiscount: number;
    addons: AddonLine[];
    units: UnitBreakdown[];
  },
): number {
  if (!coupon) return 0;
  const addonsTotal = parts.addons.reduce((s, a) => s + a.subtotal, 0);
  let eligible: number;
  if (coupon.scope === "addons") {
    // Target one add-on when set, else every add-on in the order.
    eligible = coupon.addonId
      ? parts.addons
          .filter((a) => a.addonId === coupon.addonId)
          .reduce((s, a) => s + a.subtotal, 0)
      : addonsTotal;
  } else if (coupon.scope === "accommodation") {
    eligible = coupon.roomId
      ? (parts.units.find((u) => u.roomId === coupon.roomId)?.baseSubtotal ?? 0)
      : parts.accommodationAfterDiscount;
  } else {
    eligible = parts.accommodationAfterDiscount + addonsTotal;
  }
  if (eligible <= 0) return 0;
  const raw =
    coupon.discountType === "percent"
      ? (eligible * coupon.discountValue) / 100
      : coupon.discountValue;
  return round2(Math.min(Math.max(0, raw), eligible));
}

// ── date helpers (UTC, deterministic — no local-tz drift) ──
function parseUTC(d: string): number {
  return new Date(`${d}T00:00:00Z`).getTime();
}
const DAY_MS = 86_400_000;

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(
    0,
    Math.round((parseUTC(checkOut) - parseUTC(checkIn)) / DAY_MS),
  );
}

/** Each night the guest sleeps over, as 'YYYY-MM-DD' (check-in … check-out-1). */
function eachNight(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  for (let t = parseUTC(checkIn); t < parseUTC(checkOut); t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Pick the one seasonal rule that governs `dateStr` for `unit`, or null.
 * Precedence: room-scoped beats listing-scoped → higher priority → newest.
 */
function pickRule(
  dateStr: string,
  unitRoomId: string | null,
  rules: SeasonalRule[],
): SeasonalRule | null {
  const t = parseUTC(dateStr);
  const candidates = rules.filter((r) => {
    if (!r.isActive) return false;
    if (t < parseUTC(r.startDate) || t > parseUTC(r.endDate)) return false;
    // Scope: a listing-wide rule (roomId null) applies to any unit; a
    // room-scoped rule only to its own room.
    if (r.roomId === null) return true;
    return unitRoomId !== null && r.roomId === unitRoomId;
  });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aRoom = a.roomId !== null ? 1 : 0;
    const bRoom = b.roomId !== null ? 1 : 0;
    if (aRoom !== bRoom) return bRoom - aRoom; // room-scoped first
    if (a.priority !== b.priority) return b.priority - a.priority; // higher first
    const aT = a.createdAt ?? "";
    const bT = b.createdAt ?? "";
    return aT < bT ? 1 : aT > bT ? -1 : 0; // newest first
  });
  return candidates[0];
}

/**
 * Resolve the nightly rate for one night of one unit.
 *
 * Precedence: an active seasonal rule overrides everything for that night
 * (it replaces the weekend rate); otherwise the weekend rate applies on
 * Fri/Sat; otherwise the base rate. Occupancy is then applied per the unit's
 * pricing mode.
 *
 * Seasonal semantics:
 *  - absolute → the rule's value IS the flat room nightly. Extra-guest fees
 *    (per_room_plus_extra) still add on top; per-person scaling is overridden.
 *  - percent  → multiply the BASE occupancy nightly by (1 ± value%), so per-
 *    guest / extra-guest scaling is preserved. Clamped at 0.
 */
export function resolveNightlyRate(
  dateStr: string,
  unit: PricingUnit,
  rules: SeasonalRule[],
  weekendDays: readonly number[] = VILO_WEEKEND_DAYS,
): NightLine {
  const rule = pickRule(dateStr, unit.roomId, rules);

  if (rule) {
    let rate: number;
    if (rule.adjustmentType === "absolute") {
      rate = rule.adjustmentValue;
      if (unit.pricing_mode === "per_room_plus_extra") {
        const extra = Math.max(0, unit.guests - (unit.base_occupancy ?? 1));
        rate += extra * (unit.extra_guest_price ?? 0);
      }
    } else {
      const baseOcc = occupancyNightly(unit, unit.base_price, unit.guests);
      rate = baseOcc * (1 + rule.adjustmentValue / 100);
    }
    return {
      date: dateStr,
      rate: Math.max(0, rate),
      source: "seasonal",
      label: rule.label,
    };
  }

  const dow = new Date(parseUTC(dateStr)).getUTCDay();
  // per_person pricing scales purely by headcount and ignores the weekend rate,
  // so a "weekend night" only counts where it actually changes the price.
  const isWeekend =
    unit.pricing_mode !== "per_person" &&
    weekendDays.includes(dow) &&
    unit.weekend_price != null;
  const slot = isWeekend ? (unit.weekend_price as number) : unit.base_price;
  const rate = occupancyNightly(unit, slot, unit.guests);
  return {
    date: dateStr,
    rate: Math.max(0, rate),
    source: isWeekend ? "weekend" : "base",
    label: isWeekend ? "Weekend" : "Standard",
  };
}

/** Effective minimum nights = max(listing min, overlapping active rule mins). */
export function effectiveMinNights(
  input: Pick<
    PriceStayInput,
    "checkIn" | "checkOut" | "seasonalRules" | "listingMinNights" | "units"
  >,
): number {
  const firstNight = parseUTC(input.checkIn);
  const lastNight = parseUTC(input.checkOut) - DAY_MS;
  const unitRoomIds = new Set(input.units.map((u) => u.roomId));
  let min = Math.max(1, input.listingMinNights || 1);
  for (const r of input.seasonalRules) {
    if (!r.isActive || r.minNights == null) continue;
    if (parseUTC(r.startDate) > lastNight || parseUTC(r.endDate) < firstNight)
      continue;
    const scopeMatches = r.roomId === null || unitRoomIds.has(r.roomId);
    if (!scopeMatches) continue;
    min = Math.max(min, r.minNights);
  }
  return min;
}

/**
 * Price a whole stay end-to-end and return a fully itemised, auditable
 * breakdown. This is the function every consumer calls.
 */
export function priceStay(input: PriceStayInput): PriceBreakdown {
  const weekendDays = input.weekendDays ?? VILO_WEEKEND_DAYS;
  const dates = eachNight(input.checkIn, input.checkOut);
  const nights = dates.length;

  let weekendNights = 0;
  let seasonalNights = 0;

  const units: UnitBreakdown[] = input.units.map((unit) => {
    const lines = dates.map((d) =>
      resolveNightlyRate(d, unit, input.seasonalRules, weekendDays),
    );
    for (const l of lines) {
      if (l.source === "weekend") weekendNights++;
      else if (l.source === "seasonal") seasonalNights++;
    }
    const baseSubtotal = round2(lines.reduce((s, l) => s + l.rate, 0));
    return {
      roomId: unit.roomId,
      nights: lines,
      baseSubtotal,
      cleaningFee: round2(unit.cleaning_fee),
    };
  });

  const baseSubtotal = round2(units.reduce((s, u) => s + u.baseSubtotal, 0));
  const cleaningTotal = round2(units.reduce((s, u) => s + u.cleaningFee, 0));

  const discount = applyStayDiscounts({
    base: baseSubtotal,
    cleaning: cleaningTotal,
    nights,
    isWholeCombo: input.isWholeCombo,
    wholePct: input.wholePct,
    weeklyPct: input.weeklyPct,
    monthlyPct: input.monthlyPct,
  });

  const addons: AddonLine[] = (input.addons ?? []).map((a) => ({
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
        input.totalGuests,
      ),
    ),
  }));
  const addonsTotal = round2(addons.reduce((s, a) => s + a.subtotal, 0));

  const accommodationAfterDiscount = round2(
    baseSubtotal - discount.discountTotal,
  );
  const couponDiscount = couponDiscountFor(input.coupon, {
    accommodationAfterDiscount,
    addons,
    units,
  });

  const total = round2(
    accommodationAfterDiscount + cleaningTotal + addonsTotal - couponDiscount,
  );

  return {
    nights,
    units,
    baseSubtotal,
    weekendNights,
    seasonalNights,
    discount: {
      ...discount,
      wholeSaving: round2(discount.wholeSaving),
      losSaving: round2(discount.losSaving),
      discountTotal: round2(discount.discountTotal),
    },
    cleaningTotal,
    addons,
    addonsTotal,
    couponDiscount,
    couponCode: input.coupon && couponDiscount > 0 ? input.coupon.code : null,
    total,
    currency: input.currency,
    effectiveMinNights: effectiveMinNights(input),
  };
}
