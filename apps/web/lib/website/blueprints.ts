// Builder V2 — flat-section → PageDoc blueprint converter.
//
// A THEME BLUEPRINT is the nested `PageDoc` a theme's designed page starts from.
// The four themes already ship their designed pages as flat `WebsiteSection[]`
// compositions (lib/website/themeSections.ts). Rather than re-author every page,
// we CONVERT those compositions into the new nested model 1:1:
//
//   each flat section  →  section → column(span 12) → widget
//
// The wrapper section is full-bleed (no max-width clamp, no extra padding) so the
// composite block keeps rendering its own designed band exactly as the legacy
// flat renderer did — the token-driven `PageDocRenderer` + `GenericSection` draw
// the identical on-brand output, with zero per-theme code. Tone lives on the
// SECTION node (it paints the band + flips child contrast); layout `variant`
// lives on the WIDGET node (so the inspector reflects it). This is the mechanical
// backbone of Phase 2's "convert the four themes to token sets + blueprints".
import type { WebsiteSection } from "./sections.schema";
import {
  isRenderableWidgetType,
  type PageDoc,
  type SectionNode,
  type WidgetNode,
  type RenderableWidgetType,
  type BoxSpace,
} from "./pageDoc.schema";

// Full-bleed pass-through: the wrapped composite controls its own width + vertical
// rhythm, so the outer section clamps nothing (maxw is the schema ceiling) and
// adds no padding. Matches the legacy full-width `SectionWrap` band.
const FULL_BLEED_MAXW = 2000;
const NO_SPACE: BoxSpace = { mt: 0, mb: 0, pt: 0, pr: 0, pb: 0, pl: 0 };

// A few blocks express their layout as `display` (rooms/blog grids) rather than
// `variant`; read the right prop so the widget node carries the real variant.
const DISPLAY_VARIANT_TYPES: ReadonlySet<string> = new Set([
  "rooms_preview",
  "blog_preview",
]);

function variantOf(section: WebsiteSection): string | undefined {
  const props = section.props as Record<string, unknown>;
  const key = DISPLAY_VARIANT_TYPES.has(section.type) ? "display" : "variant";
  const v = props[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** One flat section → a full-bleed `section → column(12) → widget` subtree. */
export function sectionToPageDocSection(section: WebsiteSection): SectionNode {
  const widget: WidgetNode = {
    id: `${section.id}::w`,
    type: section.type as RenderableWidgetType,
    props: section.props as Record<string, unknown>,
    ...(variantOf(section) ? { variant: variantOf(section) } : {}),
  };
  return {
    id: section.id,
    type: "section",
    kids: [
      { id: `${section.id}::col`, type: "column", span: 12, kids: [widget] },
    ],
    maxw: FULL_BLEED_MAXW,
    space: NO_SPACE,
    // Tone paints the band; a "default" tone is left off (no wrapper styling).
    ...(section.tone && section.tone !== "default"
      ? { tone: section.tone }
      : {}),
  };
}

/**
 * Convert a flat, designed `WebsiteSection[]` composition into a Builder V2
 * `PageDoc`. Non-renderable / container types (`columns`, `flex` never appear in
 * theme templates) are skipped defensively so the result always validates.
 */
export function flatSectionsToPageDoc(
  sections: WebsiteSection[],
  meta: Record<string, unknown> = {},
): PageDoc {
  const kids = sections
    .filter(
      (s) =>
        isRenderableWidgetType(s.type) &&
        s.type !== "columns" &&
        s.type !== "flex",
    )
    .map(sectionToPageDocSection);
  return { v: 2, root: { id: "root", type: "root", kids }, meta };
}
