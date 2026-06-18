// Live-DB check for W11 (Blog). Confirms the columns the blog loaders/actions
// rely on read, round-trips a post (insert → publish → soft-delete) and a
// category on a real site without leaving residue, and checks the help article.
// Net read-only (probe rows removed). Run:
//   node --env-file=.env.local scripts/verify-website-blog.mjs
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

let failed = false;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  failed = true;
  console.error(`  ✗ ${m}`);
};

// 1. The columns the post loader/editor selects must exist.
const { error: postColErr } = await sb
  .from("website_blog_posts")
  .select(
    "id, website_id, category_id, title, slug, status, publish_at, cover_path, excerpt, body_html, author_name, seo, updated_at, deleted_at",
  )
  .limit(1);
if (postColErr) bad(`website_blog_posts columns: ${postColErr.message}`);
else ok("website_blog_posts exposes all editor columns");

const { error: catColErr } = await sb
  .from("website_blog_categories")
  .select("id, website_id, name, slug, sort_order")
  .limit(1);
if (catColErr) bad(`website_blog_categories columns: ${catColErr.message}`);
else ok("website_blog_categories exposes all editor columns");

// 2. The list join (post ⨝ category) reads (PGRST embed sanity).
const { error: joinErr } = await sb
  .from("website_blog_posts")
  .select("id, category:website_blog_categories ( id, name )")
  .limit(1);
if (joinErr) bad(`post→category embed: ${joinErr.message}`);
else ok("post → category embed resolves");

// 3. Post + category round-trip on a real site.
const { data: site } = await sb
  .from("host_websites")
  .select("id")
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();

if (!site) {
  console.log("  • no host_websites row yet — skipping round-trip");
} else {
  // Category insert.
  const { data: cat, error: catErr } = await sb
    .from("website_blog_categories")
    .insert({ website_id: site.id, name: "__w11_probe", slug: "__w11-probe" })
    .select("id")
    .single();
  if (catErr) bad(`insert category: ${catErr.message}`);

  // Post insert → publish → category link.
  const { data: post, error: insErr } = await sb
    .from("website_blog_posts")
    .insert({
      website_id: site.id,
      title: "__w11 probe post",
      slug: "__w11-probe-post",
      status: "draft",
      category_id: cat?.id ?? null,
      seo: { title: "t", description: "d" },
    })
    .select("id")
    .single();
  if (insErr) bad(`insert post: ${insErr.message}`);

  if (post) {
    const { error: pubErr } = await sb
      .from("website_blog_posts")
      .update({ status: "published", publish_at: new Date().toISOString() })
      .eq("id", post.id);
    if (pubErr) bad(`publish post: ${pubErr.message}`);

    // Public read path: published, not soft-deleted, for this site.
    const { data: live } = await sb
      .from("website_blog_posts")
      .select("id, status")
      .eq("website_id", site.id)
      .eq("status", "published")
      .is("deleted_at", null)
      .eq("id", post.id)
      .maybeSingle();
    if (live) ok("published post is visible to the public read path");
    else bad("published probe post not visible to public read path");

    // Soft delete → drops out of both editor + public lists.
    await sb
      .from("website_blog_posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", post.id);
    const { data: gone } = await sb
      .from("website_blog_posts")
      .select("id")
      .eq("id", post.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!gone) ok("soft-deleted post drops from the active list");
    else bad("soft-deleted post still active");

    // Hard-remove the probe rows (test residue, not real data).
    await sb.from("website_blog_posts").delete().eq("id", post.id);
  }
  if (cat) await sb.from("website_blog_categories").delete().eq("id", cat.id);
  ok("probe rows cleaned up");
}

// 4. Help article landed.
const { data: help } = await sb
  .from("help_articles")
  .select("slug, status")
  .eq("slug", "website-blog")
  .maybeSingle();
if (help?.status === "published") ok("help article website-blog published");
else bad("help article website-blog missing");

console.log(failed ? "\n✗ W11 verify FAILED" : "\n🎉 W11 verify passed");
process.exit(failed ? 1 : 0);
