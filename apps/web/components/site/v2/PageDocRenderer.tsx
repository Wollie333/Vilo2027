import type { CSSProperties, ReactNode } from "react";

import {
  sectionSchema,
  type WebsiteSection,
} from "@/lib/website/sections.schema";
import type {
  PageDoc,
  SectionNode,
  ColumnNode,
  WidgetNode,
  BoxSpace,
} from "@/lib/website/pageDoc.schema";
import type { SiteAssetResolver, SiteData } from "@/lib/site/types";

import { GenericSection } from "../SectionRenderer";
import { SectionBoundary } from "../SectionBoundary";
import { sectionToneStyle } from "../sections/_shared";
import {
  IconLeaf,
  LogoLeaf,
  NavLeaf,
  SocialLeaf,
  RoomCardLeaf,
} from "./NewLeaves";

// Builder V2 — the token-driven PageDoc renderer.
//
// Renders the nested root→section→column→widget tree. STRUCTURE (section bands,
// column grid, spacing, tone) is new; the widget LEAVES reuse the existing
// generic, `--site-*`-driven components via GenericSection — the same on-brand
// render the public site already ships — so there is one render, not per-theme
// forks. The five Builder V2 widget types render through NewLeaves.
//
// Parallel build: additive, RSC-friendly, and NOT yet wired to a public route —
// live visual verification happens when the new preview/route lands (Phase 2/3).

type Device = "desktop" | "tablet" | "mobile";

interface RenderCtx {
  data?: SiteData;
  asset?: SiteAssetResolver;
  websiteId?: string;
  interactive?: boolean;
  device?: Device;
  /** Builder-only: label shown when a node throws. */
  errorLabel?: string;
}

export function PageDocRenderer({ doc, ...ctx }: { doc: PageDoc } & RenderCtx) {
  return <>{doc.root.kids.map((s) => renderSection(s, ctx))}</>;
}

// A few shared widgets express their layout as `display` (grid/showcase|journal)
// rather than `variant`; map the node's variant onto the right prop.
const DISPLAY_VARIANT_TYPES = new Set(["rooms_preview", "blog_preview"]);
function foldVariant(
  type: string,
  props: Record<string, unknown>,
  variant: string | undefined,
): Record<string, unknown> {
  if (!variant) return props;
  return DISPLAY_VARIANT_TYPES.has(type)
    ? { ...props, display: variant }
    : { ...props, variant };
}

// ── spacing ───────────────────────────────────────────────────
const SECTION_DEFAULT: BoxSpace = {
  mt: 0,
  mb: 0,
  pt: 56,
  pr: 24,
  pb: 56,
  pl: 24,
};
const ZERO: BoxSpace = { mt: 0, mb: 0, pt: 0, pr: 0, pb: 0, pl: 0 };

function spaceStyle(
  space: Partial<BoxSpace> | undefined,
  base: BoxSpace,
): CSSProperties {
  const s = { ...base, ...(space ?? {}) };
  return {
    padding: `${s.pt}px ${s.pr}px ${s.pb}px ${s.pl}px`,
    margin: `${s.mt}px 0 ${s.mb}px`,
  };
}

function hiddenOnDevice(
  node: {
    visibility?: string;
    responsive?: {
      tablet?: { hidden?: boolean };
      mobile?: { hidden?: boolean };
    };
  },
  device: Device | undefined,
): boolean {
  if (device === "tablet" && node.responsive?.tablet?.hidden) return true;
  if (device === "mobile" && node.responsive?.mobile?.hidden) return true;
  const vis = node.visibility ?? "all";
  if (vis === "all" || !device) return false;
  if (vis === "desktop") return device !== "desktop";
  if (vis === "mobile") return device === "desktop";
  return false;
}

