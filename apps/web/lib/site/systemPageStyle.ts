// Builder V3 — read a system page's saved styling for the DEDICATED live routes.
//
// The /book (checkout) and /book/thank-you (confirmation) routes are hardcoded
// (they render the real interactive SiteCheckoutForm / confirmation), but their
// LOOK is host-editable via the matching `checkout` / `thank-you` builder page.
// This resolves that page's `booking_form` / `booking_confirmation` node and
// returns its Elementor-style styling (block frame + per-element `--el-*` vars +
// custom CSS + device visibility) so the route can apply it as an OVERLAY around
// the unchanged form — the "styling overlay first" step (full render-via-
// PageDocRenderer is deferred). Returns null when no page/node exists (routes
// then render exactly as before). Uses the service-role admin client (tenant
// hosts have no session), mirroring loadSiteContext.
import { createAdminClient } from "@/lib/supabase/admin";
import { isPageDoc, parsePageDocLoose } from "@/lib/website/pageDoc.schema";
import {
  parseSectionsLoose,
  type BlockStyle,
  type ElementStyles,
} from "@/lib/website/sections.schema";

/** The styling-relevant fields of a system-page node — the exact shape the
 *  `_shared.tsx` helpers (elementVarsCss / deviceHideCss / blockFrameStyle /
 *  customCssScoped) read. */
export type SystemPageStyleNode = {
  id: string;
  style?: BlockStyle;
  elements?: ElementStyles;
  customCss?: string;
  responsive?: {
    desktop?: { hidden?: boolean };
    tablet?: { hidden?: boolean; elements?: ElementStyles };
    mobile?: { hidden?: boolean; elements?: ElementStyles };
  };
};

type Node = {
  id?: unknown;
  type?: unknown;
  kids?: unknown;
  style?: unknown;
  elements?: unknown;
  customCss?: unknown;
  responsive?: unknown;
};

/** Depth-first: the first node whose `type` matches, with `kids` (containers)
 *  walked recursively. Returns the raw node (all styling fields intact). */
function findNode(kids: unknown, wantType: string): Node | null {
  if (!Array.isArray(kids)) return null;
  for (const raw of kids) {
    const n = raw as Node;
    if (Array.isArray(n.kids)) {
      const hit = findNode(n.kids, wantType);
      if (hit) return hit;
    } else if (n.type === wantType && typeof n.id === "string") {
      return n;
    }
  }
  return null;
}

function toStyleNode(n: Node): SystemPageStyleNode {
  return {
    id: n.id as string,
    style: n.style as BlockStyle | undefined,
    elements: n.elements as ElementStyles | undefined,
    customCss: typeof n.customCss === "string" ? n.customCss : undefined,
    responsive: n.responsive as SystemPageStyleNode["responsive"],
  };
}

/**
 * Resolve the styling of the `widgetType` node on the site's `kind` system page.
 * PUBLIC reads `published_sections` (frozen at publish); PREVIEW reads
 * `draft_sections`. Handles BOTH a Builder V2 PageDoc (host has edited it) and
 * the seeded flat `WebsiteSection[]` (never edited — only block-level `style`).
 */
export async function loadSystemPageStyle(opts: {
  websiteId: string;
  kind: string;
  widgetType: string;
  preview: boolean;
}): Promise<SystemPageStyleNode | null> {
  const admin = createAdminClient();
  const { data: page } = await admin
    .from("website_pages")
    .select("draft_sections, published_sections")
    .eq("website_id", opts.websiteId)
    .eq("kind", opts.kind)
    .maybeSingle<{ draft_sections: unknown; published_sections: unknown }>();
  if (!page) return null;

  const raw = opts.preview ? page.draft_sections : page.published_sections;

  if (isPageDoc(raw)) {
    const doc = parsePageDocLoose(raw);
    if (!doc) return null;
    const hit = findNode(
      (doc.root as { kids?: unknown }).kids,
      opts.widgetType,
    );
    return hit ? toStyleNode(hit) : null;
  }

  // Seeded flat sections — block-level `style` only (no per-element overrides).
  const section = parseSectionsLoose(raw).find(
    (s) => s.type === opts.widgetType,
  );
  return section ? { id: section.id, style: section.style } : null;
}
