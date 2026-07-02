import { describe, it, expect } from "vitest";

import { flatSectionsToPageDoc } from "./blueprints";
import { newSection } from "./sectionDefaults";
import type { SectionType } from "./sections.schema";
import {
  requiredWidgetsForPageKind,
  isWidgetRequiredOnPage,
  docWidgetTypes,
  missingRequiredWidgets,
  missingRequiredFromRaw,
} from "./pageContract";

// Build a valid Builder V2 PageDoc from a list of block types (each becomes one
// section → column → widget, so the widget-leaf type is the block type).
const doc = (types: string[]) =>
  flatSectionsToPageDoc(types.map((t) => newSection(t as SectionType)));

describe("requiredWidgetsForPageKind", () => {
  it("returns the contract set for system kinds", () => {
    expect(requiredWidgetsForPageKind("search_results")).toEqual([
      "search_results",
    ]);
    expect(requiredWidgetsForPageKind("rooms")).toEqual(["rooms_preview"]);
    expect(requiredWidgetsForPageKind("room_detail")).toContain("room_rate");
    expect(requiredWidgetsForPageKind("room_detail")).toHaveLength(4);
  });
  it("is empty for free-form kinds, unknown, and nullish", () => {
    for (const k of ["home", "about", "checkout", "thank-you", "nope"])
      expect(requiredWidgetsForPageKind(k)).toEqual([]);
    expect(requiredWidgetsForPageKind(null)).toEqual([]);
    expect(requiredWidgetsForPageKind(undefined)).toEqual([]);
  });
});

describe("isWidgetRequiredOnPage", () => {
  it("is true only for a required (type, kind) pair", () => {
    expect(isWidgetRequiredOnPage("search_results", "search_results")).toBe(
      true,
    );
    expect(isWidgetRequiredOnPage("room_rate", "room_detail")).toBe(true);
    // a room block is not required on the rooms INDEX, and vice-versa
    expect(isWidgetRequiredOnPage("rooms_preview", "room_detail")).toBe(false);
    expect(isWidgetRequiredOnPage("el_heading", "home")).toBe(false);
  });
});

describe("docWidgetTypes", () => {
  it("collects every widget-leaf type in the doc", () => {
    const set = docWidgetTypes(doc(["rooms_preview", "gallery"]));
    expect(set.has("rooms_preview")).toBe(true);
    expect(set.has("gallery")).toBe(true);
    expect(set.has("room_rate")).toBe(false);
  });
});

describe("missingRequiredWidgets", () => {
  it("flags a room page missing the booking block", () => {
    // room_rate omitted → the page can't take a booking
    const d = doc(["room_gallery", "room_overview", "room_policies"]);
    expect(missingRequiredWidgets(d, "room_detail")).toEqual(["room_rate"]);
  });
  it("is empty when every required block is present", () => {
    const d = doc([
      "room_gallery",
      "room_overview",
      "room_rate",
      "room_policies",
    ]);
    expect(missingRequiredWidgets(d, "room_detail")).toEqual([]);
  });
  it("is empty for a free-form kind regardless of content", () => {
    expect(missingRequiredWidgets(doc(["el_heading"]), "home")).toEqual([]);
  });
});

describe("missingRequiredFromRaw (publish backstop)", () => {
  it("flags a Builder V2 doc missing a required block", () => {
    expect(missingRequiredFromRaw(doc([]), "rooms")).toEqual(["rooms_preview"]);
  });
  it("passes a doc that has the required block", () => {
    expect(missingRequiredFromRaw(doc(["rooms_preview"]), "rooms")).toEqual([]);
  });
  it("skips legacy flat pages (not block-authored)", () => {
    const flat = [{ id: "x", type: "el_heading", props: {} }];
    expect(missingRequiredFromRaw(flat, "rooms")).toEqual([]);
  });
  it("is empty for non-required kinds", () => {
    expect(missingRequiredFromRaw(doc([]), "home")).toEqual([]);
  });
});
