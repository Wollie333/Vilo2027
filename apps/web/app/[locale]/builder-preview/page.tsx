import Link from "next/link";

import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { PageDocRenderer } from "@/components/site/v2/PageDocRenderer";
import {
  newId,
  newPageDoc,
  newSection,
  newWidget,
} from "@/lib/website/widgets/factories";
import { getThemeBlueprints } from "@/lib/website/themeSections";
import { resolveThemeBase } from "@/lib/site/themes.server";
import { sampleDataForDoc } from "@/lib/site/sampleSite";
import type {
  RenderableWidgetType,
  WidgetNode,
} from "@/lib/website/pageDoc.schema";

// Builder V2 — DEV-ONLY preview of the token-driven PageDoc renderer.
//
// Two modes:
//  • No `?theme` → a hand-built demo doc (structure + all five new leaves), themed
//    by ?preset=warm|coastal. Proves pure token re-theming of the same document.
//  • `?theme=<slug>&page=<key>` → a REAL theme, converted from its designed flat
//    template into a PageDoc blueprint (lib/website/blueprints.ts) and rendered
//    through the ONE token renderer under that theme's real tokens. Proves the
//    Phase-2 thesis: the four bespoke themes read distinct from ONE render layer.
//
// Remove at cutover (Phase 6).
export const dynamic = "force-dynamic";

const THEME_SLUGS = ["safari", "sabela", "oceansview", "marmalade"] as const;

// Display webfonts the four themes use, so the blueprint preview reads faithfully
// even without each theme's bespoke shell (which normally loads them).
const FONT_HREFS = [
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800&family=Manrope:wght@400;500;600&display=swap",
  "https://fonts.googleapis.com/css2?family=Gloock&family=Karla:wght@400;500;600&display=swap",
];

function w(
  type: Parameters<typeof newWidget>[0],
  props: Record<string, unknown>,
  variant?: string,
): WidgetNode {
  const node = newWidget(type, props);
  if (variant) node.variant = variant;
  return node;
}

// Raw widget node for RENDERABLE types outside the curated drag-library registry
// (e.g. the room-scoped room_gallery/overview/amenities/rate leaves).
function rw(
  type: RenderableWidgetType,
  props: Record<string, unknown> = {},
): WidgetNode {
  return { id: newId(), type, props };
}

function demoDoc() {
  const doc = newPageDoc();

  // 1 — hero-ish band: heading + text + button
  const s1 = newSection([12], { bg: "var(--site-surface)" });
  s1.kids[0].kids.push(
    w("el_heading", {
      text: "A little house that feeds you well",
      level: "h1",
      align: "center",
    }),
    w("el_text", {
      body: "Five sunny rooms in a restored parsonage, a garden full of figs, and a breakfast worth setting an alarm for.",
      align: "center",
    }),
    w("el_button", { label: "Book a room", href: "#", align: "center" }),
  );
  doc.root.kids.push(s1);

  // 2 — two columns: image | heading + text
  const s2 = newSection([6, 6], { valign: "center" });
  s2.kids[0].kids.push(w("el_image", { image_path: "", alt: "Room" }));
  s2.kids[1].kids.push(
    w("el_heading", {
      text: "It's less a hotel, more a home",
      level: "h2",
      align: "left",
    }),
    w("el_text", {
      body: "Pressed ceilings, deep baths, a long table, and a garden the kitchen raids every morning.",
      align: "left",
    }),
  );
  doc.root.kids.push(s2);

  // 3 — accent band: three icon boxes
  const s3 = newSection([4, 4, 4], { tone: "accent" });
  s3.kids[0].kids.push(
    w("el_icon", {
      glyph: "☕",
      title: "Breakfast in the garden",
      body: "Fig jam, fresh bread and eggs from the hens.",
    }),
  );
  s3.kids[1].kids.push(
    w("el_icon", {
      glyph: "🛏️",
      title: "Five sunny rooms",
      body: "Each one different, all of them yours.",
    }),
  );
  s3.kids[2].kids.push(
    w("el_icon", {
      glyph: "🌿",
      title: "A fig garden",
      body: "Raided every morning for the kitchen.",
    }),
  );
  doc.root.kids.push(s3);

  // 4 — site parts: logo, nav, social (dark tone → leaves auto-flip to light)
  // Phase 5: logo/nav/social bind to the live brand + menu (source menu/brand).
  const s4 = newSection([4, 4, 4], { tone: "dark", valign: "center" });
  s4.kids[0].kids.push(w("el_logo", { style: "markName", align: "left" }));
  s4.kids[1].kids.push(
    w("el_nav", { source: "menu", align: "center" }, "underline"),
  );
  s4.kids[2].kids.push(
    w("el_social", { source: "brand", align: "right" }, "round"),
  );
  doc.root.kids.push(s4);

  // 4b — an auto-populate widget with NO SiteData: must degrade gracefully
  // (render its heading / empty state, never crash). Live data lands in Phase 5.
  const s4b = newSection([12], { tone: "muted" });
  s4b.kids[0].kids.push(
    w("rooms_preview", { heading: "Pick a room, any room", max: 3 }, "grid"),
  );
  doc.root.kids.push(s4b);

  // 4c — booking search bar (Phase 5-3): renders a populated preview from sample
  // BookingFunnelData (non-interactive here — the live site quotes server-side).
  const s4c = newSection([12], { tone: "muted" });
  s4c.kids[0].kids.push(
    w("booking_search", { heading: "Check availability" }, "bar"),
  );
  doc.root.kids.push(s4c);

  // 5 — two room cards (variants), each bound to a DIFFERENT sample room by
  // room_id (proves the picker's per-card room selection).
  const s5 = newSection([6, 6]);
  s5.kids[0].kids.push(w("el_room_card", { room_id: "demo-r1" }, "postcard"));
  s5.kids[1].kids.push(w("el_room_card", { room_id: "demo-r3" }, "clean"));
  doc.root.kids.push(s5);

  // 5b — room-detail template (Phase 5-4): room-scoped widgets, all bound to the
  // ONE sample RoomDetail by sampleDataForDoc (the public page injects the LIVE
  // room). Gallery full-width, then overview + amenities beside the rate.
  const s5b = newSection([12]);
  s5b.kids[0].kids.push(rw("room_gallery"));
  doc.root.kids.push(s5b);
  const s5c = newSection([8, 4], { valign: "flex-start" });
  s5c.kids[0].kids.push(rw("room_overview"), rw("room_amenities"));
  s5c.kids[1].kids.push(rw("room_rate"));
  doc.root.kids.push(s5c);

  // 6 — composite Wielo blocks INSIDE columns (content + sidebar). Proves the
  // full-width band leaves stay contained in a <12 column (no bleed / gutter
  // doubling) — the column-context check for Phase 2 leaf polish.
  const s6 = newSection([8, 4], { tone: "muted", valign: "flex-start" });
  s6.kids[0].kids.push(
    w("gallery", { heading: "The gallery", max: 6 }, "grid"),
  );
  s6.kids[1].kids.push(w("reviews", { heading: "Kind words", max: 3 }, "list"));
  doc.root.kids.push(s6);

  return doc;
}

