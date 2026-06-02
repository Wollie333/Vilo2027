import { describe, expect, it } from "vitest";

import { computeAgeExtras } from "./extras";

const party = (
  p: Partial<{
    adults: number;
    children: number;
    infants: number;
    pets: number;
  }>,
) => ({
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
  ...p,
});

describe("computeAgeExtras", () => {
  it("charges children per head per night", () => {
    const { lines, total } = computeAgeExtras(
      party({ children: 1 }),
      { childPrice: 200, infantPrice: 0, petFee: 0 },
      3,
    );
    expect(total).toBe(600);
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe("child");
    expect(lines[0].quantity * lines[0].unitPrice).toBe(lines[0].subtotal);
  });

  it("applies the pet fee once per booking, per night", () => {
    const { lines, total } = computeAgeExtras(
      party({ pets: 2 }),
      { childPrice: 0, infantPrice: 0, petFee: 150 },
      3,
    );
    // Flat per-night, once regardless of pet count.
    expect(total).toBe(450);
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe("pet");
  });

  it("combines children + pets (the worked example)", () => {
    const { total } = computeAgeExtras(
      party({ adults: 2, children: 1, pets: 1 }),
      { childPrice: 200, infantPrice: 0, petFee: 150 },
      3,
    );
    expect(total).toBe(600 + 450);
  });

  it("infants are free by default (rate 0 → no line)", () => {
    const { lines, total } = computeAgeExtras(
      party({ infants: 2 }),
      { childPrice: 200, infantPrice: 0, petFee: 0 },
      3,
    );
    expect(total).toBe(0);
    expect(lines).toHaveLength(0);
  });

  it("charges infants when a rate is set", () => {
    const { total } = computeAgeExtras(
      party({ infants: 1 }),
      { childPrice: 0, infantPrice: 50, petFee: 0 },
      2,
    );
    expect(total).toBe(100);
  });

  it("zero nights → no charges", () => {
    const { total } = computeAgeExtras(
      party({ children: 3, pets: 1 }),
      { childPrice: 200, infantPrice: 0, petFee: 150 },
      0,
    );
    expect(total).toBe(0);
  });
});
