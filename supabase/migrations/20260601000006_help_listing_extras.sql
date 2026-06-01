-- Migration: Help Centre article — "Listing extras"
--
-- Backfills a dedicated help article for the (pre-existing) Listing extras
-- feature, per RULES.md §9 (touching an article-less feature = write its
-- article). Categorised under Listings, host audience. Idempotent.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'listing-extras',
  'Listing extras: nearby spots & review themes',
  'Add points of interest and curated review themes to make your listing page richer and help guests picture the stay.',
  $html$
<p>Listing extras are the small touches on <strong>Dashboard → Listing extras</strong> that make your public listing page feel local and trustworthy. There are two kinds.</p>

<h3>Points of interest</h3>
<p>Hand-pick the best things near your place so guests can picture their trip. Each one has a category, a name, and an optional travel time:</p>
<ul>
  <li><strong>Eat</strong> — restaurants, cafés, the farm stall down the road.</li>
  <li><strong>Do</strong> — beaches, trails, wineries, markets.</li>
  <li><strong>Travel</strong> — the airport, the station, how far to town.</li>
</ul>
<p>They appear in the “What’s nearby” section of your listing. A handful of well-chosen spots beats a long generic list.</p>

<h3>Review themes</h3>
<p>Review themes are short, curated highlight tags (with an icon) that summarise what guests love — “Spotless”, “Great host”, “Quiet &amp; private”. Add a label, pick an icon, and optionally a mention count to show how often guests bring it up. They give new guests an at-a-glance feel for your strengths.</p>

<h3>Tips</h3>
<ul>
  <li>Keep points of interest specific and honest — real travel times build trust.</li>
  <li>Use themes that match your actual reviews; they should reinforce, not oversell.</li>
  <li>Extras are private to you until your listing is published — only your own listings appear here.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'listings'),
  'host',
  'published',
  3,
  now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id,
      audience = EXCLUDED.audience,
      status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes,
      updated_at = now();
