// Builder V2 — PageDoc: the nested page-document contract.
//
// Plan of record: docs/features/BUILDER_V2_PLAN.md
// Contract:       docs/features/BUILDER_V2_WIDGET_REGISTRY.md
//
// This is the schema for the NEW standardized Wielo-block builder — a nested
// `root → section → column → widget` tree, in contrast to the legacy flat
// `WebsiteSection[]` in sections.schema.ts. Both live side-by-side during the
// Builder V2 build (parallel build); the legacy path is deleted in Phase 6.
//
// Storage: the SAME JSONB columns (`website_pages.draft_sections` /
// `published_sections`). Because they are JSONB, moving from the flat shape to
// this nested `PageDoc` needs NO SQL migration — only a content re-seed. The `v`
// discriminator lets a reader tell a PageDoc (v:2) from a legacy flat array.
//
// Reuses the shared, brand-safe primitives from sections.schema.ts (tone, block
// style, responsive) so the two models never diverge on styling semantics.
import { z } from "zod";
import {
  SECTION_TONES,
  SECTION_TYPES,
  blockStyleSchema,
  elementStylesSchema,
} from "./sections.schema";

// ── Widget vocabulary ─────────────────────────────────────────
// The standardized Wielo-block set. Most map 1:1 onto a legacy section `type`
// (so the renderer + data binding are shared); five are NEW additive types
// introduced by Builder V2. Kept as one flat list — the registry
// (lib/website/widgets/registry.ts, Phase 1) declares each widget's group,
// label, icon, default props, controls, variants and data needs.
export const WIDGET_TYPES = [
  // Basics (reused element primitives)
  "el_heading",
  "el_text",
  "el_button",
  "el_image",
  "el_divider",
  "el_spacer",
  "el_icon", // NEW — icon box
  "el_list", // NEW — bullet / check / numbered list
  // Media (reused)
  "gallery",
  "video",
  // Content blocks (theme-composite marketing sections — now host-draggable)
  "hero",
  "intro",
  "highlights",
  "stats",
  "cta",
  "host_bio",
  "values",
  "rich_text",
  "faq",
  "pricing",
  "logos",
  "trust",
  // Wielo blocks (reused auto-populate)
  "rooms_preview",
  "el_room_card", // NEW — single room card
  "booking_search", // bar / search / searchbar variants
  "availability_calendar",
  "reviews",
  "specials_preview",
  "amenities", // property-wide facilities (live from property_amenities)
  "addons_preview", // live add-ons / extras
  "blog_preview", // live journal posts
  "policies", // property "things to know" (cancellation / check-in / rules)
  "rate_table", // live nightly "from" rates
  "room_rates", // per-room rates (auto = live)
  "seasonal_pricing", // seasonal rate bands (auto = live)
  "location",
  "map",
  // Site parts (footer document + in-page)
  "el_logo", // NEW
  "el_nav", // NEW
  "el_social", // NEW
  // System / page-template blocks — contextual: the library only offers these on
  // the matching page kind (registry `pageKinds`). They render the SINGLE room in
  // scope (room_detail route) or the live search results (search-results page).
  "search_results", // search-results page
  "room_gallery", // room_detail
  "room_overview", // room_detail
  "room_amenities", // room_detail
  "room_rate", // room_detail
  "room_policies", // room_detail
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

/** The five additive types Builder V2 introduces (Phase 1 adds them to sections.schema.ts too). */
export const NEW_WIDGET_TYPES = [
  "el_icon",
  "el_room_card",
  "el_logo",
  "el_nav",
  "el_social",
] as const;

// ── Renderable widget vocabulary (schema) vs library vocabulary (registry) ──
// `WIDGET_TYPES` above is the CURATED set the drag-library / registry exposes.
// A stored PageDoc widget, however, may hold ANY type the render layer can draw —
// including the composite marketing blocks (`hero`, `intro`, `cta`, `host_bio`,
// `stats`, …) a THEME BLUEPRINT is built from. Those render through the same
// token-driven `GenericSection` as the public site (no per-theme code), so the
// widget-node `type` validates against this broader set = every legacy section
// type PLUS the five new widget types. (`columns`/`flex` are kept renderable but
// are replaced by real section/column structure in Builder V2.)
export const RENDERABLE_WIDGET_TYPES = [
  ...SECTION_TYPES,
  ...NEW_WIDGET_TYPES,
] as const;
export type RenderableWidgetType = (typeof RENDERABLE_WIDGET_TYPES)[number];

const RENDERABLE_SET: ReadonlySet<string> = new Set(RENDERABLE_WIDGET_TYPES);

/** True when a section/widget type can be rendered as a PageDoc widget leaf. */
export function isRenderableWidgetType(
  type: string,
): type is RenderableWidgetType {
  return RENDERABLE_SET.has(type);
}

// ── Shared node primitives ────────────────────────────────────
const nodeId = z.string().min(1);

/** Box spacing (margin + padding), desktop base. Device overrides live in `responsive`. */
export const boxSpaceSchema = z.object({
  mt: z.number().default(0),
  mb: z.number().default(0),
  pt: z.number().default(0),
  pr: z.number().default(0),
  pb: z.number().default(0),
  pl: z.number().default(0),
});
export type BoxSpace = z.infer<typeof boxSpaceSchema>;

const WIDGET_ALIGN = ["left", "center", "right"] as const;
const NODE_ANIM = ["none", "fade", "rise"] as const;
// Local mirror of the legacy visibility values, kept identical on purpose so the
// two models share semantics without a cross-import of a non-exported enum.
const NODE_VISIBILITY = ["all", "desktop", "mobile"] as const;

// Per-node responsive override: hide + reorder + a loose per-device prop patch.
// Kept permissive here (record) — the registry validates per-widget prop patches.
const nodeResponsiveDevice = z
  .object({
    hidden: z.boolean().optional(),
    order: z.number().optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    space: boxSpaceSchema.partial().optional(),
    // Per-element style overrides for this device (Elementor per-device styling).
    // Same shape as `nodeBase.elements`; merged over the base at render.
    elements: elementStylesSchema.optional(),
  })
  .optional();

const nodeResponsive = z
  .object({ tablet: nodeResponsiveDevice, mobile: nodeResponsiveDevice })
  .optional();

// Shared advanced fields on every node.
const nodeBase = {
  id: nodeId,
  tone: z.enum(SECTION_TONES).optional(),
  visibility: z.enum(NODE_VISIBILITY).optional(),
  space: boxSpaceSchema.partial().optional(),
  responsive: nodeResponsive,
  style: blockStyleSchema.optional(),
  // Per-element style overrides (base = desktop). Keyed by the element keys a
  // block declares in the widget registry (`WidgetDef.elements`).
  elements: elementStylesSchema.optional(),
  cssId: z.string().max(80).optional(),
  cssClass: z.string().max(200).optional(),
  // Free-form custom CSS scoped to this node (Elementor-style): the keyword
  // `selector` maps to this element, so rules only affect it and override the
  // element's own styling. Emitted as a scoped <style> at render.
  customCss: z.string().max(4000).optional(),
  anim: z.enum(NODE_ANIM).optional(),
};

// ── Widget ────────────────────────────────────────────────────
// Leaf node. `props` is a loose record in this first cut; per-widget prop
// schemas are attached via the registry (Phase 1 follow-up) and validated on
// write. `variant` is the shared layout variant a theme blueprint selects.
export const widgetNodeSchema = z.object({
  ...nodeBase,
  // Validates the broad RENDERABLE set (composites included) so theme blueprints
  // round-trip; the library only ever OFFERS the curated WIDGET_TYPES subset.
  type: z.enum(RENDERABLE_WIDGET_TYPES),
  props: z.record(z.string(), z.unknown()).default({}),
  variant: z.string().max(40).optional(),
  align: z.enum(WIDGET_ALIGN).optional(),
});
export type WidgetNode = z.infer<typeof widgetNodeSchema>;

// ── Column & Section (recursive: a column may hold nested sections) ──
const COLUMN_DIR = ["column", "row"] as const;
const COLUMN_JUSTIFY = [
  "flex-start",
  "center",
  "flex-end",
  "space-between",
] as const;
const COLUMN_ALIGN = ["stretch", "flex-start", "center", "flex-end"] as const;
const SECTION_VALIGN = ["stretch", "flex-start", "center", "flex-end"] as const;
const SECTION_STACK = ["none", "tablet", "mobile"] as const;

// Recursive types declared up-front (z.lazy needs the TS type).
export type ColumnNode = {
  id: string;
  type: "column";
  span: number;
  kids: (WidgetNode | SectionNode)[];
  dir?: (typeof COLUMN_DIR)[number];
  justify?: (typeof COLUMN_JUSTIFY)[number];
  align?: (typeof COLUMN_ALIGN)[number];
  gap?: number;
  wrap?: boolean;
  space?: Partial<BoxSpace>;
  responsive?: z.infer<typeof nodeResponsive>;
};

export type SectionNode = {
  id: string;
  type: "section";
  kids: ColumnNode[];
  bg?: string;
  maxw?: number;
  valign?: (typeof SECTION_VALIGN)[number];
  gap?: number;
  wrap?: boolean;
  stack?: (typeof SECTION_STACK)[number];
  inner?: boolean;
  borderB?: string;
  tone?: (typeof SECTION_TONES)[number];
  space?: Partial<BoxSpace>;
  responsive?: z.infer<typeof nodeResponsive>;
  style?: z.infer<typeof blockStyleSchema>;
  elements?: z.infer<typeof elementStylesSchema>;
  cssId?: string;
  cssClass?: string;
  customCss?: string;
  anim?: (typeof NODE_ANIM)[number];
};

export const sectionNodeSchema: z.ZodType<SectionNode> = z.lazy(() =>
  z.object({
    id: nodeId,
    type: z.literal("section"),
    kids: z.array(columnNodeSchema).default([]),
    bg: z.string().max(40).optional(),
    maxw: z.number().int().min(320).max(2000).optional(),
    valign: z.enum(SECTION_VALIGN).optional(),
    gap: z.number().optional(),
    wrap: z.boolean().optional(),
    stack: z.enum(SECTION_STACK).optional(),
    inner: z.boolean().optional(),
    borderB: z.string().max(60).optional(),
    tone: z.enum(SECTION_TONES).optional(),
    space: boxSpaceSchema.partial().optional(),
    responsive: nodeResponsive,
    style: blockStyleSchema.optional(),
    elements: elementStylesSchema.optional(),
    cssId: z.string().max(80).optional(),
    cssClass: z.string().max(200).optional(),
    customCss: z.string().max(4000).optional(),
    anim: z.enum(NODE_ANIM).optional(),
  }),
);

export const columnNodeSchema: z.ZodType<ColumnNode> = z.lazy(() =>
  z.object({
    id: nodeId,
    type: z.literal("column"),
    span: z.number().int().min(1).max(12).default(12),
    kids: z.array(z.union([widgetNodeSchema, sectionNodeSchema])).default([]),
    dir: z.enum(COLUMN_DIR).optional(),
    justify: z.enum(COLUMN_JUSTIFY).optional(),
    align: z.enum(COLUMN_ALIGN).optional(),
    gap: z.number().optional(),
    wrap: z.boolean().optional(),
    space: boxSpaceSchema.partial().optional(),
    responsive: nodeResponsive,
  }),
);

// ── Root & document ───────────────────────────────────────────
export const rootNodeSchema = z.object({
  id: nodeId,
  type: z.literal("root"),
  kids: z.array(sectionNodeSchema).default([]),
});
export type RootNode = z.infer<typeof rootNodeSchema>;

// Page meta (SEO / social / tracking) — kept permissive here; the existing page
// meta shape is reused by the builder. Tightened when Page Settings is wired
// (Phase 4).
export const pageMetaSchema = z.record(z.string(), z.unknown());

export const pageDocSchema = z.object({
  v: z.literal(2),
  root: rootNodeSchema,
  meta: pageMetaSchema.default({}),
});
export type PageDoc = z.infer<typeof pageDocSchema>;

/** A stored value is a Builder V2 PageDoc (vs a legacy flat WebsiteSection[]). */
export function isPageDoc(value: unknown): value is PageDoc {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { v?: unknown }).v === 2
  );
}

/** Parse loosely: return a valid PageDoc or null (never throw) — mirrors parseSectionsLoose. */
export function parsePageDocLoose(value: unknown): PageDoc | null {
  const res = pageDocSchema.safeParse(value);
  return res.success ? res.data : null;
}