function Switcher({
  activeTheme,
  activePage,
  pages,
}: {
  activeTheme?: string;
  activePage?: string;
  pages: { key: string; label: string }[];
}) {
  const chip = (active: boolean): React.CSSProperties => ({
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    textDecoration: "none",
    border: "1px solid var(--site-line)",
    background: active ? "var(--site-accent)" : "transparent",
    color: active ? "var(--site-accent-ink)" : "var(--site-mute)",
  });
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
        padding: "8px 16px",
        fontSize: 12,
        color: "var(--site-mute)",
        borderBottom: "1px solid var(--site-line)",
      }}
    >
      <span>Builder V2 blueprint preview · theme:</span>
      {THEME_SLUGS.map((slug) => (
        <Link
          key={slug}
          href={`?theme=${slug}`}
          style={chip(slug === activeTheme)}
        >
          {slug}
        </Link>
      ))}
      {pages.length > 0 && (
        <>
          <span style={{ marginLeft: 8 }}>· page:</span>
          {pages.map((p) => (
            <Link
              key={p.key}
              href={`?theme=${activeTheme}&page=${p.key}`}
              style={chip(p.key === activePage)}
            >
              {p.label}
            </Link>
          ))}
        </>
      )}
    </div>
  );
}

export default async function BuilderPreviewPage({
  searchParams,
}: {
  searchParams?: { preset?: string; theme?: string; page?: string };
}) {
  const themeSlug = searchParams?.theme;

  // ── Real theme blueprint mode ──────────────────────────────
  if (
    themeSlug &&
    THEME_SLUGS.includes(themeSlug as (typeof THEME_SLUGS)[number])
  ) {
    const blueprints = getThemeBlueprints(themeSlug);
    if (blueprints.length > 0) {
      const base = await resolveThemeBase(themeSlug);
      const chosen =
        blueprints.find((b) => b.key === searchParams?.page) ?? blueprints[0];
      return (
        <SiteThemeRoot theme={{ base }}>
          {FONT_HREFS.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <Switcher
            activeTheme={themeSlug}
            activePage={chosen.key}
            pages={blueprints.map(({ key, label }) => ({ key, label }))}
          />
          <PageDocRenderer doc={chosen.doc} device="desktop" />
        </SiteThemeRoot>
      );
    }
  }

  // ── Hand-built demo mode (token re-theming of one document) ──
  const preset = searchParams?.preset ?? "warm";
  const doc = demoDoc();
  return (
    <SiteThemeRoot theme={{ preset }}>
      <Switcher pages={[]} />
      <div
        style={{ padding: "8px 16px", fontSize: 12, color: "var(--site-mute)" }}
      >
        Demo doc · preset: <b>{preset}</b> · try ?preset=coastal — or pick a
        theme above to preview its real blueprint.
      </div>
      <PageDocRenderer
        doc={doc}
        device="desktop"
        data={sampleDataForDoc(doc)}
        brand={{
          name: "Marmalade House",
          monogram: "M",
          socials: { instagram: "marmaladehouse", facebook: "marmaladehouse" },
        }}
        menu={["Rooms", "The house", "Journal", "Find us"]}
      />
    </SiteThemeRoot>
  );
}
