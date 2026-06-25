import { describe, expect, it } from "vitest";

import { sectionSchema } from "./sections.schema";
import {
  getThemeRoomDetailSections,
  getThemeSectionPresets,
  getThemeTemplates,
  hasThemeRoomDetailTemplate,
  themeGroupLabel,
} from "./themeSections";

// Every built-in theme that ships designed presets + page templates. Keep in
// sync with the registry in themeSections.ts (and the seeded site_themes slugs).
const THEME_SLUGS = [
  "aria",
  "classic",
  "modern",
  "coastal",
  "warm",
  "minimal",
  "nightfall",
] as const;

describe("themeSections registry", () => {
  for (const slug of THEME_SLUGS) {
    describe(slug, () => {
      const presets = getThemeSectionPresets(slug);
      const templates = getThemeTemplates(slug);

      it("ships presets and at least one page template", () => {
        expect(presets.length).toBeGreaterThan(0);
        expect(templates.length).toBeGreaterThan(0);
      });

      it("ships Home, About, Contact, Rooms and Blog page templates", () => {
        const labels = templates.map((t) => t.label);
        expect(labels).toEqual(
          expect.arrayContaining(["Home", "About", "Contact", "Rooms", "Blog"]),
        );
      });

      it("the Contact template includes a contact form", () => {
        const contact = templates.find((t) => t.label === "Contact");
        expect(contact).toBeDefined();
        const types = contact!.make().map((s) => s.type);
        expect(types).toContain("contact_form");
      });

      it("the Rooms template includes a rooms preview", () => {
        const rooms = templates.find((t) => t.label === "Rooms");
        expect(rooms).toBeDefined();
        const types = rooms!.make().map((s) => s.type);
        expect(types).toContain("rooms_preview");
      });

      it("the Blog template includes a blog preview", () => {
        const blog = templates.find((t) => t.label === "Blog");
        expect(blog).toBeDefined();
        const types = blog!.make().map((s) => s.type);
        expect(types).toContain("blog_preview");
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
