// Oceans View QA: re-point the test-site website (from seed-test-site.mjs) onto the
// OCEANSVIEW theme with the FULL standard page set, and add specials + add-ons so the
// new data-driven sections (specials_preview, addons_preview, search_results)
// render with real content. Run AFTER seed-test-site.mjs.
//
//   node --env-file=.env.local scripts/seed-oceansview-qa.mjs   # from apps/web
//
// Idempotent: fixed UUIDs + upserts; website pages are delete-then-insert.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Missing env. Run: node --env-file=.env.local scripts/seed-oceansview-qa.mjs");
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Fixed UUIDs from seed-test-site.mjs
const HOST_ID = "0b111111-1111-4111-8111-111111111111";
const PROP = "0b222222-2222-4222-8222-222222222221";
const ROOM_1 = "0b333333-3333-4333-8333-333333333331";
const WEBSITE_ID = "0b999999-9999-4999-8999-999999999991";
const SITE_NAME = "Olive Grove Guesthouse";
const nowIso = () => new Date().toISOString();

const sec = (type, props) => ({ id: randomUUID(), type, enabled: true, props });

// Default spines for the 4 standard pages Oceans View's blueprint doesn't ship.
const SPECIALS_SECTIONS = [
  sec("intro", { heading: "Special offers", body: "Limited-time deals — book direct for the best rate.", variant: "centered" }),
  sec("specials_preview", { heading: "Current specials", max: 12 }),
  sec("cta", { heading: "Don’t see your dates?", body: "Get in touch and we’ll help you find the right stay.", button_label: "Contact us", button_href: "/contact" }),
];
const EXPERIENCES_SECTIONS = [
  sec("intro", { heading: "Things to do", body: "Make the most of your stay — here’s what awaits beyond your room.", variant: "centered" }),
  sec("highlights", { heading: "Experiences", variant: "grid", items: [
    { icon: "Sunrise", title: "Game drives", body: "Dawn and dusk on the reserve with an expert guide and tracker." },
    { icon: "Footprints", title: "Guided walks", body: "Read the tracks on foot, the bush at its smallest and wildest." },
    { icon: "Flame", title: "Boma evenings", body: "Dinner under the stars around an open fire." },
  ] }),
  sec("gallery", { heading: "A taste of it" }),
  sec("cta", { heading: "Plan your stay around it", body: "Reserve your dates and we’ll help with the rest.", button_label: "Check availability", button_href: "/rooms" }),
];
const GALLERY_SECTIONS = [
  sec("intro", { heading: "Gallery", body: "A closer look at the rooms, the spaces, and the surroundings.", variant: "centered" }),
  sec("gallery", { heading: "" }),
  sec("cta", { heading: "Like what you see?", body: "Check availability and book your stay directly.", button_label: "Check availability", button_href: "/rooms" }),
];
const SEARCH_RESULTS_SECTIONS = [
  sec("search_results", { heading: "Available stays", body: "Choose your dates to see what’s open — book direct for the best rate." }),
];

async function main() {
  console.log(`Oceans View QA seed → ${URL}`);

  // businessId
  const { data: biz } = await admin
    .from("businesses").select("id").eq("host_id", HOST_ID).eq("is_default", true).maybeSingle();
  const businessId = biz?.id;
  if (!businessId) throw new Error("No business for test host — run seed-test-site.mjs first.");

  // Oceans View theme (base + blueprint)
  const { data: theme } = await admin
    .from("site_themes").select("slug, base, page_templates").eq("slug", "oceansview").maybeSingle();
  if (!theme) throw new Error("Oceans View theme not found in site_themes.");
  const blueprint = Array.isArray(theme.page_templates) ? theme.page_templates : [];

  // Point the website at Oceans View
  await admin.from("host_websites").update({
    status: "published",
    published_at: nowIso(),
    theme: theme.base ? { preset: "oceansview", base: theme.base } : { preset: "oceansview" },
    published_snapshot: null, // force the renderer to read live columns
  }).eq("id", WEBSITE_ID);

  // Rebuild pages: Oceans View blueprint + the 4 standard pages it omits.
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
  add("specials", "specials", "Specials", "Specials", 5, true, SPECIALS_SECTIONS);
  add("experiences", "experiences", "Experiences", "Experiences", 6, true, EXPERIENCES_SECTIONS);
  add("gallery", "gallery", "Gallery", "Gallery", 7, true, GALLERY_SECTIONS);
  add("search_results", "search-results", "Search results", "Search results", 905, false, SEARCH_RESULTS_SECTIONS);
  await admin.from("website_pages").insert(rows);
  console.log(`   seeded ${rows.length} pages on Oceans View`);

  // Specials (active, show_on_website) — flexible window in the future.
  const SPECIAL_IDS = [
    "0b5ec000-0000-4000-8000-0000000000a1",
    "0b5ec000-0000-4000-8000-0000000000a2",
  ];
  await admin.from("specials").delete().in("id", SPECIAL_IDS);
  await admin.from("specials").insert([
    {
      id: SPECIAL_IDS[0], host_id: HOST_ID, business_id: businessId, property_id: PROP,
      slug: "winter-escape", title: "Winter escape — 3 nights", description: "Three slow winter nights with breakfast and a bottle of estate red on arrival.",
      badge: "Save 15%", date_mode: "flexible", window_start: "2026-07-01", window_end: "2026-08-31", min_nights: 3,
      price_mode: "per_night", per_night_price: 2200, currency: "ZAR", was_price: 2600, savings_pct: 15,
      quantity: 20, redemptions_used: 2, status: "active", show_on_website: true, is_featured: true, sort_order: 0,
    },
    {
      id: SPECIAL_IDS[1], host_id: HOST_ID, business_id: businessId, property_id: PROP,
      slug: "midweek-retreat", title: "Midweek retreat", description: "Tuesday–Thursday, the whole house to yourselves at a quiet-season rate.",
      badge: "Midweek", date_mode: "flexible", window_start: "2026-07-01", window_end: "2026-10-31", min_nights: 2,
      price_mode: "per_night", per_night_price: 2400, currency: "ZAR", quantity: 30, redemptions_used: 0,
      status: "active", show_on_website: true, is_featured: false, sort_order: 1,
    },
  ]);
  console.log("   seeded 2 specials");

  // Add-ons (+ property links)
  const ADDONS = [
    { id: "0badd000-0000-4000-8000-00000000a001", name: "Breakfast hamper", description: "Farm eggs, estate olives, fresh bread and good coffee, delivered to your door.", pricing_model: "per_guest_per_night", unit_price: 180, image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600" },
    { id: "0badd000-0000-4000-8000-00000000a002", name: "Sunset game drive", description: "Two hours on the reserve with a guide as the light goes gold.", pricing_model: "per_guest", unit_price: 650, image: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600" },
    { id: "0badd000-0000-4000-8000-00000000a003", name: "Airport transfer", description: "Private return transfer from Cape Town International.", pricing_model: "per_stay", unit_price: 1400, image: null },
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

  console.log("\n✅ Oceans View QA seed complete.");
  console.log("   Public site:  http://localhost:3000/en/site?site=vilotest");
  console.log("   Pages: home/about/suites/contact/journal + specials/experiences/gallery + search-results + checkout/thank-you");
}

main().catch((e) => { console.error("\n❌", e.message ?? e); process.exit(1); });
