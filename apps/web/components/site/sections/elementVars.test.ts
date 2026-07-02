import { describe, it, expect } from "vitest";

import { elementVarsCss } from "./_shared";

const SEL = `[data-node-id="x"]`;

describe("elementVarsCss", () => {
  it("returns empty string when the node has no element styles", () => {
    expect(elementVarsCss(SEL, {})).toBe("");
    expect(elementVarsCss(SEL, { elements: {} })).toBe("");
  });

  it("emits --el-<key>-* custom properties for base (desktop) styles", () => {
    const css = elementVarsCss(SEL, {
      elements: {
        title: { color: "#fff", fontSize: 22, fontWeight: "bold" },
        card: { bg: "var(--site-surface)", radius: 16 },
      },
    });
    expect(css).toContain(`${SEL}{`);
    expect(css).toContain("--el-title-fg:#fff");
    expect(css).toContain("--el-title-size:22px");
    expect(css).toContain("--el-title-weight:700"); // bold → 700
    expect(css).toContain("--el-card-bg:var(--site-surface)");
    expect(css).toContain("--el-card-radius:16px");
  });

  it("composes a border shorthand only when width or colour is set", () => {
    expect(
      elementVarsCss(SEL, { elements: { card: { borderWidth: 2 } } }),
    ).toContain("--el-card-bd:2px solid var(--site-line)");
    expect(
      elementVarsCss(SEL, { elements: { card: { borderColor: "#abc" } } }),
    ).toContain("--el-card-bd:1px solid #abc");
    // No border props → no border var emitted.
    expect(
      elementVarsCss(SEL, { elements: { card: { radius: 8 } } }),
    ).not.toContain("-bd:");
  });

  it("emits @media (live) AND @container (builder) rules for per-device overrides", () => {
    const css = elementVarsCss(SEL, {
      elements: { title: { fontSize: 24 } },
      responsive: {
        tablet: { elements: { title: { fontSize: 20 } } },
        mobile: { elements: { title: { fontSize: 16 } } },
      },
    });
    expect(css).toContain("@media (max-width:1024px)");
    expect(css).toContain("@media (max-width:640px)");
    expect(css).toContain("@container (max-width:1024px)");
    expect(css).toContain("@container (max-width:640px)");
    // Base value present, device values present.
    expect(css).toContain("--el-title-size:24px");
    expect(css).toContain("--el-title-size:20px");
    expect(css).toContain("--el-title-size:16px");
  });

  it("skips a device rule that has no overrides", () => {
    const css = elementVarsCss(SEL, {
      elements: { title: { fontSize: 24 } },
      responsive: { tablet: { elements: {} } },
    });
    expect(css).not.toContain("@media");
    expect(css).not.toContain("@container");
  });
});
