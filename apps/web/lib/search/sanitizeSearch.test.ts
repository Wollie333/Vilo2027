import { describe, expect, it } from "vitest";

import { sanitizeSearch } from "./sanitizeSearch";

describe("sanitizeSearch", () => {
  it("keeps ordinary search words untouched", () => {
    expect(sanitizeSearch("Cape Town lodge")).toBe("Cape Town lodge");
  });

  it("strips PostgREST .or() filter metacharacters (, ( ))", () => {
    // A term that would otherwise inject an extra OR-condition into the filter
    // grammar `col.ilike.value,injected.eq.x`.
    const out = sanitizeSearch("x,role.eq.admin");
    expect(out).not.toContain(",");
    expect(out).not.toContain("(");
    expect(out).not.toContain(")");
  });

  it("strips LIKE wildcards and the escape char", () => {
    const out = sanitizeSearch("100%_off\\");
    expect(out).not.toContain("%");
    expect(out).not.toContain("_");
    expect(out).not.toContain("\\");
  });

  it("collapses whitespace and caps length", () => {
    expect(sanitizeSearch("  a    b  ")).toBe("a b");
    expect(sanitizeSearch("z".repeat(200)).length).toBe(80);
  });

  it("can be neutralised entirely to empty for a pure-payload term", () => {
    expect(sanitizeSearch("(),%_")).toBe("");
  });
});
