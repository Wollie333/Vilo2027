import { describe, expect, it } from "vitest";

import { sectionSchema } from "./sections.schema";
import {
  getThemeRoomDetailSections,
  getThemeSectionPresets,
  getThemeTemplates,
  hasThemeRoomDetailTemplate,
  themeGroupLabel,
} from "./themeSections";

// The ACTIVE themes whose designed presets + page templates the builder offers.
// `getThemeTemplates`/`getThemeSectionPresets` gate on this set (the legacy themes
// were removed from the catalogue), so only these return blocks. Keep in sync with
// ACTIVE_THEME_SLUGS in themeSections.ts (and the active site_themes rows).
const THEME_SLUGS = ["aria", "safari"] as const;

describe("themeSections registry", () => {
  for (const slug of THEME_SLUGS) {
    describe(slug, () => {
      const presets = getThemeSectionPresets(slug);
      const templates = getThemeTemplates(slug);

      it("ships presets and at least one page template", () => {
        expect(presets.length).toBeGreaterThan(0);
        expect(templates.length).toBeGreaterThan(0);
      });

      // A theme may name its pages in its own voice (e.g. safari uses "Suites"
      // and "Journal" rather than "Rooms" and "Blog"), so assert page coverage by
      // the section content a template builds, not by an exact label.
      const allTemplateTypes = () =>
        templates.flatMap((t) => t.make().map((s) => s.type));

      it("ships at least five page templates (home/about/rooms/contact/blog)", () => {
        expect(templates.length).toBeGreaterThanOrEqual(5);
      });

      it("a template includes a contact form", () => {
        expect(allTemplateTypes()).toContain("contact_form");
      });

      it("a template includes a rooms preview", () => {
        expect(allTemplateTypes()).toContain("rooms_preview");
      });

      it("a template includes a blog preview", () => {
        expect(allTemplateTypes()).toContain("blog_preview");
      });

      it("builds every preset into a schema-valid section", () => {
        for (const preset of presets) {
          const result = sectionSchema.safeParse(preset.make());
          expect(
            result.success,
            `${slug}/${preset.key}: ${result.success ? "" : JSON.stringify(result.error.issues)}`,
          ).toBe(true);
        }
      });

      it("builds every template into schema-valid sections", () => {
        for (const template of templates) {
          const sections = template.make();
          expect(sections.length).toBeGreaterThan(0);
          for (const section of sections) {
            const result = sectionSchema.safeParse(section);
            expect(
              result.success,
              `${slug}/${template.key}/${section.type}: ${result.success ? "" : JSON.stringify(result.error.issues)}`,
            ).toBe(true);
          }
        }
      });

      it("has unique preset and template keys", () => {
        const presetKeys = presets.map((p) => p.key);
        const templateKeys = templates.map((t) => t.key);
        expect(new Set(presetKeys).size).toBe(presetKeys.length);
        expect(new Set(templateKeys).size).toBe(templateKeys.length);
      });

      it("gives each built section a fresh id", () => {
        const ids = [
          ...presets.map((p) => p.make().id),
          ...templates.flatMap((t) => t.make().map((s) => s.id)),
        ];
        expect(new Set(ids).size).toBe(ids.length);
      });
    });
  }

  it("returns nothing for an unknown / empty theme slug", () => {
    expect(getThemeSectionPresets("does-not-exist")).toEqual([]);
    expect(getThemeSectionPresets(null)).toEqual([]);
    expect(getThemeSectionPresets(undefined)).toEqual([]);
    expect(getThemeTemplates("does-not-exist")).toEqual([]);
    expect(getThemeTemplates(null)).toEqual([]);
  });

  it("labels the sidebar group from the slug", () => {
    expect(themeGroupLabel("aria")).toBe("Aria");
    expect(themeGroupLabel("nightfall")).toBe("Nightfall");
    expect(themeGroupLabel(null)).toBe("Theme");
  });

  describe("room-detail template", () => {
    for (const slug of THEME_SLUGS) {
      it(`${slug} builds schema-valid room-detail sections incl. the room blocks`, () => {
        const sections = getThemeRoomDetailSections(slug);
        expect(sections.length).toBeGreaterThan(0);
        for (const s of sections) {
          const result = sectionSchema.safeParse(s);
          expect(
            result.success,
            `${slug}/${s.type}: ${result.success ? "" : JSON.stringify(result.error.issues)}`,
          ).toBe(true);
        }
        const types = sections.map((s) => s.type);
        expect(types).toEqual(
          expect.arrayContaining([
            "room_gallery",
            "room_overview",
            "room_amenities",
            "room_rate",
          ]),
        );
      });
    }

    it("gives every built section a fresh id each call", () => {
      const a = getThemeRoomDetailSections("aria");
      const b = getThemeRoomDetailSections("aria");
      const ids = [...a, ...b].map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("falls back to the bare room blocks for an unknown theme", () => {
      const sections = getThemeRoomDetailSections("does-not-exist");
      expect(sections.map((s) => s.type)).toEqual([
        "room_gallery",
        "room_overview",
        "room_amenities",
        "room_rate",
        "room_policies",
      ]);
    });

    it("reports a designed template for every built-in theme (gate for activation)", () => {
      for (const slug of THEME_SLUGS) {
        expect(hasThemeRoomDetailTemplate(slug)).toBe(true);
      }
      expect(hasThemeRoomDetailTemplate("does-not-exist")).toBe(false);
      expect(hasThemeRoomDetailTemplate(null)).toBe(false);
      expect(hasThemeRoomDetailTemplate(undefined)).toBe(false);
    });
  });
});
