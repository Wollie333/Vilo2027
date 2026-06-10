-- Migration: Help Centre article update — "Listing extras" now covers the
-- new "Suggest nearby places" button, which pulls real places around the
-- listing from OpenStreetMap so the host can pick instead of typing each one.
-- Per RULES.md §9 (every feature change ships its article). Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'listing-extras',
  'Listing extras: nearby spots & review themes',
  'Add points of interest and curated review themes to make your listing page richer — including auto-suggested places near you from OpenStreetMap.',
  $html$
<p>Listing extras are the small touches on <strong>Dashboard → Listing extras</strong> that make your public listing page feel local and trustworthy. There are two kinds.</p>

<h3>Points of interest</h3>
<p>Hand-pick the best things near your place so guests can picture their trip. Each one has a category, a name, and an optional travel time:</p>
<ul>
  <li><strong>Eat</strong> — restaurants, cafés, the farm stall down the road.</li>
  <li><strong>Do</strong> — beaches, trails, wineries, markets.</li>
  <li><strong>Travel</strong> — the airport, the station, how far to town.</li>
</ul>
<p>They appear in the “Where you’ll be” section of your listing. A handful of well-chosen spots beats a long generic list.</p>

<h3>Suggest nearby places (the quick way)</h3>
<p>Instead of typing each spot, tap <strong>Suggest nearby places</strong>. Vilo uses your listing’s saved location to pull real places around it from <strong>OpenStreetMap</strong> (a free, community map) and groups them into Eat / Do / Travel. Tick the ones you want, tweak the travel time if you like, and tap <em>Add selected</em>.</p>
<ul>
  <li>Your listing needs a <strong>location set</strong> first — add it on the listing’s Location tab, then come back.</li>
  <li>Travel times are <strong>estimates</strong> based on straight-line distance, so adjust them to real driving times where it matters.</li>
  <li>Coverage depends on the area — busy towns return lots of places, quiet spots fewer. You can always add the rest by hand.</li>
  <li>Places you’ve already added won’t show up again in the suggestions.</li>
</ul>

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
