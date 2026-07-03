import { describe, it, expect } from "vitest";

import { customCssScoped, elementVarsCss } from "./_shared";

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

describe("customCssScoped", () => {
  it("returns empty for blank input", () => {
    expect(customCssScoped(SEL, undefined)).toBe("");
    expect(customCssScoped(SEL, "   ")).toBe("");
  });

  it("replaces the `selector` keyword with the node selector", () => {
    const css = customCssScoped(SEL, "selector { color: red; }");
    expect(css).toContain(SEL);
    expect(css).not.toContain("selector");
  });

  it("scopes a bare `selector { }` rule to the wrapper AND its content", () => {
    const css = customCssScoped(SEL, "selector { color: red; }");
    // wrapper + descendants so it can beat the leaf's inline style
    expect(css).toContain(`${SEL},${SEL} *{`);
  });

  it("keeps a descendant `selector h3 { }` targeting exactly that child", () => {
    const css = customCssScoped(SEL, "selector h3 { color: red; }");
    expect(css).toContain(`${SEL} h3`);
    expect(css).not.toContain(`${SEL} *`);
  });

  it("wraps bare declarations in a selector rule", () => {
    const css = customCssScoped(SEL, "color: red; padding: 4px");
    expect(css.startsWith(`${SEL},${SEL} *{`)).toBe(true);
  });

  it("forces !important so it overrides the element's inline styling", () => {
    const css = customCssScoped(
      SEL,
      "selector { color: red; letter-spacing: 2px; }",
    );
    expect(css).toContain("color: red !important");
    expect(css).toContain("letter-spacing: 2px !important");
  });

  it("does not double up an existing !important", () => {
    const css = customCssScoped(SEL, "selector { color: red !important; }");
    expect(css).toContain("color: red !important");
    expect(css).not.toContain("!important !important");
  });

  it("leaves @media preludes untouched (only declarations get !important)", () => {
    const css = customCssScoped(
      SEL,
      "@media (max-width: 640px) { selector { color: red; } }",
    );
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).not.toContain("max-width: 640px !important");
    expect(css).toContain("color: red !important");
  });

  it("neutralises a </style> breakout attempt", () => {
    const css = customCssScoped(
      SEL,
      "selector {}</style><script>alert(1)</script>",
    );
    expect(css).not.toContain("</style>");
    expect(css).not.toContain("<script");
  });
});
