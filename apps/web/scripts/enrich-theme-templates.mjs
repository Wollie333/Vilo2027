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
  await admin.from("site_themes").update({ page_templates: pages }).eq("slug", slug);
  console.log(`  ${slug}: hero image ${hero ? "set" : "MISSING"} (${changed} section${changed === 1 ? "" : "s"} patched)`);
}

console.log("Enriching theme templates with stock images…");
for (const slug of ["safari", "sabela", "oceansview", "marmalade"]) await enrich(slug);
console.log("Done.");
