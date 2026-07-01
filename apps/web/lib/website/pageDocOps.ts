// Builder V2 — PageDoc tree-mutation ops (Phase 3c).
//
// Pure, IMMUTABLE structural edits on a PageDoc: find a node, move it within its
// parent, remove it, duplicate it, or append a new section. Each returns a NEW
// doc (deep-cloned) so the client store can `setDoc(op(doc, …))` and let React
// diff. Kept framework-free + unit-tested so the builder store stays thin.
import type { PageDoc, SectionNode } from "./pageDoc.schema";
import { newSection, reidNode } from "./widgets/factories";

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
