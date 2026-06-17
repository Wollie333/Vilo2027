import type { createAdminClient } from "@/lib/supabase/admin";

import {
  computeAgeExtras,
  nightsBetween,
  priceStay,
  type AgeExtraLine,
  type PricingUnit,
  type SeasonalRule,
} from "@/lib/pricing";

type AdminClient = ReturnType<typeof createAdminClient>;

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type StayPricing = {
  host_id: string;
  currency: string;
  nights: number;
  base_amount: number;
  cleaning_fee: number;
  total: number;
  rooms: { room_id: string; base_amount: number; cleaning_fee: number }[];
  age_lines: AgeExtraLine[];
  age_total: number;
};

export type StayPricingResult =
  | { ok: true; data: StayPricing }
  | { ok: false; error: string };

/**
 * Canonical accommodation pricing for a quote/enquiry — the SAME engine the
 * guest checkout uses (seasonal + weekend + occupancy + age/pet aware). Pure
 * apart from the admin reads it does. Used by `priceQuoteAction` (host) and
 * `requestQuoteAction` (public enquiry) so an auto-priced enquiry matches what a
 * real booking would charge. Pass `expectedHostId` to assert listing ownership.
 */
export async function computeStayPricing(
  admin: AdminClient,
  input: {
    listing_id: string;
    check_in: string;
    check_out: string;
    scope: "whole_listing" | "rooms";
    guests: number;
    rooms: { room_id: string; guests: number }[];
    party?: { children: number; infants: number; pets: number };
  },
  expectedHostId?: string,
): Promise<StayPricingResult> {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.check_in) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.check_out) ||
    nightsBetween(input.check_in, input.check_out) <= 0
  ) {
    return { ok: false, error: "Pick valid check-in and check-out dates." };
  }

  const { data: listing } = await admin
    .from("properties")
    .select(
      "id, host_id, base_price, weekend_price, cleaning_fee, currency, min_nights, whole_listing_discount_pct, weekly_discount_pct, monthly_discount_pct, child_price, infant_price, pet_fee, allow_children, allow_infants, allow_pets",
    )
    .eq("id", input.listing_id)
    .maybeSingle();
  if (!listing || (expectedHostId && listing.host_id !== expectedHostId)) {
    return { ok: false, error: "Listing not found." };
  }

  let ageRates = {
    childPrice: Number(listing.child_price ?? 0),
    infantPrice: Number(listing.infant_price ?? 0),
    petFee: Number(listing.pet_fee ?? 0),
  };
  let ageAllow = {
    children: listing.allow_children ?? true,
    infants: listing.allow_infants ?? true,
    pets: listing.allow_pets ?? true,
  };

  const nights = nightsBetween(input.check_in, input.check_out);
  let units: PricingUnit[] = [];
  let isWholeCombo = false;

  if (input.scope === "rooms") {
    const roomIds = input.rooms.map((r) => r.room_id);
    if (roomIds.length === 0) {
      return { ok: false, error: "Pick at least one room to price." };
    }
    const { data: roomRows } = await admin
      .from("property_rooms")
      .select(
        "id, base_price, weekend_price, cleaning_fee, pricing_mode, price_per_person, base_occupancy, extra_guest_price, child_price, infant_price, pet_fee, allow_children, allow_infants, allow_pets",
      )
      .eq("listing_id", listing.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .in("id", roomIds);
    if (!roomRows || roomRows.length !== roomIds.length) {
      return { ok: false, error: "One or more rooms are no longer available." };
    }
    ageRates = {
      childPrice: Number(roomRows[0]?.child_price ?? 0),
      infantPrice: Number(roomRows[0]?.infant_price ?? 0),
      petFee: Number(roomRows[0]?.pet_fee ?? 0),
    };
    ageAllow = {
      children: roomRows.every((r) => r.allow_children ?? true),
      infants: roomRows.every((r) => r.allow_infants ?? true),
      pets: roomRows.every((r) => r.allow_pets ?? true),
    };
    const guestsByRoom = new Map(input.rooms.map((r) => [r.room_id, r.guests]));
    units = roomRows.map((r) => ({
      roomId: r.id,
      pricing_mode: (r.pricing_mode ??
        "per_room") as PricingUnit["pricing_mode"],
      base_price: Number(r.base_price),
      price_per_person:
        r.price_per_person == null ? null : Number(r.price_per_person),
      base_occupancy: r.base_occupancy ?? null,
      extra_guest_price:
        r.extra_guest_price == null ? null : Number(r.extra_guest_price),
      weekend_price: r.weekend_price == null ? null : Number(r.weekend_price),
      cleaning_fee: Number(r.cleaning_fee ?? 0),
      guests: Math.max(1, guestsByRoom.get(r.id) ?? 1),
    }));
    const { count: activeRoomCount } = await admin
      .from("property_rooms")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id)
      .is("deleted_at", null)
      .eq("is_active", true);
    isWholeCombo =
      activeRoomCount != null &&
      activeRoomCount > 1 &&
      roomRows.length === activeRoomCount;
  } else {
    if (listing.base_price == null) {
      return { ok: false, error: "This listing has no nightly price set yet." };
    }
    units = [
      {
        roomId: null,
        pricing_mode: "per_room",
        base_price: Number(listing.base_price),
        price_per_person: null,
        base_occupancy: null,
        extra_guest_price: null,
        weekend_price:
          listing.weekend_price == null ? null : Number(listing.weekend_price),
        cleaning_fee: Number(listing.cleaning_fee ?? 0),
        guests: Math.max(1, input.guests),
      },
    ];
  }

  const { data: seasonalRows } = await admin
    .from("property_seasonal_pricing")
    .select(
      "room_id, start_date, end_date, adjustment_type, adjustment_value, label, priority, min_nights, is_active, created_at",
    )
    .eq("listing_id", listing.id)
    .eq("is_active", true)
    .lte("start_date", input.check_out)
    .gte("end_date", input.check_in);

  const seasonalRules: SeasonalRule[] = (seasonalRows ?? []).map((s) => ({
    roomId: s.room_id,
    startDate: s.start_date,
    endDate: s.end_date,
    adjustmentType: s.adjustment_type === "percent" ? "percent" : "absolute",
    adjustmentValue: Number(s.adjustment_value),
    label: s.label,
    priority: s.priority ?? 0,
    minNights: s.min_nights ?? null,
    isActive: s.is_active,
    createdAt: s.created_at,
  }));

  const breakdown = priceStay({
    checkIn: input.check_in,
    checkOut: input.check_out,
    units,
    seasonalRules,
    currency: listing.currency ?? "ZAR",
    totalGuests: Math.max(1, input.guests),
    listingMinNights: listing.min_nights ?? 1,
    isWholeCombo,
    wholePct: numOrNull(listing.whole_listing_discount_pct),
    weeklyPct: numOrNull(listing.weekly_discount_pct),
    monthlyPct: numOrNull(listing.monthly_discount_pct),
  });

  const { lines: ageLines, total: ageTotal } = computeAgeExtras(
    {
      adults: 0,
      children: ageAllow.children ? (input.party?.children ?? 0) : 0,
      infants: ageAllow.infants ? (input.party?.infants ?? 0) : 0,
      pets: ageAllow.pets ? (input.party?.pets ?? 0) : 0,
    },
    ageRates,
    nights,
  );

  return {
    ok: true,
    data: {
      host_id: listing.host_id as string,
      currency: breakdown.currency,
      nights,
      base_amount: breakdown.baseSubtotal - breakdown.discount.discountTotal,
      cleaning_fee: breakdown.cleaningTotal,
      total:
        breakdown.baseSubtotal -
        breakdown.discount.discountTotal +
        breakdown.cleaningTotal,
      rooms: breakdown.units
        .filter((u) => u.roomId !== null)
        .map((u) => ({
          room_id: u.roomId as string,
          base_amount: u.baseSubtotal,
          cleaning_fee: u.cleaningFee,
        })),
      age_lines: ageLines,
      age_total: ageTotal,
    },
  };
}
