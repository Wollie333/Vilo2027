// Enrich each theme's `site_themes.page_templates` with the STOCK IMAGES from the
// original bespoke designs (recovered from git @57e262da^), so the theme PREVIEW
// + activation render the designed photo layouts instead of flat colour bands.
// Idempotent: re-running just re-sets the same image_path values. Extend the
// per-slice maps below as more sections gain image support.
//
//   node --env-file=.env.local scripts/enrich-theme-templates.mjs   # from apps/web
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const U = (id, w = 2400) => `https://images.unsplash.com/${id}?w=${w}&q=80`;

// Per-theme HOME hero background photo (from the deleted <Theme>Sections.tsx).
const HERO = {
  safari: U("photo-1516426122078-c23e76319801"),
  hotel: U("photo-1516426122078-c23e76319801"),
  oceansview: U("photo-1507525428034-b723cf961d3e"),
  marmalade: U("photo-1505691938895-1758d7feb511"),
};

// HOME "story" intro band → 2-col photo + floating stat badge (variant "story").
const STORY = {
  safari: { img: U("photo-1582719478250-c89cae4dc85b", 1200), badge_value: "2009", badge_label: "Family-run since" },
  hotel: { img: U("photo-1504280390367-361c6d9f38f4", 1200), badge_value: "12,000", badge_label: "Hectares rewilded" },
  oceansview: { img: U("photo-1520250497591-112f2f40a3f4", 1200), badge_value: "3", badge_label: "Ocean pools" },
  marmalade: { img: U("photo-1505693416388-ac5ce068fe85", 1200), badge_value: "1873", badge_label: "A restored parsonage" },
};

// HOME closing CTA band → full-bleed photo band + scrim (banner variant).
const CTA = {
  safari: U("photo-1469474968028-56623f02e42e", 2000),
  hotel: U("photo-1516426122078-c23e76319801", 2000),
  oceansview: U("photo-1507525428034-b723cf961d3e", 2000),
  marmalade: U("photo-1505691938895-1758d7feb511", 2000),
};

// HOME gallery → mosaic layout + STOCK demo photos (order = mosaic; tile 1 = 2x2).
// Live host photos swap over these on the real site.
const galleryImgs = (ids) => ids.map((id) => ({ url: U(id, 1100) }));
const GALLERY = {
  safari: galleryImgs(["photo-1547721064-da6cfb341d50", "photo-1546182990-dffeafbe841d", "photo-1501706362039-c06b2d715385", "photo-1611892440504-42a792e24d32", "photo-1500382017468-9049fed747ef", "photo-1469474968028-56623f02e42e", "photo-1502920514313-52581002a659"]),
  hotel: galleryImgs(["photo-1547721064-da6cfb341d50", "photo-1546182990-dffeafbe841d", "photo-1501706362039-c06b2d715385", "photo-1611892440504-42a792e24d32", "photo-1500382017468-9049fed747ef", "photo-1469474968028-56623f02e42e", "photo-1502920514313-52581002a659"]),
  oceansview: galleryImgs(["photo-1505228395891-9a51e7e86bf6", "photo-1519046904884-53103b34b206", "photo-1507525428034-b723cf961d3e", "photo-1535262412227-85541e910204", "photo-1473116763249-2faaef81ccda", "photo-1468413253725-0d5181091126", "photo-1519046904884-53103b34b206"]),
  marmalade: galleryImgs(["photo-1522708323590-d24dbb6b0267", "photo-1470337458703-46ad1756a187", "photo-1505691938895-1758d7feb511", "photo-1416879595882-3373a0480b5b", "photo-1502602898657-3e91760cbb34", "photo-1466692476868-aef1dfb1e735", "photo-1560185007-cde436f6a4d0"]),
};

// Highlight/amenity cards render `item.icon` as a literal glyph (emoji/char), so
// any lucide icon *name* left in the seed shows as raw text ("Waves"). Normalise
// the known names to emoji across every page's item lists. Idempotent.
const ICON_GLYPHS = {
  Waves: "🌊", Utensils: "🍽️", Sparkles: "💆", Sunrise: "🌅", Sunset: "🌇",
  Moon: "🌙", Flame: "🔥", Footprints: "👣", Sun: "☀️", Wine: "🍷",
  Wifi: "📶", Coffee: "☕", Waves2: "🌊", Fish: "🐟", Anchor: "⚓",
};
function normaliseIcons(pages) {
  let n = 0;
  for (const p of pages)
    for (const sec of p.sections || []) {
      const items = sec.props?.items;
      if (!Array.isArray(items)) continue;
      for (const it of items)
        if (it && ICON_GLYPHS[it.icon]) { it.icon = ICON_GLYPHS[it.icon]; n++; }
    }
  return n;
}

async function enrich(slug) {
  const { data: theme } = await admin.from("site_themes").select("page_templates").eq("slug", slug).maybeSingle();
  if (!theme) { console.log(`  ${slug}: not found`); return; }
  const pages = Array.isArray(theme.page_templates) ? theme.page_templates : [];
  const iconFixes = normaliseIcons(pages);
  const home = pages.find((p) => p.kind === "home");
  if (!home) { console.log(`  ${slug}: no home page`); return; }
  const secs = Array.isArray(home.sections) ? home.sections : [];
  const hero = secs.find((s) => s.type === "hero");
  let changed = 0;
  if (hero && HERO[slug]) {
    hero.props = hero.props || {};
    hero.props.image_path = HERO[slug];
    // A photo hero needs a scrim + light text to stay legible.
    hero.props.overlay = hero.props.overlay || "strong";
    hero.props.textTone = "light";
    changed++;
  }
  const story = secs.find((s) => s.type === "intro");
  if (story && STORY[slug]) {
    story.props = story.props || {};
    story.props.variant = "story";
    story.props.image_path = STORY[slug].img;
    story.props.badge_value = STORY[slug].badge_value;
    story.props.badge_label = STORY[slug].badge_label;
    changed++;
  }
  // The closing CTA is the LAST cta on the home page (banner).
  const ctas = secs.filter((s) => s.type === "cta");
  const cta = ctas[ctas.length - 1];
  if (cta && CTA[slug]) {
    cta.props = cta.props || {};
    cta.props.variant = "banner";
    cta.props.image_path = CTA[slug];
    changed++;
  }
  const gallery = secs.find((s) => s.type === "gallery");
  if (gallery && GALLERY[slug]) {
    gallery.props = gallery.props || {};
    gallery.props.layout = "mosaic";
    gallery.props.images = GALLERY[slug];
    changed++;
  }
  // EXPERIENCES page → the highlights grid already carries per-item photos, so
  // render them as image-backed tiles (the designed layout) rather than flat
  // cards. Only promote when every item actually has an image to show.
  const exp = pages.find((p) => p.kind === "experiences" || p.slug === "experiences");
  const expHl = exp?.sections?.find((s) => s.type === "highlights");
  const expItems = expHl?.props?.items;
  if (expHl && Array.isArray(expItems) && expItems.length && expItems.every((it) => it?.image_path)) {
    expHl.props.variant = "tiles";
    changed++;
  }
  await admin.from("site_themes").update({ page_templates: pages }).eq("slug", slug);
  console.log(`  ${slug}: hero image ${hero ? "set" : "MISSING"} (${changed} section${changed === 1 ? "" : "s"} patched, ${iconFixes} icon${iconFixes === 1 ? "" : "s"} normalised)`);
}

console.log("Enriching theme templates with stock images…");
for (const slug of ["safari", "hotel", "oceansview", "marmalade"]) await enrich(slug);
console.log("Done.");
