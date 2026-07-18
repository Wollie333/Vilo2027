// Mana Journal seed — adds a blog category + three PUBLISHED journal posts to the
// live `mana` site so the Journal/blog page can be designed against real content.
// Cover images are external URLs (websiteAssetUrl passes absolute URLs through),
// so posts render with imagery without uploading storage assets.
//
//   node --env-file=.env.local scripts/seed-mana-journal.mjs   # from apps/web
//
// Idempotent: fixed post/category UUIDs + upsert on (website_id, slug).

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing env. Run: node --env-file=.env.local scripts/seed-mana-journal.mjs",
  );
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SUBDOMAIN = "mana";
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const POSTS = [
  {
    slug: "on-foot-at-first-light",
    title: "On Foot at First Light",
    excerpt:
      "There is a particular quiet to the reserve before sunrise — the hour we like best, and the one we most want to share with you.",
    author_name: "The Mana Team",
    featured: true,
    publish_at: daysAgo(4),
    cover:
      "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1600&q=80",
    body_html: `
<p>The best mornings here begin in the dark. You are handed coffee in a tin cup, you follow the guide out through the gate on foot, and for the first ten minutes nobody says very much at all.</p>
<h2>Reading the ground</h2>
<p>A walk is slower than a drive, and that is the point. You start to notice the things a vehicle rushes past — the overnight story written in the sand, a dung beetle already at work, the exact place a leopard crossed the path a few hours before you did.</p>
<blockquote>You do not go looking for the big things. You go looking for the small ones, and the big things find you.</blockquote>
<p>By the time the sun clears the treeline you are usually somewhere with a view, and breakfast is waiting when you get back. It is the one thing every guest says they will do again.</p>`,
  },
  {
    slug: "when-the-bush-turns-green",
    title: "When the Bush Turns Green",
    excerpt:
      "Everyone talks about the dry season. We have a soft spot for the other one — when the first rains come and the whole reserve exhales.",
    author_name: "The Mana Team",
    featured: false,
    publish_at: daysAgo(12),
    cover:
      "https://images.unsplash.com/photo-1534177616072-ef7dc120449d?w=1600&q=80",
    body_html: `
<p>From November the light changes. The first storms roll in over the escarpment in the late afternoon, the dust settles, and within a week the grey bush is suddenly, improbably green.</p>
<h2>The season of the young</h2>
<p>Green season is when the impala drop their lambs — dozens at a time, on the same few days — and the predators know it. The photography is extraordinary: dramatic skies, saturated colour, and animals everywhere you look because the whole reserve is busy raising the next generation.</p>
<p>It is also our quietest, best-value time of year, which we think is exactly backwards. If you like your bush lush and your lodge to yourself, this is the stay to book.</p>`,
  },
  {
    slug: "the-suites-in-the-trees",
    title: "The Suites Built into the Trees",
    excerpt:
      "Why the Leadwood faces east, why the Marula looks down on the waterhole, and the small decisions that make a room feel like it grew there.",
    author_name: "The Mana Team",
    featured: false,
    publish_at: daysAgo(20),
    cover:
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1600&q=80",
    body_html: `
<p>When we rebuilt the lodge we made one rule: not a single tree comes down for a room. Every suite is set around what was already standing, which is why no two are quite the same shape.</p>
<h2>East-facing on purpose</h2>
<p>The Leadwood Suite is named for the tree it is built into, and its full wall of glass faces east so you wake with the sun coming up over the riverbed without getting out of bed. The Marula Family Suite sits twelve metres above the waterhole — close enough to hear the elephant drink at two in the morning, far enough that nobody needs to whisper.</p>
<p>They are small decisions, but they are the difference between a room with a view and a room that feels like it belongs exactly where it is.</p>`,
  },
];

async function main() {
  console.log(`Mana Journal seed → ${URL}`);

  const { data: site, error: siteErr } = await admin
    .from("host_websites")
    .select("id, subdomain")
    .eq("subdomain", SUBDOMAIN)
    .is("deleted_at", null)
    .maybeSingle();
  if (siteErr) throw siteErr;
  if (!site) throw new Error(`No host_websites row with subdomain='${SUBDOMAIN}'.`);
  const WEBSITE_ID = site.id;
  console.log(`  website_id = ${WEBSITE_ID}`);

  // Category (upsert, then read back its id to link the posts)
  const { error: catErr } = await admin.from("website_blog_categories").upsert(
    {
      website_id: WEBSITE_ID,
      name: "Field Notes",
      slug: "field-notes",
      sort_order: 0,
    },
    { onConflict: "website_id,slug" },
  );
  if (catErr) throw catErr;
  const { data: cat } = await admin
    .from("website_blog_categories")
    .select("id")
    .eq("website_id", WEBSITE_ID)
    .eq("slug", "field-notes")
    .maybeSingle();
  const CAT_ID = cat?.id ?? null;

  // Posts
  const rows = POSTS.map((p) => ({
    website_id: WEBSITE_ID,
    category_id: CAT_ID,
    title: p.title,
    slug: p.slug,
    status: "published",
    publish_at: p.publish_at,
    cover_path: p.cover,
    excerpt: p.excerpt,
    body_html: p.body_html.trim(),
    author_name: p.author_name,
    featured: p.featured,
    seo: {},
    deleted_at: null,
  }));
  const { error: postErr } = await admin
    .from("website_blog_posts")
    .upsert(rows, { onConflict: "website_id,slug" });
  if (postErr) throw postErr;

  console.log(`  ✓ 1 category + ${rows.length} published posts upserted`);
  console.log(
    `  View: /site/blog?site=${SUBDOMAIN}  (or the Journal nav link)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
