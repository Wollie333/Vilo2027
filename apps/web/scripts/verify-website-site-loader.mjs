// W4 verification: (1) sweep every query/embed loadSitePage.ts relies on against
// the real schema (limit(1) → validates names without needing data); (2) seed a
// minimal demo site (host_websites + home page + website_properties + website_rooms)
// for an existing property, then replicate the loader's resolution to confirm it
// returns a page with sections + assembled auto-populate data.
// Run: node --env-file=.env.local scripts/verify-website-site-loader.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failed = 0;
const ok = (m) => console.log(`✅ ${m}`);
const bad = (m) => {
  failed++;
  console.log(`❌ ${m}`);
};

// ── Part A: query/embed sweep (mirrors loadSitePage.ts) ───────
const sweeps = [
  ["host_websites + business embed", () =>
    sb.from("host_websites").select("id, business_id, status, subdomain, custom_domain, brand, theme, deleted_at, business:businesses ( default_language, trading_name )").limit(1)],
  ["website_pages chrome", () =>
    sb.from("website_pages").select("kind, slug, nav_label, title, nav_order, show_in_nav, draft_sections, published_sections, seo_overrides").limit(1)],
  ["website_properties", () =>
    sb.from("website_properties").select("property_id, sort_order, is_visible").limit(1)],
  ["website_rooms + room embed", () =>
    sb.from("website_rooms").select("room_id, is_visible, display_name, display_price, display_currency, display_desc, sort_order, room:property_rooms ( id, name, description, base_price, currency, property_id, is_active, deleted_at )").limit(1)],
  ["property_photos by room", () =>
    sb.from("property_photos").select("url, room_id, sort_order, property_id").limit(1)],
  ["property_points_of_interest", () =>
    sb.from("property_points_of_interest").select("name, category, travel_time, sort_order, property_id").limit(1)],
  ["reviews + guest/booking embed", () =>
    sb.from("reviews").select("rating, body, created_at, guest:user_profiles!reviews_guest_id_fkey ( full_name ), booking:bookings ( guest_name )").limit(1)],
  ["website_blog_posts", () =>
    sb.from("website_blog_posts").select("title, slug, excerpt, cover_path, body_html, publish_at, created_at, author_name, status, deleted_at").limit(1)],
];
for (const [label, run] of sweeps) {
  const { error } = await run();
  if (error) bad(`${label}: ${error.message}`);
  else ok(label);
}

// ── Part B: seed a demo site + replicate resolution ───────────
const SUB = "demo-site";

const { data: prop } = await sb
  .from("properties")
  .select("id, name, slug, host_id, business_id, city, province, country")
  .not("business_id", "is", null)
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();

if (!prop) {
  console.log("\n⚠️  No property with a business found — run `pnpm seed:demo` first. Skipping seed/resolve.");
  console.log(failed === 0 ? "\nSweep green." : `\n${failed} sweep check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

// host_websites is unique per business — reuse if one exists, else create.
let { data: site } = await sb
  .from("host_websites")
  .select("id")
  .eq("business_id", prop.business_id)
  .maybeSingle();

if (!site) {
  const ins = await sb
    .from("host_websites")
    .insert({
      business_id: prop.business_id,
      host_id: prop.host_id,
      subdomain: SUB,
      status: "published",
      brand: { name: prop.name, tagline: "Direct bookings" },
      theme: { preset: "coastal" },
    })
    .select("id")
    .single();
  if (ins.error) bad(`seed host_websites: ${ins.error.message}`);
  site = ins.data;
} else {
  await sb.from("host_websites").update({ status: "published", theme: { preset: "coastal" } }).eq("id", site.id);
}

if (site) {
  const uuid = () => globalThis.crypto.randomUUID();
  const sections = [
    { id: uuid(), type: "hero", enabled: true, props: { headline: prop.name, subheadline: "Book direct", align: "center" } },
    { id: uuid(), type: "gallery", enabled: true, props: { layout: "grid", max: 12 } },
    { id: uuid(), type: "rooms_preview", enabled: true, props: { heading: "Rooms", max: 6 } },
    { id: uuid(), type: "location", enabled: true, props: { heading: "Where you'll be", show_map: false } },
    { id: uuid(), type: "reviews", enabled: true, props: { heading: "Reviews", max: 6 } },
  ];

  // Upsert home page.
  const { data: existingPage } = await sb
    .from("website_pages")
    .select("id")
    .eq("website_id", site.id)
    .eq("slug", "home")
    .maybeSingle();
  if (existingPage) {
    await sb.from("website_pages").update({ draft_sections: sections, published_sections: sections }).eq("id", existingPage.id);
  } else {
    const p = await sb.from("website_pages").insert({
      website_id: site.id, kind: "home", slug: "home", title: prop.name,
      nav_label: "Home", nav_order: 0, show_in_nav: true,
      draft_sections: sections, published_sections: sections,
    });
    if (p.error) bad(`seed home page: ${p.error.message}`);
  }

  // Channel membership.
  await sb.from("website_properties").upsert(
    { website_id: site.id, property_id: prop.id, is_visible: true, sort_order: 0 },
    { onConflict: "website_id,property_id" },
  );
  const { data: rooms } = await sb
    .from("property_rooms")
    .select("id")
    .eq("property_id", prop.id)
    .is("deleted_at", null)
    .limit(10);
  for (const [i, r] of (rooms ?? []).entries()) {
    await sb.from("website_rooms").upsert(
      { website_id: site.id, room_id: r.id, is_visible: true, sort_order: i },
      { onConflict: "website_id,room_id" },
    );
  }

  // Replicate loadSiteContext: resolve by subdomain.
  const { data: ctx, error: ctxErr } = await sb
    .from("host_websites")
    .select("id, status, subdomain, business:businesses ( default_language )")
    .or(`subdomain.eq.${SUB},custom_domain.eq.${SUB}`)
    .is("deleted_at", null)
    .maybeSingle();
  if (ctxErr || !ctx) bad(`resolve context by subdomain: ${ctxErr?.message ?? "not found"}`);
  else ok(`resolved site '${SUB}' (status=${ctx.status}, locale=${ctx.business?.default_language ?? "en"})`);

  // Replicate loadSitePage: fetch home + count sections + assemble gallery/rooms.
  const { data: home } = await sb
    .from("website_pages")
    .select("published_sections")
    .eq("website_id", site.id)
    .eq("kind", "home")
    .maybeSingle();
  const secCount = Array.isArray(home?.published_sections) ? home.published_sections.length : 0;
  secCount > 0 ? ok(`home page has ${secCount} published sections`) : bad("home page has no sections");

  const { data: photos } = await sb.from("property_photos").select("url").eq("property_id", prop.id).limit(60);
  const { data: wrooms } = await sb
    .from("website_rooms")
    .select("room_id, room:property_rooms ( name, base_price )")
    .eq("website_id", site.id)
    .eq("is_visible", true);
  ok(`assembled data: ${photos?.length ?? 0} gallery photos, ${wrooms?.length ?? 0} visible rooms (property '${prop.name}')`);
}

console.log(failed === 0 ? "\n🎉 W4 site loader verification green." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
