// Per-night occupancy maths — the rate a room charges for one night given a
// guest count and its pricing mode. Pure, non-client module so SERVER actions,
// client cart widgets, and the pricing engine all share ONE implementation.
//
// Moved here from app/listing/[slug]/roomDisplay.ts so there is a single home
// for the money maths; roomDisplay.ts re-exports these for existing callers.

export type RoomPricingMode = "per_room" | "per_person" | "per_room_plus_extra";

export type RoomPricing = {
  pricing_mode: RoomPricingMode;
  base_price: number;
  price_per_person: number | null;
  base_occupancy: number | null;
  extra_guest_price: number | null;
};

/**
 * A room's nightly rate for `guests` people, given an explicit `rateSlot` to use
 * as the per-room base. The seasonal/weekend layer decides which rate fills that
 * slot (base price, weekend price, or an absolute seasonal price); occupancy is
 * applied on top here.
 *
 * - per_room            → the slot, flat.
 * - per_room_plus_extra → the slot + each guest over base_occupancy.
 * - per_person          → price_per_person × guests (the slot is ignored — a
 *                         per-person room scales purely by headcount).
 */
export function occupancyNightly(
  r: RoomPricing,
  rateSlot: number,
  guests: number,
): number {
  const g = Math.max(1, guests);
  switch (r.pricing_mode) {
    case "per_person":
      return (r.price_per_person ?? 0) * g;
    case "per_room_plus_extra": {
      const covered = r.base_occupancy ?? 1;
      const extra = Math.max(0, g - covered);
      return rateSlot + extra * (r.extra_guest_price ?? 0);
    }
    case "per_room":
    default:
      return rateSlot;
  }
}

/** A room's nightly base for a given guest count (uses its base_price slot). */
export function roomNightlyBase(r: RoomPricing, guests: number): number {
  return occupancyNightly(r, r.base_price, guests);
}

/** The headline "from" nightly figure (one-guest baseline) used on cards. */
export function roomFromNightly(r: RoomPricing): number {
  return r.pricing_mode === "per_person"
    ? (r.price_per_person ?? 0)
    : r.base_price;
}
