// Seed 2 published demo blog posts for a host website (layout / typography testing).
// Idempotent on slug. Covers use Unsplash (allow-listed in next.config images).
//
// Usage:
//   node scripts/seed-demo-blog-posts.mjs /tmp/blog-seed.sql
//   supabase db query --linked --file /tmp/blog-seed.sql
//
// The target website is wollie@manamarketing.co.za's published site
// (host 7b4c377e…, website f7ac2679…). Change WEBSITE_ID to seed another site.

import { writeFileSync } from "node:fs";

const WEBSITE_ID = "f7ac2679-1d45-43b2-a498-bd7d22b44d38";

const LOREM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus, eget dictum lorem eleifend et. Nam vestibulum accumsan nisl, at porttitor sapien tempus sed. Sed euismod, arcu vitae luctus mattis, sem urna hendrerit velit, non vulputate arcu libero eget felis.`;

function paragraphs(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(`<p>${LOREM} ${LOREM}</p>`);
  return out.join("\n");
}

// Each body is comfortably over 1000 words with varied structure to test the layout.
function body(intro) {
  return `
<p><strong>${intro}</strong></p>
${paragraphs(3)}
<h2>Planning your stay</h2>
${paragraphs(3)}
<ul>
  <li>Sunrise game drives with an expert ranger</li>
  <li>Bush breakfasts on the riverbank</li>
  <li>Guided walking safaris and birding</li>
  <li>Spa treatments and a heated plunge pool</li>
</ul>
${paragraphs(2)}
<blockquote>"The stillness of the bush at dawn is something every traveller should experience at least once." </blockquote>
<h2>What to pack</h2>
${paragraphs(3)}
<h2>When to visit</h2>
${paragraphs(3)}
<p>Book direct and save — no marketplace commission, just you and your hosts.</p>`.trim();
}

const posts = [
  {
    title: "A First-Timer's Guide to the Perfect Bush Safari",
    slug: "first-timers-guide-bush-safari",
    excerpt: "Everything you need to know before your first safari — from what to pack to the best time of year to spot the Big Five.",
    cover: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1600&q=80",
    intro: "Your first safari is unforgettable — here is how to make the most of every moment.",
    author: "Wollie Steenkamp",
  },
  {
    title: "Five Reasons to Book Your Lodge Stay Directly",
    slug: "five-reasons-book-lodge-directly",
    excerpt: "Skip the middleman. Booking direct means better rates, a real relationship with your host, and a smoother, more personal stay.",
    cover: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80",
    intro: "Booking direct is better for you and for your hosts — here is why.",
    author: "Wollie Steenkamp",
  },
];

const values = posts
  .map(
    (p) => `(
  '${WEBSITE_ID}',
  $t$${p.title}$t$,
  $s$${p.slug}$s$,
  'published',
  now(),
  $c$${p.cover}$c$,
  $e$${p.excerpt}$e$,
  $b$${body(p.intro)}$b$,
  $a$${p.author}$a$,
  '{}'::jsonb
)`,
  )
  .join(",\n");

const sql = `-- Seed 2 published blog posts for wollie@ website (layout testing). Idempotent on slug.
DELETE FROM website_blog_posts WHERE website_id='${WEBSITE_ID}' AND slug IN ('first-timers-guide-bush-safari','five-reasons-book-lodge-directly');
INSERT INTO website_blog_posts (website_id, title, slug, status, publish_at, cover_path, excerpt, body_html, author_name, seo)
VALUES
${values};
SELECT slug, status, char_length(regexp_replace(body_html,'<[^>]+>','','g')) AS text_len FROM website_blog_posts WHERE website_id='${WEBSITE_ID}' ORDER BY created_at DESC;`;

const out = process.argv[2] ?? "blog-seed.sql";
writeFileSync(out, sql);
console.log("wrote", out);
