import { describe, expect, it } from "vitest";

import {
  REQUIRED_STANDARD_PAGES,
  mergeStandardPages,
  standardPageTemplates,
} from "./standardPages";
import type { ThemePageTemplate } from "@/lib/site/themes.server";

const REQUIRED_KINDS = REQUIRED_STANDARD_PAGES.map((p) => p.kind);

describe("standardPageTemplates", () => {
  it("includes every required kind, home titled with the site name", () => {
    const pages = standardPageTemplates("Olive Grove");
    expect(pages.map((p) => p.kind).sort()).toEqual([...REQUIRED_KINDS].sort());
    expect(pages.find((p) => p.kind === "home")?.title).toBe("Olive Grove");
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
    expect(merged.map((p) => p.kind).sort()).toEqual(
      [...REQUIRED_KINDS].sort(),
    );
  });

  it("keeps theme pages untouched and appends only the missing required pages", () => {
    // A Safari-like blueprint: has home/about/rooms/contact/blog, MISSING
    // specials/experiences/gallery.
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
    // The three missing required pages were added.
    const added = merged.filter((p) => !themePages.includes(p));
    expect(added.map((p) => p.kind).sort()).toEqual([
      "experiences",
      "gallery",
      "specials",
    ]);
    // Added pages sit after the theme's max nav_order (4), in canonical order.
    for (const a of added) expect(a.nav_order).toBeGreaterThan(4);
    const orders = added.map((p) => p.nav_order);
    expect(orders).toEqual([...orders].sort((x, y) => x - y));
  });

  it("does not duplicate a kind the theme already defines", () => {
    const themePages: ThemePageTemplate[] = [mk("specials", 0)];
    const merged = mergeStandardPages(themePages, "X");
    expect(merged.filter((p) => p.kind === "specials")).toHaveLength(1);
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
