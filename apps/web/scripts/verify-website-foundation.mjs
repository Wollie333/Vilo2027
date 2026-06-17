// Live-DB sweep for the Website CMS Phase 1 data foundation: validates every
// new table + its column names against the real schema (limit(1) checks names
// without needing data), plus the website-assets storage bucket.
// Run: node --env-file=.env.local scripts/verify-website-foundation.mjs
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

const checks = [
  ["host_websites", () =>
    sb.from("host_websites").select(
      "id, business_id, host_id, subdomain, custom_domain, domain_status, ssl_status, verification_token, status, brand, theme, seo, settings, published_snapshot, published_at, deleted_at",
    ).limit(1)],
  ["website_pages", () =>
    sb.from("website_pages").select(
      "id, website_id, kind, slug, title, nav_label, nav_order, show_in_nav, draft_sections, published_sections, seo_overrides",
    ).limit(1)],
  ["website_properties", () =>
    sb.from("website_properties").select(
      "id, website_id, property_id, is_visible, sort_order, display_overrides",
    ).limit(1)],
  ["website_rooms", () =>
    sb.from("website_rooms").select(
      "id, website_id, room_id, is_visible, display_name, display_price, display_currency, display_desc, sort_order",
    ).limit(1)],
  ["website_blog_categories", () =>
    sb.from("website_blog_categories").select("id, website_id, name, slug, sort_order").limit(1)],
  ["website_blog_posts", () =>
    sb.from("website_blog_posts").select(
      "id, website_id, category_id, title, slug, status, publish_at, cover_path, excerpt, body_html, seo, author_name, deleted_at",
    ).limit(1)],
  ["website_domain_events", () =>
    sb.from("website_domain_events").select("id, website_id, event, detail, created_at").limit(1)],
  ["host_websites→businesses embed", () =>
    sb.from("host_websites").select("id, business:businesses ( id, trading_name )").limit(1)],
  ["website_properties→properties embed", () =>
    sb.from("website_properties").select("id, property:properties ( id, name )").limit(1)],
  ["plan_features website keys", () =>
    sb.from("plan_features").select("plan, feature_key, is_enabled")
      .in("feature_key", ["website_builder", "website_blog", "website_custom_domain", "custom_website_design"])],
];

let failed = 0;
for (const [label, run] of checks) {
  const { error, data } = await run();
  if (error) {
    failed++;
    console.log(`❌ ${label}: ${error.message}`);
  } else {
    const extra = label.startsWith("plan_features") ? ` (${data.length} rows)` : "";
    console.log(`✅ ${label}${extra}`);
  }
}

// Storage bucket exists + public
const { data: bucket, error: bErr } = await sb.storage.getBucket("website-assets");
if (bErr || !bucket) {
  failed++;
  console.log(`❌ website-assets bucket: ${bErr?.message ?? "missing"}`);
} else {
  console.log(`✅ website-assets bucket (public=${bucket.public})`);
}

console.log(failed === 0 ? "\n🎉 All website-foundation checks green." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
