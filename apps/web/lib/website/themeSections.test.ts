import { describe, expect, it } from "vitest";

import { sectionSchema } from "./sections.schema";
import {
  getThemeSectionPresets,
  getThemeTemplates,
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

      it("ships Home, About and Contact page templates", () => {
        const labels = templates.map((t) => t.label);
        expect(labels).toEqual(
          expect.arrayContaining(["Home", "About", "Contact"]),
        );
      });

      it("the Contact template includes a contact form", () => {
        const contact = templates.find((t) => t.label === "Contact");
        expect(contact).toBeDefined();
        const types = contact!.make().map((s) => s.type);
        expect(types).toContain("contact_form");
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
});
