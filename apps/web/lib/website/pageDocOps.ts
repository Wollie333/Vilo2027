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

/**
 * Merge a prop patch into a node's `props` (immutable). No-op for a missing node
 * or a node without `props` (sections / columns). Used by the inspector.
 */
export function updateNodeProps(
  doc: PageDoc,
  id: string,
  patch: Record<string, unknown>,
): PageDoc {
  const next = clone(doc);
  const found = findIn(next.root.kids as TreeNode[], id);
  const node = found?.node as
    | (TreeNode & { props?: Record<string, unknown> })
    | undefined;
  if (!node || !node.props) return doc;
  node.props = { ...node.props, ...patch };
  return next;
}

/**
 * Merge a patch into the doc's page-level `meta` (SEO / social / tracking /
 * custom code), immutable + shallow. A `null` value deletes that key. Powers the
 * Page Settings overlay (Phase 4b). The page meta is a loose record on the
 * PageDoc, so this never touches the node tree.
 */
export function updatePageMeta(
  doc: PageDoc,
  patch: Record<string, unknown>,
): PageDoc {
  const next = clone(doc);
  const meta: Record<string, unknown> = { ...(next.meta ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete meta[k];
    else meta[k] = v;
  }
  next.meta = meta;
  return next;
}

/**
 * Merge a patch of NODE-LEVEL fields (tone / bg / space / visibility / cssId /
 * cssClass / span …) into the node itself (immutable, shallow). No-op for a
 * missing node. Used by the inspector's Style + Advanced tabs.
 */
export function updateNode(
  doc: PageDoc,
  id: string,
  patch: Record<string, unknown>,
): PageDoc {
  const next = clone(doc);
  const found = findIn(next.root.kids as TreeNode[], id);
  if (!found) return doc;
  Object.assign(found.node, patch);
  return next;
}

/**
 * Merge a per-device override patch into `node.responsive[device]` (immutable).
 * `patch.props` / `patch.space` are shallow-merged, and a value of `null` DELETES
 * that key (revert to base). `patch.hidden` toggles the device-hide flag
 * (`false`/absent removes it). No-op for a missing node. Powers the inspector's
 * device bar (Phase 3d-2b).
 */
export function updateResponsive(
  doc: PageDoc,
  id: string,
  device: "tablet" | "mobile",
  patch: {
    props?: Record<string, unknown>;
    space?: Record<string, unknown>;
    hidden?: boolean;
    // Per-element style overrides for this device: { elementKey: { prop: value } }.
    // A `null` value at the prop level reverts that prop to the base (desktop).
    elements?: Record<string, Record<string, unknown>>;
  },
): PageDoc {
  const next = clone(doc);
  const found = findIn(next.root.kids as TreeNode[], id);
  if (!found) return doc;
  const node = found.node as TreeNode & {
    responsive?: Record<
      string,
      {
        props?: Record<string, unknown>;
        space?: Record<string, unknown>;
        hidden?: boolean;
        elements?: Record<string, Record<string, unknown>>;
      }
    >;
  };
  const responsive = { ...(node.responsive ?? {}) };
  const layer = { ...(responsive[device] ?? {}) };

  const mergeDrop = (
    base: Record<string, unknown> | undefined,
    incoming: Record<string, unknown>,
  ) => {
    const out = { ...(base ?? {}) };
    for (const [k, v] of Object.entries(incoming)) {
      if (v === null) delete out[k];
      else out[k] = v;
    }
    return out;
  };

  if (patch.props) layer.props = mergeDrop(layer.props, patch.props);
  if (patch.space) layer.space = mergeDrop(layer.space, patch.space);
  if ("hidden" in patch) {
    if (patch.hidden) layer.hidden = true;
    else delete layer.hidden;
  }
  if (patch.elements) {
    // Nested merge: each element's props are merged/dropped independently, and an
    // element whose overrides all cleared is removed from the layer.
    const els = { ...(layer.elements ?? {}) };
    for (const [ek, ev] of Object.entries(patch.elements)) {
      const merged = mergeDrop(els[ek], ev);
      if (Object.keys(merged).length === 0) delete els[ek];
      else els[ek] = merged;
    }
    layer.elements = els;
  }

  // Drop now-empty sub-objects + the layer itself so the doc stays tidy.
  if (layer.props && Object.keys(layer.props).length === 0) delete layer.props;
  if (layer.space && Object.keys(layer.space).length === 0) delete layer.space;
  if (layer.elements && Object.keys(layer.elements).length === 0)
    delete layer.elements;
  if (Object.keys(layer).length === 0) delete responsive[device];
  else responsive[device] = layer;
  node.responsive = responsive;
  return next;
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
 * Insert a NESTED section (its own columns) into a column, before `beforeId`
 * (append when null). Mirrors insertWidget — the drag library's Section / Inner
 * Section blocks drop a fresh `newSection(spans)` here so hosts can build nested
 * column layouts inside any column.
 */
export function insertSection(
  doc: PageDoc,
  columnId: string,
  beforeId: string | null,
  spans: number[],
): { doc: PageDoc; newId: string | null } {
  const next = clone(doc);
  const col = column(next, columnId);
  if (!col || !col.kids) return { doc, newId: null };
  const section = newSection(spans) as unknown as TreeNode;
  const idx = beforeId ? col.kids.findIndex((k) => k.id === beforeId) : -1;
  if (idx < 0) col.kids.push(section);
  else col.kids.splice(idx, 0, section);
  return { doc: next, newId: section.id };
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
