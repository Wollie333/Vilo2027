// Hydration — bind a host's Content Profile into a theme's seeded page.
//
// A theme's blueprint is seeded with its own hardcoded DEMO copy (headlines,
// stock images). Hydration overwrites ONLY the bound props (SLOT_BINDINGS) with
// the host's real content, leaving an empty slot showing the theme's demo copy.
// This is what makes "demo preview" and "real site" the same page, and what lets
// a theme switch re-skin without losing content (re-hydrate the same profile).
//
// Pure + non-mutating: returns a new PageDoc; the input is never modified.
import type { PageDoc } from "./pageDoc.schema";
import {
  bindingsForPage,
  type ContentProfile,
  type DerivedContent,
  type SlotBinding,
} from "./contentProfile.schema";

/** A value counts as "present" (worth writing) when it isn't null/blank/empty. */
function isPresent(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Resolve a binding: profile value wins, else the account-derived fallback,
 *  else undefined (→ keep the theme's demo copy). */
function resolveBinding(
  b: SlotBinding,
  profile: ContentProfile,
  derived: DerivedContent,
): unknown {
  const fromProfile = b.get?.(profile);
  if (isPresent(fromProfile)) return fromProfile;
  const fromDerived = b.derive?.(derived);
  if (isPresent(fromDerived)) return fromDerived;
  return undefined;
}

type LooseNode = {
  id?: string;
  type?: string;
  kids?: unknown[];
  props?: Record<string, unknown>;
};

/**
 * Hydrate a single page's PageDoc with the host's profile for the given page kind.
 * Returns a deep clone with bound widget props overwritten; the original is
 * untouched. If no bindings apply to the page kind, the input is returned as-is.
 */
export function hydratePageDoc(
  doc: PageDoc,
  pageKind: string,
  profile: ContentProfile,
  derived: DerivedContent = {},
): PageDoc {
  const bindings = bindingsForPage(pageKind);
  if (bindings.length === 0) return doc;

  // Group bindings by the section/widget type they target, for O(1) lookup.
  const byType = new Map<string, SlotBinding[]>();
  for (const b of bindings) {
    const list = byType.get(b.sectionType);
    if (list) list.push(b);
    else byType.set(b.sectionType, [b]);
  }

  const clone = structuredClone(doc) as PageDoc;

  const walk = (kids: LooseNode[] | undefined): void => {
    if (!Array.isArray(kids)) return;
    for (const node of kids) {
      if (Array.isArray(node.kids)) {
        // Container (section / column) — recurse.
        walk(node.kids as LooseNode[]);
        continue;
      }
      // Widget leaf.
      const matches = node.type ? byType.get(node.type) : undefined;
      if (!matches) continue;
      const props: Record<string, unknown> = node.props ?? (node.props = {});
      for (const b of matches) {
        const value = resolveBinding(b, profile, derived);
        if (value !== undefined) props[b.prop] = value;
      }
    }
  };

  walk((clone.root as LooseNode).kids as LooseNode[] | undefined);
  return clone;
}
