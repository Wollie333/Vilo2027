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
  sabela: U("photo-1516426122078-c23e76319801"),
  oceansview: U("photo-1507525428034-b723cf961d3e"),
  marmalade: U("photo-1505691938895-1758d7feb511"),
};

// HOME "story" intro band → 2-col photo + floating stat badge (variant "story").
const STORY = {
  safari: { img: U("photo-1582719478250-c89cae4dc85b", 1200), badge_value: "2009", badge_label: "Family-run since" },
  sabela: { img: U("photo-1504280390367-361c6d9f38f4", 1200), badge_value: "12,000", badge_label: "Hectares rewilded" },
  oceansview: { img: U("photo-1520250497591-112f2f40a3f4", 1200), badge_value: "3", badge_label: "Ocean pools" },
  marmalade: { img: U("photo-1505693416388-ac5ce068fe85", 1200), badge_value: "1873", badge_label: "A restored parsonage" },
};

// HOME closing CTA band → full-bleed photo band + scrim (banner variant).
const CTA = {
  safari: U("photo-1469474968028-56623f02e42e", 2000),
  sabela: U("photo-1516426122078-c23e76319801", 2000),
  oceansview: U("photo-1507525428034-b723cf961d3e", 2000),
  marmalade: U("photo-1505691938895-1758d7feb511", 2000),
};

async function enrich(slug) {
  const { data: theme } = await admin.from("site_themes").select("page_templates").eq("slug", slug).maybeSingle();
  if (!theme) { console.log(`  ${slug}: not found`); return; }
  const pages = Array.isArray(theme.page_templates) ? theme.page_templates : [];
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
  await admin.from("site_themes").update({ page_templates: pages }).eq("slug", slug);
  console.log(`  ${slug}: hero image ${hero ? "set" : "MISSING"} (${changed} section${changed === 1 ? "" : "s"} patched)`);
}

console.log("Enriching theme templates with stock images…");
for (const slug of ["safari", "sabela", "oceansview", "marmalade"]) await enrich(slug);
console.log("Done.");
