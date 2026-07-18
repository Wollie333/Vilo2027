import { describe, expect, it } from "vitest";

import { sanitizeCssValue } from "./cssValue";

describe("sanitizeCssValue", () => {
  it("keeps legitimate colour / gradient / url values", () => {
    expect(sanitizeCssValue("#10B981")).toBe("#10B981");
    expect(sanitizeCssValue("rgba(16,185,129,0.5)")).toBe(
      "rgba(16,185,129,0.5)",
    );
    expect(sanitizeCssValue("linear-gradient(90deg, #000, #fff)")).toBe(
      "linear-gradient(90deg, #000, #fff)",
    );
    expect(sanitizeCssValue("https://cdn.test/bg.jpg")).toBe(
      "https://cdn.test/bg.jpg",
    );
  });

  it("neutralises a <style> breakout payload", () => {
    // The exact stored-XSS vector: a value that closes the <style> element and
    // injects a script when interpolated into a `<style dangerouslySetInnerHTML>`.
    const payload = "x}</style><script>alert(document.cookie)</script>";
    const out = sanitizeCssValue(payload);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("}");
    expect(out).not.toContain(";");
    expect(out).not.toContain("</style");
    expect(out).not.toContain("<script");
  });

  it("strips declaration/rule terminators and quotes", () => {
    const out = sanitizeCssValue(`red; background:url("evil")`);
    expect(out).not.toContain(";");
    expect(out).not.toContain('"');
    expect(out).not.toContain("'");
  });

  it("caps length as a backstop", () => {
    expect(sanitizeCssValue("a".repeat(1000)).length).toBe(400);
  });
});
