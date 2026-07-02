import { describe, it, expect } from "vitest";

import { evaluateReadiness, type ReadinessInput } from "./readiness";

const ready: ReadinessInput = {
  name: "Olive Grove Guesthouse",
  hasBookableRoom: true,
  hasPaymentMethod: true,
  subdomain: "olive-grove",
  hasPolicy: true,
};

describe("evaluateReadiness", () => {
  it("is ready when every requirement is met", () => {
    const r = evaluateReadiness(ready);
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("flags a missing name (blank/whitespace/nullish)", () => {
    for (const name of ["", "   ", null, undefined]) {
      const r = evaluateReadiness({ ...ready, name });
      expect(r.ready).toBe(false);
      expect(r.missing.map((m) => m.key)).toEqual(["name"]);
    }
  });

  it("flags each requirement independently", () => {
    expect(
      evaluateReadiness({ ...ready, hasBookableRoom: false }).missing.map(
        (m) => m.key,
      ),
    ).toEqual(["room"]);
    expect(
      evaluateReadiness({ ...ready, hasPaymentMethod: false }).missing.map(
        (m) => m.key,
      ),
    ).toEqual(["payment"]);
    expect(
      evaluateReadiness({ ...ready, subdomain: "" }).missing.map((m) => m.key),
    ).toEqual(["subdomain"]);
    expect(
      evaluateReadiness({ ...ready, hasPolicy: false }).missing.map(
        (m) => m.key,
      ),
    ).toEqual(["policy"]);
  });

  it("reports all missing in stable order when nothing is set", () => {
    const r = evaluateReadiness({
      name: null,
      hasBookableRoom: false,
      hasPaymentMethod: false,
      subdomain: null,
      hasPolicy: false,
    });
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => m.key)).toEqual([
      "name",
      "room",
      "payment",
      "subdomain",
      "policy",
    ]);
  });

  it("gives every missing item a fix link and a label", () => {
    const r = evaluateReadiness({
      name: null,
      hasBookableRoom: false,
      hasPaymentMethod: false,
      subdomain: null,
      hasPolicy: false,
    });
    for (const m of r.missing) {
      expect(m.fixHref.startsWith("/dashboard/")).toBe(true);
      expect(m.label.length).toBeGreaterThan(0);
    }
  });
});