// ── section ───────────────────────────────────────────────────
function renderSection(node: SectionNode, ctx: RenderCtx): ReactNode {
  if (hiddenOnDevice(node, ctx.device)) return null;

  const stackOn =
    node.stack &&
    (node.stack === ctx.device ||
      (node.stack === "tablet" && ctx.device === "mobile"));

  // Split the tone: the background FILL goes on the outer element (so its
  // `var(--site-ink)` resolves against the inherited palette), while the tone's
  // `--site-*` overrides go on the INNER container (so children flip to the
  // right contrast). Setting both on one element makes `background:var(--site-ink)`
  // self-reference the overridden `--site-ink` and render the wrong colour.
  const tone = sectionToneStyle(node.tone) as
    | (CSSProperties & { background?: string })
    | undefined;
  const { background: toneBg, ...toneVars } = tone ?? {};

  const outer: CSSProperties = {
    ...spaceStyle(node.space, SECTION_DEFAULT),
    ...(node.borderB ? { borderBottom: node.borderB } : {}),
    background: node.bg ?? toneBg,
  };
  const inner: CSSProperties = {
    ...toneVars,
    maxWidth: node.maxw ?? 1180,
    margin: "0 auto",
    display: "flex",
    flexDirection: stackOn ? "column" : "row",
    flexWrap: node.wrap ? "wrap" : "nowrap",
    gap: node.gap ?? 20,
    alignItems: node.valign ?? "stretch",
  };

  return (
    <div key={node.id} style={outer}>
      <div style={inner}>{node.kids.map((c) => renderColumn(c, ctx))}</div>
    </div>
  );
}

// ── column ────────────────────────────────────────────────────
function renderColumn(node: ColumnNode, ctx: RenderCtx): ReactNode {
  if (hiddenOnDevice(node, ctx.device)) return null;
  const dir = node.dir ?? "column";
  const style: CSSProperties = {
    flex: `${node.span} 1 0`,
    minWidth: 0,
    display: "flex",
    flexDirection: dir,
    flexWrap: node.wrap ? "wrap" : "nowrap",
    gap: node.gap ?? 0,
    justifyContent: node.justify ?? "flex-start",
    alignItems: node.align ?? (dir === "row" ? "center" : "stretch"),
    ...spaceStyle(node.space, ZERO),
  };
  return (
    <div key={node.id} style={style}>
      {node.kids.map((k) =>
        k.type === "section" ? renderSection(k, ctx) : renderWidget(k, ctx),
      )}
    </div>
  );
}

// ── widget ────────────────────────────────────────────────────
function renderWidget(node: WidgetNode, ctx: RenderCtx): ReactNode {
  if (hiddenOnDevice(node, ctx.device)) return null;
  return (
    <div key={node.id} style={spaceStyle(node.space, ZERO)}>
      <SectionBoundary resetKey={node} fallbackLabel={ctx.errorLabel}>
        <WidgetLeaf node={node} ctx={ctx} />
      </SectionBoundary>
    </div>
  );
}

function WidgetLeaf({ node, ctx }: { node: WidgetNode; ctx: RenderCtx }) {
  switch (node.type) {
    case "el_icon":
      return <IconLeaf props={node.props} variant={node.variant} />;
    case "el_room_card":
      return <RoomCardLeaf props={node.props} variant={node.variant} />;
    case "el_logo":
      return <LogoLeaf props={node.props} />;
    case "el_nav":
      return <NavLeaf props={{ ...node.props, variant: node.variant }} />;
    case "el_social":
      return <SocialLeaf props={{ ...node.props, variant: node.variant }} />;
    default:
      break;
  }
  // Shared widget: validate into a legacy WebsiteSection so we reuse the exact
  // on-brand generic leaf (and get prop validation for free). The node-level
  // `variant` maps onto each type's own layout prop — most read `variant`, a few
  // read `display`; types without either strip the extra key safely.
  const props = foldVariant(node.type, node.props, node.variant);
  const parsed = sectionSchema.safeParse({
    id: node.id,
    type: node.type,
    enabled: true,
    tone: node.tone ?? "default",
    props,
  });
  if (!parsed.success) return null;
  return (
    <GenericSection
      section={parsed.data as WebsiteSection}
      data={ctx.data}
      asset={ctx.asset}
      interactive={ctx.interactive}
      websiteId={ctx.websiteId}
    />
  );
}
