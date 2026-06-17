import { describe, expect, it } from "vitest";

import { deriveSubdomain, validateSubdomain } from "./subdomain";

describe("deriveSubdomain", () => {
  it("slugifies a business name to a DNS-safe label", () => {
    expect(deriveSubdomain("Stillwater Cottage")).toBe("stillwater-cottage");
    expect(deriveSubdomain("  The Loft & Co.  ")).toBe("the-loft-co");
    expect(deriveSubdomain("Café Brûlé")).toBe("cafe-brule");
    expect(deriveSubdomain("A---B")).toBe("a-b");
  });

  it("returns empty when nothing usable / too short", () => {
    expect(deriveSubdomain("!!")).toBe("");
    expect(deriveSubdomain("ab")).toBe("");
  });
});

describe("validateSubdomain", () => {
  it("accepts valid labels", () => {
    expect(validateSubdomain("stillwater")).toBeNull();
    expect(validateSubdomain("my-place-2")).toBeNull();
  });

  it("rejects bad input with stable error codes", () => {
    expect(validateSubdomain("ab")).toBe("too_short");
    expect(validateSubdomain("a".repeat(64))).toBe("too_long");
    expect(validateSubdomain("-bad")).toBe("invalid_chars");
    expect(validateSubdomain("bad-")).toBe("invalid_chars");
    expect(validateSubdomain("UP_per")).toBe("invalid_chars");
  });

  it("rejects reserved labels (shared with the middleware)", () => {
    expect(validateSubdomain("app")).toBe("reserved");
    expect(validateSubdomain("admin")).toBe("reserved");
    expect(validateSubdomain("blog")).toBe("reserved");
    // 2-char locale codes (en/af/…) are caught by the length rule first.
    expect(validateSubdomain("en")).toBe("too_short");
  });
});
