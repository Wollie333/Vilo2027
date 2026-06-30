// Marmalade House QA: re-point the test-site website (from seed-test-site.mjs)
// onto the MARMALADE theme with the FULL standard page set, and add specials +
// add-ons so the data-driven sections (specials_preview, addons_preview,
// search_results) render with real content. Run AFTER seed-test-site.mjs.
//
//   node --env-file=.env.local scripts/seed-marmalade-qa.mjs   # from apps/web
//
// Idempotent: fixed UUIDs + upserts; website pages are delete-then-insert.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Missing env. Run: node --env-file=.env.local scripts/seed-marmalade-qa.mjs");
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Fixed UUIDs from seed-test-site.mjs
const HOST_ID = "0b111111-1111-4111-8111-111111111111";
const PROP = "0b222222-2222-4222-8222-222222222221";
const WEBSITE_ID = "0b999999-9999-4999-8999-999999999991";
const SITE_NAME = "Olive Grove Guesthouse";
const nowIso = () => new Date().toISOString();

const sec = (type, props) => ({ id: randomUUID(), type, enabled: true, props });

// Default spine for the search-results system page Marmalade's blueprint omits
// (its blueprint already ships specials/experiences/gallery, so those are skipped).
const SEARCH_RESULTS_SECTIONS = [
  sec("search_results", { heading: "Free for your dates", body: "Choose your dates and we’ll show you what’s open — booked direct, the price you see is the price you pay." }),
];

async function main() {
  console.log(`Marmalade House QA seed → ${URL}`);

  // businessId
  const { data: biz } = await admin
    .from("businesses").select("id").eq("host_id", HOST_ID).eq("is_default", true).maybeSingle();
  const businessId = biz?.id;
  if (!businessId) throw new Error("No business for test host — run seed-test-site.mjs first.");

  // Marmalade theme (base + blueprint)
  const { data: theme } = await admin
    .from("site_themes").select("slug, base, page_templates").eq("slug", "marmalade").maybeSingle();
  if (!theme) throw new Error("Marmalade theme not found in site_themes.");
  const blueprint = Array.isArray(theme.page_templates) ? theme.page_templates : [];

  // Point the website at Marmalade
  await admin.from("host_websites").update({
    status: "published",
    published_at: nowIso(),
    theme: theme.base ? { preset: "marmalade", base: theme.base } : { preset: "marmalade" },
    published_snapshot: null, // force the renderer to read live columns
  }).eq("id", WEBSITE_ID);

  // Rebuild pages: Marmalade blueprint + the search-results page it omits.
  await admin.from("website_pages").delete().eq("website_id", WEBSITE_ID);
  const rows = blueprint.map((tpl) => ({
    website_id: WEBSITE_ID,
    kind: tpl.kind,
    slug: tpl.slug,
    title: tpl.title === "Home" ? SITE_NAME : tpl.title,
    nav_label: tpl.nav_label,
    nav_order: tpl.nav_order,
    show_in_nav: tpl.show_in_nav,
    draft_sections: tpl.sections ?? [],
    published_sections: tpl.sections ?? [],
  }));
  const haveKinds = new Set(blueprint.map((t) => t.kind));
  const add = (kind, slug, title, nav_label, nav_order, show_in_nav, sections) => {
    if (haveKinds.has(kind)) return;
    rows.push({ website_id: WEBSITE_ID, kind, slug, title, nav_label, nav_order, show_in_nav, draft_sections: sections, published_sections: sections });
  };
  add("search_results", "search-results", "Search results", "Search results", 905, false, SEARCH_RESULTS_SECTIONS);
  await admin.from("website_pages").insert(rows);
  console.log(`   seeded ${rows.length} pages on Marmalade House`);

  // Specials (active, show_on_website) — flexible window in the future.
  const SPECIAL_IDS = [
    "0b5ec000-0000-4000-8000-0000000000a1",
    "0b5ec000-0000-4000-8000-0000000000a2",
  ];
  await admin.from("specials").delete().in("id", SPECIAL_IDS);
  await admin.from("specials").insert([
    {
      id: SPECIAL_IDS[0], host_id: HOST_ID, business_id: businessId, property_id: PROP,
      slug: "long-weekend", title: "The long weekend", description: "Book three nights or more and the third is on the house — any room, any season.",
      badge: "Stay 3, pay 2", date_mode: "flexible", window_start: "2026-07-01", window_end: "2026-08-31", min_nights: 3,
      price_mode: "per_night", per_night_price: 1450, currency: "ZAR", was_price: 2175, savings_pct: 33,
      quantity: 20, redemptions_used: 2, status: "active", show_on_website: true, is_featured: true, sort_order: 0,
    },
    {
      id: SPECIAL_IDS[1], host_id: HOST_ID, business_id: businessId, property_id: PROP,
      slug: "midweek-quiet", title: "Midweek & quiet", description: "Arrive Sunday to Thursday and take 15% off, with a slow checkout until noon.",
      badge: "Sun–Thu", date_mode: "flexible", window_start: "2026-07-01", window_end: "2026-10-31", min_nights: 2,
      price_mode: "per_night", per_night_price: 1400, currency: "ZAR", was_price: 1650, savings_pct: 15,
      quantity: 30, redemptions_used: 0, status: "active", show_on_website: true, is_featured: false, sort_order: 1,
    },
  ]);
  console.log("   seeded 2 specials");

  // Add-ons (+ property links)
  const ADDONS = [
    { id: "0badd000-0000-4000-8000-00000000a001", name: "A Swartberg picnic", description: "A basket for two for the pass — bread, cheese, fig jam and a flask.", pricing_model: "per_stay", unit_price: 280, image: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600" },
    { id: "0badd000-0000-4000-8000-00000000a002", name: "Jars to take home", description: "Three jars of Hannah’s fig & orange jam, wrapped for the road.", pricing_model: "per_stay", unit_price: 180, image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600" },
    { id: "0badd000-0000-4000-8000-00000000a003", name: "Private stargazing", description: "An hour on the stoep with Pieter and the telescope, weather willing.", pricing_model: "per_stay", unit_price: 350, image: "https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=600" },
  ];
  await admin.from("property_addons").delete().eq("property_id", PROP);
  await admin.from("addons").delete().in("id", ADDONS.map((a) => a.id));
  for (const a of ADDONS) {
    await admin.from("addons").insert({
      id: a.id, host_id: HOST_ID, name: a.name, description: a.description, image_path: a.image,
      pricing_model: a.pricing_model, unit_price: a.unit_price, currency: "ZAR",
      min_quantity: 1, is_required: false, is_active: true, allow_custom_quantity: true, sort_order: 0,
    });
    await admin.from("property_addons").insert({ id: randomUUID(), property_id: PROP, addon_id: a.id, room_id: null });
  }
  console.log(`   seeded ${ADDONS.length} add-ons`);

  console.log("\n✅ Marmalade House QA seed complete.");
  console.log("   Public site:  http://localhost:3000/en/site?site=vilotest");
  console.log("   Pages: home/rooms/offers/things-to-do/gallery/the-house/journal/contact + search-results + checkout/thank-you");
}

main().catch((e) => { console.error("\n❌", e.message ?? e); process.exit(1); });
