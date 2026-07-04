import { describe, expect, it } from "vitest";

import { flatSectionsToPageDoc } from "./blueprints";
import {
  countRenderableSections,
  isPageDoc,
  renderableLeaves,
} from "./pageDoc.schema";
import type { WebsiteSection } from "./sections.schema";

const flat: WebsiteSection[] = [
  { id: "a", type: "search_results", enabled: true, props: { heading: "A" } },
  { id: "b", type: "search_results", enabled: true, props: { heading: "B" } },
] as unknown as WebsiteSection[];

describe("countRenderableSections (v2-aware)", () => {
  it("counts a legacy flat WebsiteSection[]", () => {
    expect(countRenderableSections(flat)).toBe(2);
  });

  it("counts the widget leaves of a Builder V2 PageDoc (not 0)", () => {
    // The bug: a PageDoc is an OBJECT, so parseSectionsLoose returned 0 and the
    // Pages manager labelled every published v2 page "Draft".
    const doc = flatSectionsToPageDoc(flat);
    expect(isPageDoc(doc)).toBe(true);
    expect(countRenderableSections(doc)).toBe(2);
  });

  it("treats empty / malformed values as 0", () => {
    expect(countRenderableSections([])).toBe(0);
    expect(countRenderableSections(null)).toBe(0);
    expect(countRenderableSections({ v: 2, root: { kids: [] } })).toBe(0);
    expect(countRenderableSections("nope")).toBe(0);
  });
});

describe("renderableLeaves", () => {
  it("returns the widget leaves (with props) for both shapes", () => {
    expect(renderableLeaves(flat)).toHaveLength(2);
    const leaves = renderableLeaves(flatSectionsToPageDoc(flat));
    expect(leaves.map((l) => l.type)).toEqual([
      "search_results",
      "search_results",
    ]);
    // Each leaf carries a props object (the thumbnail scanner reads image_path/…).
    expect(leaves.every((l) => typeof l.props === "object")).toBe(true);
  });
});
