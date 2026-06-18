-- Migration: Help Centre article for website pages & navigation (enterprise
-- build-out Phase 6). Ships with the feature per RULES.md §9. Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-pages',
  'Pages & navigation',
  'Add pages to your site, choose what shows in the menu, reorder it, and set per-page SEO.',
  $html$
<p>Your website starts with a <strong>Home</strong> and an <strong>About</strong> page, but you can add as many pages as you like — a "Things to do" guide, a contact page, house rules, and more.</p>

<h3>Adding a page</h3>
<p>On the <strong>Pages</strong> tab, click <strong>Add page</strong>, give it a name, and pick a starting point: <strong>Blank</strong>, <strong>About</strong> (our story + meet the host) or <strong>Contact</strong> (intro + a contact form). The page opens straight in the builder so you can edit it.</p>

<h3>Your navigation menu</h3>
<p>Each page has a <strong>Nav label</strong> (what visitors see in the menu) and an <strong>In nav / Hidden</strong> toggle. Drag pages by the handle to set the order they appear. Hidden pages still work on a direct link — they're just kept out of the menu. Navigation changes go live when you <strong>Publish</strong>.</p>

<h3>Per-page SEO</h3>
<p>Open any page and expand <strong>Page SEO</strong> to set a title and description just for that page — these override your site-wide SEO in search results. Leave them blank to use the site defaults.</p>

<h3>Duplicating &amp; deleting</h3>
<p>Use the <strong>copy</strong> icon to duplicate a page (handy for similar layouts), and the <strong>trash</strong> icon to delete one. Your Home page is protected and can't be deleted.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  COALESCE(
    (SELECT id FROM help_categories WHERE slug = 'account'),
    (SELECT id FROM help_categories ORDER BY sort_order LIMIT 1)
  ),
  'host', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
