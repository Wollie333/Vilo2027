// Builder V2 — the PAGE CONTRACT: which Wielo blocks a page KIND requires to
// function. The whole point of the generic renderer is "theme = style, system =
// data" — but a system page still needs its data-driven blocks to do its job: a
// room-detail page with no booking block can't take a booking; a search page with
// no results block shows nothing. This is the SSOT the builder (Required badges +
// delete guard + readiness strip) and the publish guard both read, so the rule is
// declared once.
//
// Only page kinds with a genuine functional requirement appear here; every other
// kind (home/about/contact/specials/experiences/gallery/checkout/thank-you) is
// free-form. `checkout`/`thank-you` are driven by the booking ROUTE, not a block,
// so they carry no required block.
import {
  isPageDoc,
  parsePageDocLoose,
  type PageDoc,
  type WidgetType,
} from "./pageDoc.schema";

/** page kind → widget types that MUST be present at least once for it to function. */
export const PAGE_REQUIRED_WIDGETS: Partial<
  Record<string, readonly WidgetType[]>
> = {
  // The room-detail template needs its room-scoped set: photos, the overview, the
  // booking dock (room_rate) and the policies. room_amenities stays OPTIONAL.
  room_detail: ["room_gallery", "room_overview", "room_rate", "room_policies"],
  // The search page is nothing without the results block.
  search_results: ["search_results"],
  // The rooms index needs the live room list.
  rooms: ["rooms_preview"],
};

/** Required widget types for a page kind (empty for free-form kinds). */
export function requiredWidgetsForPageKind(
  kind?: string | null,
): readonly WidgetType[] {
  return (kind && PAGE_REQUIRED_WIDGETS[kind]) || [];
}

/** Whether a widget type is required on a given page kind (for UI badges + delete
 *  guard). Takes a plain string so callers can pass a node's broad renderable type. */
export function isWidgetRequiredOnPage(
  type: string,
  kind?: string | null,
): boolean {
  return (requiredWidgetsForPageKind(kind) as readonly string[]).includes(type);
}

/** Every widget-leaf type present in a PageDoc (walks section → column → widget). */
export function docWidgetTypes(doc: PageDoc): Set<string> {
  const seen = new Set<string>();
  const visit = (node: { type?: string; kids?: unknown[] }) => {
    if (Array.isArray(node.kids)) {
      for (const k of node.kids) visit(k as Parameters<typeof visit>[0]);
      return;
    }
    if (node.type) seen.add(node.type);
  };
  for (const s of doc.root.kids)
    visit(s as unknown as Parameters<typeof visit>[0]);
  return seen;
}

/** Required widget types MISSING from a live builder doc for its page kind. */
export function missingRequiredWidgets(
  doc: PageDoc,
  kind?: string | null,
): WidgetType[] {
  const present = docWidgetTypes(doc);
  return requiredWidgetsForPageKind(kind).filter((t) => !present.has(t));
}

/**
 * Publish-time backstop that accepts the STORED page shape. Enforced only on
 * Builder V2 PageDocs (the block-authored pages the host builds) — legacy flat
 * pages predate the block contract and render fine, so they're skipped rather
 * than retro-blocked.
 */
export function missingRequiredFromRaw(
  raw: unknown,
  kind?: string | null,
): WidgetType[] {
  if (!requiredWidgetsForPageKind(kind).length) return [];
  // Legacy flat page: not block-authored — do not retro-block.
  if (!isPageDoc(raw)) return [];
  const doc = parsePageDocLoose(raw);
  if (!doc) return requiredWidgetsForPageKind(kind).slice(); // unparseable → all missing
  return missingRequiredWidgets(doc, kind);
}
