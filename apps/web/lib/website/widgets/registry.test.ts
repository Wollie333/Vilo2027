import { describe, it, expect } from "vitest";

import {
  WIDGET_TYPES,
  widgetNodeSchema,
  pageDocSchema,
  isPageDoc,
  parsePageDocLoose,
} from "../pageDoc.schema";
import { WIDGET_DEFS, WIDGET_GROUPS, widgetAvailableOnPage } from "./registry";
import { newWidget, newSection, newPageDoc, reidNode } from "./factories";

describe("widget registry", () => {
  it("has a def for every widget type (and no extras)", () => {
    const defKeys = Object.keys(WIDGET_DEFS).sort();
    expect(defKeys).toEqual([...WIDGET_TYPES].sort());
  });

  it("every def's type field matches its key and uses a known group", () => {
    const groups = new Set(WIDGET_GROUPS.map(([g]) => g));
    for (const [key, def] of Object.entries(WIDGET_DEFS)) {
      expect(def.type).toBe(key);
      expect(groups.has(def.group)).toBe(true);
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.icon.length).toBeGreaterThan(0);
    }
  });

  it("auto-populate defs declare a dataKey", () => {
    for (const def of Object.values(WIDGET_DEFS)) {
      if (def.autoPopulate) expect(def.dataKey).toBeTruthy();
    }
  });

  it("system blocks are gated to their page kind", () => {
    const ROOM = [
      "room_gallery",
      "room_overview",
      "room_amenities",
      "room_rate",
      "room_policies",
    ] as const;
    for (const t of ROOM)
      expect(WIDGET_DEFS[t].pageKinds).toEqual(["room_detail"]);
    expect(WIDGET_DEFS.search_results.pageKinds).toEqual(["search_results"]);
  });
});

describe("widgetAvailableOnPage", () => {
  it("offers universal widgets on any page (incl. none)", () => {
    expect(widgetAvailableOnPage(WIDGET_DEFS.el_heading, "home")).toBe(true);
    expect(widgetAvailableOnPage(WIDGET_DEFS.el_heading, undefined)).toBe(true);
    expect(
      widgetAvailableOnPage(WIDGET_DEFS.rooms_preview, "room_detail"),
    ).toBe(true);
  });

  it("offers a contextual widget only on its matching page kind", () => {
    expect(widgetAvailableOnPage(WIDGET_DEFS.room_gallery, "room_detail")).toBe(
      true,
    );
    expect(widgetAvailableOnPage(WIDGET_DEFS.room_gallery, "home")).toBe(false);
    expect(widgetAvailableOnPage(WIDGET_DEFS.room_gallery, undefined)).toBe(
      false,
    );
    expect(
      widgetAvailableOnPage(WIDGET_DEFS.search_results, "search_results"),
    ).toBe(true);
    expect(
      widgetAvailableOnPage(WIDGET_DEFS.search_results, "room_detail"),
    ).toBe(false);
  });
});

describe("factories produce schema-valid nodes", () => {
  it("newWidget yields a valid widget node for every type", () => {
    for (const type of WIDGET_TYPES) {
      const node = newWidget(type);
      expect(widgetNodeSchema.safeParse(node).success).toBe(true);
      // variant defaults to the first registry variant when the widget has any
      if (WIDGET_DEFS[type].variants) {
        expect(node.variant).toBe(WIDGET_DEFS[type].variants![0][0]);
      }
    }
  });

  it("newSection builds columns whose spans match the layout", () => {
    const s = newSection([8, 4]);
    expect(s.kids.map((c) => c.span)).toEqual([8, 4]);
  });

  it("newPageDoc round-trips through pageDocSchema and isPageDoc", () => {
    const doc = newPageDoc([newSection([6, 6], {})]);
    doc.root.kids[0].kids[0].kids.push(newWidget("el_heading"));
    doc.root.kids[0].kids[1].kids.push(newWidget("rooms_preview"));
    const parsed = pageDocSchema.safeParse(doc);
    expect(parsed.success).toBe(true);
    expect(isPageDoc(doc)).toBe(true);
    expect(parsePageDocLoose(doc)).not.toBeNull();
  });

  it("legacy flat arrays are NOT PageDocs", () => {
    expect(isPageDoc([{ id: "x", type: "hero" }])).toBe(false);
    expect(parsePageDocLoose([{ id: "x", type: "hero" }])).toBeNull();
  });

  it("reidNode assigns fresh ids to every node in the subtree", () => {
    const s = newSection([12]);
    s.kids[0].kids.push(newWidget("el_button"));
    const copy = reidNode(s);
    expect(copy.id).not.toBe(s.id);
    expect(copy.kids[0].id).not.toBe(s.kids[0].id);
    expect(copy.kids[0].kids[0].id).not.toBe(s.kids[0].kids[0].id);
  });
});
