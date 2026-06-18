import "server-only";

import {
  defaultAddonQuantity,
  type PricingModel,
} from "@/app/[locale]/dashboard/addons/schemas";
import {
  priceSpecialWithSavings,
  type SpecialSavings,
} from "@/lib/specials/pricing";
import type { PricingUnit, SeasonalRule, StayAddon } from "@/lib/pricing";
import { createServerClient } from "@/lib/supabase/server";

import type { SpecialInput } from "../schemas";

// Computes the savings badge (was_price / savings_amount / savings_pct) stored on
// the special row at create/edit time. Best-effort: any missing data returns
// nulls so the save never fails on it (the badge is just hidden). Owner scoping
// is already done by the caller's validateTargets; reads here are by id.

const NO_SAVINGS: SpecialSavings = {
  wasPrice: null,
  savingsAmount: null,
  savingsPct: null,
};

const DAY_MS = 86_400_000;

function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

// The representative stay the badge is priced against. Fixed specials compute
// over their exact dates; flexible specials use a min_nights stay from the
// window start (labelled "from" on the surfaces). Null when dates are incomplete.
function shadowDates(
  v: SpecialInput,
): { checkIn: string; checkOut: string } | null {
  if (v.date_mode === "fixed") {
    if (!v.fixed_check_in || !v.fixed_check_out) return null;
    return { checkIn: v.fixed_check_in, checkOut: v.fixed_check_out };
  }
  if (!v.window_start || !v.min_nights) return null;
  return {
    checkIn: v.window_start,
    checkOut: addDays(v.window_start, v.min_nights),
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type SupabaseClient = ReturnType<typeof createServerClient>;

// Build the priceable unit (room or whole-property) with the special's guest cap.
async function loadUnit(
  supabase: SupabaseClient,
  v: SpecialInput,
): Promise<PricingUnit | null> {
  if (v.room_id) {
    const { data: r } = await supabase
      .from("property_rooms")
      .select(
        "base_price, weekend_price, cleaning_fee, max_guests, pricing_mode, price_per_person, base_occupancy, extra_guest_price",
      )
      .eq("id", v.room_id)
      .maybeSingle();
    if (!r || r.base_price == null) return null;
    return {
      roomId: v.room_id,
      pricing_mode: (r.pricing_mode ??
        "per_room") as PricingUnit["pricing_mode"],
      base_price: num(r.base_price),
      price_per_person: numOrNull(r.price_per_person),
      base_occupancy: r.base_occupancy ?? null,
      extra_guest_price: numOrNull(r.extra_guest_price),
      weekend_price: numOrNull(r.weekend_price),
      cleaning_fee: num(r.cleaning_fee),
      guests: v.max_guests ?? r.max_guests ?? r.base_occupancy ?? 1,
    };
  }
  const { data: p } = await supabase
    .from("properties")
    .select("base_price, weekend_price, cleaning_fee, max_guests")
    .eq("id", v.property_id)
    .maybeSingle();
  if (!p || p.base_price == null) return null;
  return {
    roomId: null,
    pricing_mode: "per_room",
    base_price: num(p.base_price),
    price_per_person: null,
    base_occupancy: null,
    extra_guest_price: null,
    weekend_price: numOrNull(p.weekend_price),
    cleaning_fee: num(p.cleaning_fee),
    guests: v.max_guests ?? p.max_guests ?? 1,
  };
}

// Real seasonal rules overlapping the shadow stay — used ONLY for the was-price
// shadow, never for the special's own price.
async function loadSeasonalRules(
  supabase: SupabaseClient,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<SeasonalRule[]> {
  const { data } = await supabase
    .from("property_seasonal_pricing")
    .select(
      "room_id, start_date, end_date, adjustment_type, adjustment_value, label, priority, min_nights, is_active, created_at",
    )
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .lte("start_date", checkOut)
    .gte("end_date", checkIn);
  return (data ?? []).map((s) => ({
    roomId: s.room_id,
    startDate: s.start_date,
    endDate: s.end_date,
    adjustmentType: s.adjustment_type === "percent" ? "percent" : "absolute",
    adjustmentValue: num(s.adjustment_value),
    label: s.label,
    priority: s.priority ?? 0,
    minNights: s.min_nights ?? null,
    isActive: s.is_active,
    createdAt: s.created_at,
  }));
}

// Compulsory add-ons folded into BOTH the special and the shadow. Quantities use
// the same default the booking action applies (per-night models span the stay).
async function loadRequiredAddons(
  supabase: SupabaseClient,
  v: SpecialInput,
  nights: number,
  guests: number,
): Promise<StayAddon[]> {
  const required = v.addons.filter((a) => a.is_required);
  if (required.length === 0) return [];
  const { data } = await supabase
    .from("addons")
    .select("id, name, pricing_model, unit_price, min_quantity")
    .in(
      "id",
      required.map((a) => a.addon_id),
    );
  const byId = new Map((data ?? []).map((a) => [a.id, a]));
  const lines: StayAddon[] = [];
  for (const a of required) {
    const cat = byId.get(a.addon_id);
    if (!cat) continue;
    const model = cat.pricing_model as PricingModel;
    const unitPrice =
      a.unit_price_override == null
        ? num(cat.unit_price)
        : a.unit_price_override;
    lines.push({
      label: cat.name,
      pricingModel: model,
      unitPrice,
      quantity: defaultAddonQuantity(model, cat.min_quantity ?? 1, nights),
      addonId: a.addon_id,
    });
  }
  void guests;
  return lines;
}

/**
 * Compute the savings badge for a special at save time. Returns nulls (badge
 * hidden) whenever the inputs are incomplete or there is no genuine saving.
 */
export async function computeSpecialSavings(
  v: SpecialInput,
  currency: string,
): Promise<SpecialSavings> {
  const dates = shadowDates(v);
  if (!dates) return NO_SAVINGS;

  const supabase = createServerClient();
  const unit = await loadUnit(supabase, v);
  if (!unit) return NO_SAVINGS;

  const nights = Math.max(
    1,
    Math.round(
      (new Date(`${dates.checkOut}T00:00:00Z`).getTime() -
        new Date(`${dates.checkIn}T00:00:00Z`).getTime()) /
        DAY_MS,
    ),
  );

  const [seasonalRules, requiredAddons] = await Promise.all([
    loadSeasonalRules(supabase, v.property_id, dates.checkIn, dates.checkOut),
    loadRequiredAddons(supabase, v, nights, unit.guests),
  ]);

  const { savings } = priceSpecialWithSavings({
    priceMode: v.price_mode,
    flatTotal: v.flat_total,
    perNightPrice: v.per_night_price,
    currency,
    checkIn: dates.checkIn,
    checkOut: dates.checkOut,
    unit,
    totalGuests: unit.guests,
    seasonalRules,
    requiredAddons,
  });
  return savings;
}
