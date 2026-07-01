import { describe, it, expect } from "vitest";

import {
  findNode,
  moveNode,
  removeNode,
  duplicateNode,
  addSection,
  insertWidget,
  moveNodeInto,
  updateNodeProps,
  updateNode,
  updateResponsive,
  updatePageMeta,
} from "./pageDocOps";
import { newPageDoc, newSection, newWidget } from "./widgets/factories";
import { pageDocSchema } from "./pageDoc.schema";

function sampleDoc() {
  // Two sections; the first has one column with two widgets.
  const s1 = newSection([12]);
  s1.id = "s1";
  s1.kids[0].id = "s1c";
  const wA = newWidget("el_heading");
  wA.id = "wA";
  const wB = newWidget("el_text");
  wB.id = "wB";
  s1.kids[0].kids.push(wA, wB);
  const s2 = newSection([6, 6]);
  s2.id = "s2";
  return newPageDoc([s1, s2]);
}

describe("pageDocOps", () => {
  it("findNode locates nodes at any depth (and returns null when absent)", () => {
    const doc = sampleDoc();
    expect(findNode(doc, "s1")?.index).toBe(0);
    expect(findNode(doc, "wB")?.index).toBe(1);
    expect(findNode(doc, "nope")).toBeNull();
  });

  it("moveNode reorders within the parent and clamps at the edges", () => {
    const doc = sampleDoc();
    const moved = moveNode(doc, "wB", -1); // wB up → before wA
    const col = moved.root.kids[0].kids[0].kids;
    expect(col.map((k) => k.id)).toEqual(["wB", "wA"]);
    // already-first can't move up → same doc reference
    expect(moveNode(moved, "wB", -1)).toBe(moved);
  });

  it("moveNode is immutable (original doc unchanged)", () => {
    const doc = sampleDoc();
    moveNode(doc, "wB", -1);
    expect(doc.root.kids[0].kids[0].kids.map((k) => k.id)).toEqual([
      "wA",
      "wB",
    ]);
  });

  it("removeNode deletes the node", () => {
    const doc = sampleDoc();
    const next = removeNode(doc, "wA");
    expect(findNode(next, "wA")).toBeNull();
    expect(findNode(next, "wB")).not.toBeNull();
  });

  it("duplicateNode inserts a fresh-id copy right after the original", () => {
    const doc = sampleDoc();
    const { doc: next, newId } = duplicateNode(doc, "wA");
    const ids = next.root.kids[0].kids[0].kids.map((k) => k.id);
    expect(ids).toEqual(["wA", newId, "wB"]);
    expect(newId).not.toBe("wA");
  });

  it("addSection appends a section built from the span layout", () => {
    const doc = sampleDoc();
    const { doc: next, newId } = addSection(doc, [4, 4, 4]);
    expect(next.root.kids).toHaveLength(3);
    const added = next.root.kids[2];
    expect(added.id).toBe(newId);
    expect(added.kids.map((c) => c.span)).toEqual([4, 4, 4]);
  });

  it("insertWidget adds a widget before the target (or appends when null)", () => {
    const doc = sampleDoc();
    // before wB → between wA and wB
    const r1 = insertWidget(doc, "s1c", "wB", "el_button");
    const ids1 = r1.doc.root.kids[0].kids[0].kids.map((k) => k.id);
    expect(ids1).toEqual(["wA", r1.newId, "wB"]);
    // append (null before)
    const r2 = insertWidget(doc, "s1c", null, "el_button");
    const ids2 = r2.doc.root.kids[0].kids[0].kids.map((k) => k.id);
    expect(ids2[ids2.length - 1]).toBe(r2.newId);
  });

  it("insertWidget no-ops on a non-column / missing target", () => {
    const doc = sampleDoc();
    expect(insertWidget(doc, "s1", null, "el_text").newId).toBeNull(); // s1 is a section
    expect(insertWidget(doc, "nope", null, "el_text").newId).toBeNull();
  });

  it("moveNodeInto relocates a node before the target and drops before-self", () => {
    const doc = sampleDoc();
    // move wA into s2's first column (empty), appended
    const s2col = doc.root.kids[1].kids[0].id;
    const moved = moveNodeInto(doc, "wA", s2col, null);
    expect(findNode(moved, "wA")?.siblings.length).toBe(1);
    expect(moved.root.kids[0].kids[0].kids.map((k) => k.id)).toEqual(["wB"]);
    // dropping a node before itself is a no-op (same reference)
    expect(moveNodeInto(doc, "wA", "s1c", "wA")).toBe(doc);
  });

  it("updateNodeProps merges into props immutably (no-op for prop-less nodes)", () => {
    const doc = sampleDoc();
    const next = updateNodeProps(doc, "wA", { text: "Hello", align: "center" });
    const wA = findNode(next, "wA")?.node as unknown as {
      props: Record<string, unknown>;
    };
    expect(wA.props.text).toBe("Hello");
    expect(wA.props.align).toBe("center");
    // original untouched
    const wAorig = findNode(doc, "wA")?.node as unknown as {
      props: Record<string, unknown>;
    };
    expect(wAorig.props.text).not.toBe("Hello");
    // a column has no props → no-op (same doc reference)
    expect(updateNodeProps(doc, "s1c", { x: 1 })).toBe(doc);
  });

  it("updateNode merges node-level fields immutably", () => {
    const doc = sampleDoc();
    const next = updateNode(doc, "s1", {
      tone: "dark",
      space: { pt: 20, pb: 20 },
    });
    const s1 = findNode(next, "s1")?.node as {
      tone?: string;
      space?: { pt?: number };
    };
    expect(s1.tone).toBe("dark");
    expect(s1.space?.pt).toBe(20);
    // original untouched
    expect(
      (findNode(doc, "s1")?.node as { tone?: string }).tone,
    ).toBeUndefined();
    // missing node → same reference
    expect(updateNode(doc, "nope", { tone: "dark" })).toBe(doc);
  });

  it("updateResponsive sets device overrides, then null/false reverts them", () => {
    const doc = sampleDoc();
    const withOv = updateResponsive(doc, "wA", "mobile", {
      props: { align: "center" },
      space: { pt: 8 },
      hidden: true,
    });
    const r1 = (
      findNode(withOv, "wA")?.node as { responsive?: Record<string, unknown> }
    ).responsive?.mobile as {
      props?: Record<string, unknown>;
      space?: Record<string, unknown>;
      hidden?: boolean;
    };
    expect(r1.props?.align).toBe("center");
    expect(r1.space?.pt).toBe(8);
    expect(r1.hidden).toBe(true);
    // revert: null deletes the key, hidden:false clears; empty layer is dropped
    const cleared = updateResponsive(withOv, "wA", "mobile", {
      props: { align: null },
      space: { pt: null },
      hidden: false,
    });
    const r2 = (
      findNode(cleared, "wA")?.node as { responsive?: Record<string, unknown> }
    ).responsive;
    expect(r2?.mobile).toBeUndefined();
    // base is never touched by device overrides
    expect(
      (
        findNode(withOv, "wA")?.node as unknown as {
          props: Record<string, unknown>;
        }
      ).props.align,
    ).not.toBe("center");
  });

  it("updatePageMeta merges, deletes on null, and stays schema-valid", () => {
    const doc = sampleDoc();
    const a = updatePageMeta(doc, { seoTitle: "Home", index: true });
    expect(a.meta.seoTitle).toBe("Home");
    expect(a.meta.index).toBe(true);
    expect(doc.meta.seoTitle).toBeUndefined(); // original untouched
    const b = updatePageMeta(a, { metaDesc: "desc", seoTitle: null });
    expect(b.meta.metaDesc).toBe("desc");
    expect(b.meta.seoTitle).toBeUndefined(); // null deletes the key
    expect(b.meta.index).toBe(true); // untouched keys survive
    expect(pageDocSchema.safeParse(b).success).toBe(true);
  });

  it("every op yields a schema-valid PageDoc", () => {
    const doc = sampleDoc();
    for (const d of [
      moveNode(doc, "wB", -1),
      removeNode(doc, "wA"),
      duplicateNode(doc, "s1").doc,
      addSection(doc, [8, 4]).doc,
    ]) {
      expect(pageDocSchema.safeParse(d).success).toBe(true);
    }
  });
});
