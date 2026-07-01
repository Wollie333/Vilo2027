import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { PageDocRenderer } from "@/components/site/v2/PageDocRenderer";
import {
  newPageDoc,
  newSection,
  newWidget,
} from "@/lib/website/widgets/factories";
import type { WidgetNode } from "@/lib/website/pageDoc.schema";

// Builder V2 — DEV-ONLY preview of the token-driven PageDoc renderer.
// Renders a demo document (structure + all five new leaves) inside the theme
// token layer so the new render can be verified live before the real builder
// route exists. Switch palette with ?preset=warm|coastal. Remove at cutover.
export const dynamic = "force-dynamic";

function w(
  type: Parameters<typeof newWidget>[0],
  props: Record<string, unknown>,
  variant?: string,
): WidgetNode {
  const node = newWidget(type, props);
  if (variant) node.variant = variant;
  return node;
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
  const s4 = newSection([4, 4, 4], { tone: "dark", valign: "center" });
  s4.kids[0].kids.push(w("el_logo", { style: "markName", align: "left" }));
  s4.kids[1].kids.push(
    w(
      "el_nav",
      {
        source: "custom",
        items: "Rooms, The house, Journal, Find us",
        align: "center",
      },
      "underline",
    ),
  );
  s4.kids[2].kids.push(
    w(
      "el_social",
      { source: "custom", networks: "instagram, facebook, x", align: "right" },
      "round",
    ),
  );
  doc.root.kids.push(s4);

  // 4b — an auto-populate widget with NO SiteData: must degrade gracefully
  // (render its heading / empty state, never crash). Live data lands in Phase 5.
  const s4b = newSection([12], { tone: "muted" });
  s4b.kids[0].kids.push(
    w("rooms_preview", { heading: "Pick a room, any room", max: 3 }, "grid"),
  );
  doc.root.kids.push(s4b);

  // 5 — two room cards (variants)
  const s5 = newSection([6, 6]);
  s5.kids[0].kids.push(w("el_room_card", {}, "postcard"));
  s5.kids[1].kids.push(w("el_room_card", {}, "clean"));
  doc.root.kids.push(s5);

  return doc;
}

export default function BuilderPreviewPage({
  searchParams,
}: {
  searchParams?: { preset?: string };
}) {
  const preset = searchParams?.preset ?? "warm";
  return (
    <SiteThemeRoot theme={{ preset }}>
      <div
        style={{ padding: "8px 16px", fontSize: 12, color: "var(--site-mute)" }}
      >
        Builder V2 preview · preset: <b>{preset}</b> · try ?preset=coastal
      </div>
      <PageDocRenderer doc={demoDoc()} device="desktop" />
    </SiteThemeRoot>
  );
}
