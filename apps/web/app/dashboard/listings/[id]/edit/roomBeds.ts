import { z } from "zod";

// Single source of truth for bed kinds, their default sleeping capacity, and
// the derived room capacity. A plain (non-"use client") module so both server
// actions and client forms import the SAME values — capacity is computed from
// beds, never hand-typed.

export const BED_KINDS = [
  { value: "king" as const, label: "King", capacity: 2 },
  { value: "queen" as const, label: "Queen", capacity: 2 },
  { value: "double" as const, label: "Double", capacity: 2 },
  { value: "twin" as const, label: "Twin", capacity: 2 },
  { value: "single" as const, label: "Single", capacity: 1 },
  { value: "bunk" as const, label: "Bunk", capacity: 2 },
  { value: "futon" as const, label: "Futon", capacity: 2 },
  { value: "sofa_bed" as const, label: "Sofa bed", capacity: 1 },
  { value: "cot" as const, label: "Cot", capacity: 1 },
  { value: "floor_mattress" as const, label: "Floor mattress", capacity: 1 },
];

export const bedKindSchema = z.enum([
  "king",
  "queen",
  "double",
  "twin",
  "single",
  "bunk",
  "futon",
  "sofa_bed",
  "cot",
  "floor_mattress",
]);
export type BedKind = z.infer<typeof bedKindSchema>;

/** Default sleeping capacity per bed kind. */
export const BED_CAPACITY = Object.fromEntries(
  BED_KINDS.map((b) => [b.value, b.capacity]),
) as Record<BedKind, number>;

export const bedInputSchema = z.object({
  bed_kind: bedKindSchema,
  quantity: z.number().int().min(1).max(20),
});
export type BedInput = z.infer<typeof bedInputSchema>;

/** Room sleeping capacity, strictly derived from its beds. */
export function roomCapacityFromBeds(
  beds: { bed_kind: string; quantity: number }[],
): number {
  return beds.reduce(
    (sum, b) =>
      sum + (BED_CAPACITY[b.bed_kind as BedKind] ?? 0) * (b.quantity || 0),
    0,
  );
}

/** Pluralise a bed-kind label for the derived bed_type summary string. */
export function bedKindLabel(kind: BedKind, qty: number): string {
  const base = BED_KINDS.find((b) => b.value === kind)?.label ?? kind;
  if (qty <= 1) return base;
  if (base.endsWith("ress")) return `${base}es`;
  if (base.endsWith("s")) return base;
  return `${base}s`;
}
