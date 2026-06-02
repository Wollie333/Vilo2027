// Age-based + pet pricing — flat per-night amounts the host sets per room (or
// per listing for whole-listing stays). These layer ON TOP of the core
// priceStay() engine as line items, so the engine stays untouched. Pure +
// unit-tested so the same maths runs on checkout, quotes and invoices.

export type GuestParty = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export type AgeRates = {
  /** Flat charge per child, per night. */
  childPrice: number;
  /** Flat charge per infant, per night (usually 0). */
  infantPrice: number;
  /** Flat pet fee per night, applied once when pets > 0. */
  petFee: number;
};

export type AgeExtraLine = {
  kind: "child" | "infant" | "pet";
  label: string;
  /** quantity × unitPrice === subtotal (so it renders like any other line). */
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build the age/pet line items for a stay. Children/infants are charged per
 * head per night; the pet fee is a single flat per-night charge when any pets
 * are present. Zero-rate or zero-count lines are omitted.
 */
export function computeAgeExtras(
  party: GuestParty,
  rates: AgeRates,
  nights: number,
): { lines: AgeExtraLine[]; total: number } {
  const lines: AgeExtraLine[] = [];
  const n = Math.max(0, Math.floor(nights));
  if (n === 0) return { lines, total: 0 };

  const children = Math.max(0, Math.floor(party.children));
  const infants = Math.max(0, Math.floor(party.infants));
  const pets = Math.max(0, Math.floor(party.pets));

  if (children > 0 && rates.childPrice > 0) {
    const unit = r2(rates.childPrice * n); // per child, across the stay
    lines.push({
      kind: "child",
      label: `Children (${children} × ${rates.childPrice}/night × ${n} night${n === 1 ? "" : "s"})`,
      quantity: children,
      unitPrice: unit,
      subtotal: r2(children * unit),
    });
  }

  if (infants > 0 && rates.infantPrice > 0) {
    const unit = r2(rates.infantPrice * n);
    lines.push({
      kind: "infant",
      label: `Infants (${infants} × ${rates.infantPrice}/night × ${n} night${n === 1 ? "" : "s"})`,
      quantity: infants,
      unitPrice: unit,
      subtotal: r2(infants * unit),
    });
  }

  // Flat per-night pet fee, once per booking when pets are present.
  if (pets > 0 && rates.petFee > 0) {
    lines.push({
      kind: "pet",
      label: `Pet fee (${rates.petFee}/night × ${n} night${n === 1 ? "" : "s"})`,
      quantity: 1,
      unitPrice: r2(rates.petFee * n),
      subtotal: r2(rates.petFee * n),
    });
  }

  const total = r2(lines.reduce((s, l) => s + l.subtotal, 0));
  return { lines, total };
}
