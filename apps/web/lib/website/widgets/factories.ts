// Builder V2 — node factories.
//
// Build fresh PageDoc nodes (widgets / columns / sections / documents) with
// stable ids and registry-driven default props. Used by the builder when a host
// drops a widget, adds a section, or starts a blank page, and by the re-seed
// helper that emits a theme blueprint as a PageDoc.
import type {
  PageDoc,
  RootNode,
  SectionNode,
  ColumnNode,
  WidgetNode,
  WidgetType,
} from "../pageDoc.schema";
import { widgetDefaults, WIDGET_DEFS } from "./registry";

/** Stable per-doc node id. UUIDs at runtime; blueprints may use readable ids. */
export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `n${Math.round(Math.random() * 1e9)}`;
}

export function newWidget(
  type: WidgetType,
  props?: Record<string, unknown>,
): WidgetNode {
  const def = WIDGET_DEFS[type];
  return {
    id: newId(),
    type,
    props: { ...widgetDefaults(type), ...(props ?? {}) },
    ...(def.variants ? { variant: def.variants[0][0] } : {}),
  };
}

export function newColumn(
  span = 12,
  kids: ColumnNode["kids"] = [],
): ColumnNode {
  return { id: newId(), type: "column", span, kids };
}

/**
 * New section from a column-span layout (e.g. [12], [6,6], [8,4], [3,3,3,3]).
 * Mirrors the prototype's structure picker.
 */
export function newSection(
  spans: number[] = [12],
  opts: Partial<Omit<SectionNode, "id" | "type" | "kids">> = {},
): SectionNode {
  const multiColumn = spans.length > 1;
  return {
    id: newId(),
    type: "section",
    kids: spans.map((s) => newColumn(s)),
    maxw: 1180,
    // Mobile-first default: a multi-column section collapses to one column on
    // phones, so a host who adds a 2/3/4-col structure can't accidentally ship a
    // non-stacking row that squishes on a phone. Any explicit opts.stack wins.
    ...(multiColumn ? { stack: "mobile" as const } : {}),
    ...opts,
  };
}

export function newRoot(kids: SectionNode[] = []): RootNode {
  return { id: newId(), type: "root", kids };
}

export function newPageDoc(
  sections: SectionNode[] = [],
  meta: Record<string, unknown> = {},
): PageDoc {
  return { v: 2, root: newRoot(sections), meta };
}

/**
 * Deep re-key a node subtree (new ids throughout) — for duplicate. Returns the
 * same shape with fresh ids on every node.
 */
export function reidNode<T extends { id: string; kids?: unknown[] }>(
  node: T,
): T {
  const clone = structuredClone(node);
  const walk = (n: { id: string; kids?: unknown[] }) => {
    n.id = newId();
    (n.kids as { id: string; kids?: unknown[] }[] | undefined)?.forEach(walk);
  };
  walk(clone as { id: string; kids?: unknown[] });
  return clone;
}
