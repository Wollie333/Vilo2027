import { describe, it, expect } from "vitest";

import { pageDocSchema, isPageDoc, parsePageDocLoose } from "./pageDoc.schema";
import { flatSectionsToPageDoc, sectionToPageDocSection } from "./blueprints";
import { getThemeBlueprints, getThemeTemplatePageDoc } from "./themeSections";
import { newSection } from "./sectionDefaults";
import type { WebsiteSection } from "./sections.schema";

const THEMES = ["safari", "sabela", "oceansview", "marmalade"] as const;

// A designed section like the theme templates build: a composite with tone +
// variant carried in props.
function hero(): WebsiteSection {
  const s = newSection("hero") as Extract<WebsiteSection, { type: "hero" }>;
  s.id = "sec-hero";
  s.tone = "dark";
  s.props.variant = "fullscreen";
  s.props.headline = "Where the wild still runs";
  return s;
}

describe("flatSectionsToPageDoc", () => {
  it("wraps each flat section in section → column(12) → widget", () => {
    const doc = flatSectionsToPageDoc([hero()]);
    expect(isPageDoc(doc)).toBe(true);
    expect(doc.root.kids).toHaveLength(1);
    const section = doc.root.kids[0];
    expect(section.kids).toHaveLength(1);
    expect(section.kids[0].span).toBe(12);
    expect(section.kids[0].kids).toHaveLength(1);
    const widget = section.kids[0].kids[0];
    expect(widget.type).toBe("hero");
  });

  it("carries tone onto the SECTION node and variant onto the WIDGET node", () => {
    const doc = flatSectionsToPageDoc([hero()]);
    const section = doc.root.kids[0];
    const widget = section.kids[0].kids[0] as {
      type: string;
      variant?: string;
    };
    expect(section.tone).toBe("dark");
    expect(widget.variant).toBe("fullscreen");
  });

  it("reads the `display` prop as the variant for grid blocks", () => {
    const s = newSection("rooms_preview") as Extract<
      WebsiteSection,
      { type: "rooms_preview" }
    >;
    s.id = "sec-rooms";
    s.props.display = "showcase";
    const section = sectionToPageDocSection(s);
    const widget = section.kids[0].kids[0] as { variant?: string };
    expect(widget.variant).toBe("showcase");
  });

  it("omits a default tone (no wrapper styling for tone:default)", () => {
    const s = newSection("intro") as WebsiteSection;
    s.id = "sec-intro";
    const section = sectionToPageDocSection(s);
    expect(section.tone).toBeUndefined();
  });

  it("produces a schema-valid, round-trippable PageDoc", () => {
    const doc = flatSectionsToPageDoc([hero()], { title: "Home" });
    expect(pageDocSchema.safeParse(doc).success).toBe(true);
    expect(parsePageDocLoose(doc)).not.toBeNull();
  });
});

describe("theme blueprints", () => {
  it("every active theme yields ≥1 designed page blueprint, all valid", () => {
    for (const slug of THEMES) {
      const blueprints = getThemeBlueprints(slug);
      expect(blueprints.length).toBeGreaterThan(0);
      for (const bp of blueprints) {
        expect(parsePageDocLoose(bp.doc)).not.toBeNull();
        expect(bp.doc.root.kids.length).toBeGreaterThan(0);
      }
    }
  });

  it("getThemeTemplatePageDoc returns the home blueprint for a known key", () => {
    const doc = getThemeTemplatePageDoc("safari", "safari_home");
    expect(doc).not.toBeNull();
    expect(doc!.root.kids.length).toBeGreaterThan(0);
    expect(doc!.meta.templateKey).toBe("safari_home");
  });

  it("returns null for an unknown theme / template key", () => {
    expect(getThemeTemplatePageDoc("safari", "nope")).toBeNull();
    expect(getThemeTemplatePageDoc("no-such-theme", "safari_home")).toBeNull();
  });
});
