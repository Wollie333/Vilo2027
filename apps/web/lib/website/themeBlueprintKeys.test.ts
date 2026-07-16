import { describe, it, expect } from "vitest";

import { getThemeTemplatePageDoc } from "./themeSections";
import { isPageDoc, pageDocLeaves } from "./pageDoc.schema";

// Guards the seeding key convention used by seedWebsiteContent
// (themeTemplateKeyForKind: `<slug>_<kind>`, blog → "journal"). If a theme
// renames or drops one of these page templates, wizard seeding would silently
// fall back to the generic spine — this test catches that.
const ACTIVE_THEMES = ["safari", "sabela", "oceansview", "marmalade"] as const;
// Canonical page kinds a theme art-directs, mapped to its template key suffix.
const KINDS: Array<[kind: string, keySuffix: string]> = [
  ["home", "home"],
  ["about", "about"],
  ["rooms", "rooms"],
  ["contact", "contact"],
  ["blog", "journal"],
];

describe("theme blueprint seeding keys", () => {
  for (const slug of ACTIVE_THEMES) {
    for (const [kind, suffix] of KINDS) {
      it(`${slug} resolves a PageDoc for the ${kind} page`, () => {
        const doc = getThemeTemplatePageDoc(slug, `${slug}_${suffix}`);
        expect(doc).not.toBeNull();
        expect(isPageDoc(doc)).toBe(true);
        // A blueprint page must carry at least one renderable widget leaf.
        expect(pageDocLeaves(doc!).length).toBeGreaterThan(0);
      });
    }
  }
});
