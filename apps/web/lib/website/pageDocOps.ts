// Builder V2 — PageDoc tree-mutation ops (Phase 3c).
//
// Pure, IMMUTABLE structural edits on a PageDoc: find a node, move it within its
// parent, remove it, duplicate it, or append a new section. Each returns a NEW
// doc (deep-cloned) so the client store can `setDoc(op(doc, …))` and let React
// diff. Kept framework-free + unit-tested so the builder store stays thin.
import type { PageDoc, SectionNode, WidgetType } from "./pageDoc.schema";
import { newSection, newWidget, reidNode } from "./widgets/factories";

// A node anywhere in the tree (section / column / widget) — all carry `id`, and
// containers additionally carry `kids`.
type TreeNode = { id: string; kids?: TreeNode[] };

export type FoundNode = {
  /** The located node. */
  node: TreeNode;
  /** The array that contains it (its parent's `kids`). */
  siblings: TreeNode[];
  /** Its index within `siblings`. */
  index: number;
};

/** Depth-first search for `id`, returning the node + its containing array + index. */
function findIn(kids: TreeNode[], id: string): FoundNode | null {
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (n.id === id) return { node: n, siblings: kids, index: i };
    if (n.kids) {
      const hit = findIn(n.kids, id);
      if (hit) return hit;
    }
  }
  return null;
}

/** Locate a node by id anywhere in the doc (null if absent). Read-only. */
export function findNode(doc: PageDoc, id: string): FoundNode | null {
  return findIn(doc.root.kids as TreeNode[], id);
}

function clone(doc: PageDoc): PageDoc {
  return structuredClone(doc);
}

/**
 * Move a node one step within its parent (`dir` −1 = up/left, +1 = down/right).
 * No-op (returns the same doc) if the node is missing or already at the edge.
 */
export function moveNode(doc: PageDoc, id: string, dir: -1 | 1): PageDoc {
  const next = clone(doc);
  const found = findIn(next.root.kids as TreeNode[], id);
  if (!found) return doc;
  const j = found.index + dir;
  if (j < 0 || j >= found.siblings.length) return doc;
  const [moved] = found.siblings.splice(found.index, 1);
  found.siblings.splice(j, 0, moved);
  return next;
}

/** Remove a node by id. Returns the same doc if it isn't found. */
export function removeNode(doc: PageDoc, id: string): PageDoc {
  const next = clone(doc);
  const found = findIn(next.root.kids as TreeNode[], id);
  if (!found) return doc;
  found.siblings.splice(found.index, 1);
  return next;
}

/**
 * Duplicate a node in place (fresh ids on the whole subtree), inserted right
 * after the original. Returns { doc, newId } so the caller can select the copy.
 */
export function duplicateNode(
  doc: PageDoc,
  id: string,
): { doc: PageDoc; newId: string | null } {
  const next = clone(doc);
  const found = findIn(next.root.kids as TreeNode[], id);
  if (!found) return { doc, newId: null };
  const copy = reidNode(found.node as { id: string; kids?: unknown[] });
  found.siblings.splice(found.index + 1, 0, copy as TreeNode);
  return { doc: next, newId: copy.id };
}

/**
 * Append a new section built from a column-span layout (e.g. [12], [6,6]).
 * Returns { doc, newId } so the caller can select + scroll to the new section.
 */
export function addSection(
  doc: PageDoc,
  spans: number[],
): { doc: PageDoc; newId: string } {
  const next = clone(doc);
  const section: SectionNode = newSection(spans);
  next.root.kids.push(section);
  return { doc: next, newId: section.id };
}

/** The column with `columnId` (only if it IS a column node). */
function column(next: PageDoc, columnId: string): TreeNode | null {
  const hit = findIn(next.root.kids as TreeNode[], columnId);
  const n = hit?.node as (TreeNode & { type?: string }) | undefined;
  return n && n.type === "column" && n.kids ? n : null;
}

/**
 * Insert a NEW widget of `type` into a column, before `beforeId` (append when
 * `beforeId` is null / not found). Returns { doc, newId } for selecting the drop.
 */
export function insertWidget(
  doc: PageDoc,
  columnId: string,
  beforeId: string | null,
  type: WidgetType,
): { doc: PageDoc; newId: string | null } {
  const next = clone(doc);
  const col = column(next, columnId);
  if (!col || !col.kids) return { doc, newId: null };
  const widget = newWidget(type) as unknown as TreeNode;
  const idx = beforeId ? col.kids.findIndex((k) => k.id === beforeId) : -1;
  if (idx < 0) col.kids.push(widget);
  else col.kids.splice(idx, 0, widget);
  return { doc: next, newId: widget.id };
}

/**
 * Move an EXISTING node into a column, before `beforeId` (append when null / not
 * found). No-op when the node/column is missing or you'd drop it before itself.
 */
export function moveNodeInto(
  doc: PageDoc,
  nodeId: string,
  columnId: string,
  beforeId: string | null,
): PageDoc {
  if (beforeId === nodeId) return doc;
  const next = clone(doc);
  const found = findIn(next.root.kids as TreeNode[], nodeId);
  const col = column(next, columnId);
  if (!found || !col || !col.kids) return doc;
  const [node] = found.siblings.splice(found.index, 1);
  const idx = beforeId ? col.kids.findIndex((k) => k.id === beforeId) : -1;
  if (idx < 0) col.kids.push(node);
  else col.kids.splice(idx, 0, node);
  return next;
}
