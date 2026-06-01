// Pure room display helpers + the public room shape. Kept in a NON-client
// module so SERVER components (e.g. RoomsInfoGrid) can import the functions.
// Importing them from the "use client" RoomsGrid turns them into client
// references that throw "roomFlagPills is not a function" at render.
//
// The pure pricing maths (RoomPricing, roomNightlyBase, …) live in the
// canonical engine at @/lib/pricing; re-exported here for existing callers.

import {
  roomFromNightly,
  roomNightlyBase,
  type RoomPricing,
  type RoomPricingMode,
} from "@/lib/pricing/occupancy";

export {
  roomFromNightly,
  roomNightlyBase,
  type RoomPricing,
  type RoomPricingMode,
};

export type PublicRoom = {
  id: string;
  name: string;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number;
  base_price: number;
  cleaning_fee: number;
  photoUrl: string | null;
  // Pricing model — migration 20260530000001.
  pricing_mode: RoomPricingMode;
  price_per_person: number | null;
  base_occupancy: number | null;
  extra_guest_price: number | null;
  // Enterprise fields — present after migration 20260524000007.
  room_size_sqm: number | null;
  view_type: string | null;
  has_ensuite_bathroom: boolean;
  pets_allowed: boolean;
  wheelchair_accessible: boolean;
  private_entrance: boolean;
  smoking_allowed: boolean;
  floor_number: number | null;
  inventory_count: number;
  beds: { bed_kind: string; quantity: number }[];
};

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

/** Card price label, e.g. "R900 / night", "R300 / person / night", "from R900 / night". */
export function roomPriceLabel(
  r: RoomPricing,
  currency: string,
): { amount: string; suffix: string } {
  switch (r.pricing_mode) {
    case "per_person":
      return {
        amount: fmtR(r.price_per_person ?? 0, currency),
        suffix: "/ person / night",
      };
    case "per_room_plus_extra":
      return { amount: fmtR(r.base_price, currency), suffix: "/ night base" };
    case "per_room":
    default:
      return { amount: fmtR(r.base_price, currency), suffix: "/ night" };
  }
}

const BED_LABEL: Record<string, string> = {
  king: "King",
  queen: "Queen",
  double: "Double",
  twin: "Twin",
  single: "Single",
  bunk: "Bunk",
  futon: "Futon",
  sofa_bed: "Sofa bed",
  cot: "Cot",
  floor_mattress: "Floor mattress",
};

export function bedSummary(beds: PublicRoom["beds"]): string {
  if (!beds || beds.length === 0) return "";
  return beds
    .map((b) => {
      const base = BED_LABEL[b.bed_kind] ?? b.bed_kind;
      if (b.quantity <= 1) return base;
      const plural = base.endsWith("ress")
        ? `${base}es`
        : base.endsWith("s")
          ? base
          : `${base}s`;
      return `${b.quantity} ${plural}`;
    })
    .join(" · ");
}

export function roomFlagPills(room: PublicRoom): string[] {
  const pills: string[] = [];
  if (room.has_ensuite_bathroom) pills.push("Ensuite bath");
  if (room.wheelchair_accessible) pills.push("Wheelchair access");
  if (room.pets_allowed) pills.push("Pets ok");
  if (room.private_entrance) pills.push("Private entrance");
  if (room.smoking_allowed) pills.push("Smoking allowed");
  if (room.floor_number != null) pills.push(`Floor ${room.floor_number}`);
  if (room.inventory_count > 1) pills.push("Multiple available");
  return pills;
}
