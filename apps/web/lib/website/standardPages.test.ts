import { describe, expect, it } from "vitest";

import {
  REQUIRED_STANDARD_PAGES,
  SYSTEM_STANDARD_PAGES,
  mergeStandardPages,
  selectWizardPages,
  standardPageTemplates,
  type WizardPageSel,
} from "./standardPages";
import type { ThemePageTemplate } from "@/lib/site/themes.server";

const REQUIRED_KINDS = REQUIRED_STANDARD_PAGES.map((p) => p.kind);
const SYSTEM_KINDS = SYSTEM_STANDARD_PAGES.map((p) => p.kind);
const ALL_KINDS = [...REQUIRED_KINDS, ...SYSTEM_KINDS];

describe("standardPageTemplates", () => {
  it("includes every required + system kind, home titled with the site name", () => {
    const pages = standardPageTemplates("Olive Grove");
    expect(pages.map((p) => p.kind).sort()).toEqual([...ALL_KINDS].sort());
    expect(pages.find((p) => p.kind === "home")?.title).toBe("Olive Grove");
    // System pages are never shown in the nav.
    for (const k of SYSTEM_KINDS) {
      expect(pages.find((p) => p.kind === k)?.show_in_nav).toBe(false);
    }
    // Blog is optional — never auto-seeded.
    expect(pages.some((p) => p.kind === "blog")).toBe(false);
  });

  it("gives each page at least one section", () => {
    for (const p of standardPageTemplates("X")) {
      expect(p.sections.length).toBeGreaterThan(0);
    }
  });
});

describe("mergeStandardPages", () => {
  it("returns the full standard set for an empty blueprint", () => {
    const merged = mergeStandardPages([], "My Lodge");
    expect(merged.map((p) => p.kind).sort()).toEqual([...ALL_KINDS].sort());
  });

  it("keeps theme pages untouched and appends the missing required + system pages", () => {
    // A Safari-like blueprint: has home/about/rooms/contact/blog, MISSING
    // specials/experiences/gallery (nav) + search_results (system).
    const themePages: ThemePageTemplate[] = [
      mk("home", 0),
      mk("about", 1),
      mk("rooms", 2),
      mk("contact", 3),
      mk("blog", 4),
    ];
    const merged = mergeStandardPages(themePages, "Bush Camp");

    // Original five are returned by-reference (unchanged).
    for (const original of themePages) {
      expect(merged).toContain(original);
    }
    // The missing required marketing pages + the system pages (search_results +
    // the checkout/thank-you booking system pages).
    const added = merged.filter((p) => !themePages.includes(p));
    expect(added.map((p) => p.kind).sort()).toEqual([
      "checkout",
      "experiences",
      "gallery",
      "search_results",
      "specials",
      "thank-you",
    ]);
    // System pages are never in the nav; the marketing ones are.
    const systemKinds = new Set(["search_results", "checkout", "thank-you"]);
    for (const sys of added.filter((p) => systemKinds.has(p.kind))) {
      expect(sys.show_in_nav).toBe(false);
    }
    for (const a of added.filter((p) => !systemKinds.has(p.kind))) {
      expect(a.show_in_nav).toBe(true);
      expect(a.nav_order).toBeGreaterThan(4);
    }
  });

  it("does not duplicate a kind the theme already defines", () => {
    const themePages: ThemePageTemplate[] = [mk("specials", 0)];
    const merged = mergeStandardPages(themePages, "X");
    expect(merged.filter((p) => p.kind === "specials")).toHaveLength(1);
  });
});

describe("selectWizardPages", () => {
  // The wizard's default 6-page selection, all included, in guide order.
  const allOn: WizardPageSel[] = [
    { kind: "home", include: true },
    { kind: "about", include: true },
    { kind: "rooms", include: true },
    { kind: "specials", include: true },
    { kind: "blog", include: true },
    { kind: "contact", include: true },
  ];

  it("restricts to the 6 guide pages + system pages, dropping experiences/gallery", () => {
    const merged = mergeStandardPages([], "Olive Grove"); // full standard set
    const out = selectWizardPages(merged, allOn, "Olive Grove");
    const kinds = out.map((p) => p.kind);
    // No experiences/gallery.
    expect(kinds).not.toContain("experiences");
    expect(kinds).not.toContain("gallery");
    // All six guide kinds present (blog synthesised — the standard set has none).
    for (const k of ["home", "about", "rooms", "specials", "blog", "contact"]) {
      expect(kinds).toContain(k);
    }
    // System pages kept, never in nav.
    for (const k of ["search_results", "checkout", "thank-you"]) {
      const sys = out.find((p) => p.kind === k);
      expect(sys?.show_in_nav).toBe(false);
    }
  });

  it("applies the host's order and inclusion to nav_order/show_in_nav", () => {
    const merged = mergeStandardPages([], "X");
    // Contact moved to 2nd; specials toggled off.
    const sel: WizardPageSel[] = [
      { kind: "home", include: true },
      { kind: "contact", include: true },
      { kind: "about", include: true },
      { kind: "rooms", include: true },
      { kind: "specials", include: false },
      { kind: "blog", include: true },
    ];
    const out = selectWizardPages(merged, sel, "X");
    const nav = out
      .filter((p) => p.show_in_nav)
      .sort((a, b) => a.nav_order - b.nav_order)
      .map((p) => p.kind);
    expect(nav).toEqual(["home", "contact", "about", "rooms", "blog"]);
    // Specials is still seeded, just hidden from nav (recoverable later).
    expect(out.find((p) => p.kind === "specials")?.show_in_nav).toBe(false);
  });

  it("uses the theme's own blog page when present instead of synthesising one", () => {
    const themeBlog = mk("blog", 4);
    themeBlog.nav_label = "Stories";
    const merged = mergeStandardPages([mk("home", 0), themeBlog], "X");
    const out = selectWizardPages(merged, allOn, "X");
    const blog = out.find((p) => p.kind === "blog");
    expect(blog?.nav_label).toBe("Stories");
  });

  it("titles the home page with the site name", () => {
    const out = selectWizardPages(
      mergeStandardPages([], "Karoo Sky"),
      allOn,
      "Karoo Sky",
    );
    expect(out.find((p) => p.kind === "home")?.title).toBe("Karoo Sky");
  });
});

function mk(kind: string, nav_order: number): ThemePageTemplate {
  return {
    kind,
    slug: kind,
    title: kind,
    nav_label: kind,
    nav_order,
    show_in_nav: true,
    sections: [{ id: "x", type: "intro", enabled: true }],
  };
}
