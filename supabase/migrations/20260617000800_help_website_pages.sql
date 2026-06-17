-- Migration: Help Centre article for the Website page/section builder (W8).
-- Ships with the feature per RULES.md §9. Idempotent on slug. Category falls
-- back to any existing category so the FK can't be null pre-seed.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-building-pages',
  'Build your website pages',
  'Add, reorder and edit the sections that make up your Home and About pages — with a live preview as you go.',
  $html$
<p>Your website is built from <strong>sections</strong> — stacked building blocks like a hero banner, an intro, rooms, reviews and a call to action. Open your website from <strong>Channels &rarr; Website</strong>, choose the <strong>Pages</strong> tab, then open a page to edit it.</p>

<h3>Adding &amp; arranging sections</h3>
<ul>
  <li><strong>Add section</strong> — pick from the menu. Each new section starts with placeholder text you can edit.</li>
  <li><strong>Reorder</strong> — use the up/down arrows on the left of each section.</li>
  <li><strong>Show / hide</strong> — the eye icon keeps a section but hides it from the live page.</li>
  <li><strong>Delete</strong> — the bin icon removes a section.</li>
</ul>

<h3>Editing a section</h3>
<p>Click a section to open its editor. Type your text, and for hero or host sections you can upload an image straight from your device. The <strong>preview</strong> on the right updates as you type. Use the desktop/phone toggle to check both layouts.</p>

<h3>Sections that fill themselves in</h3>
<p>Some sections are marked <strong>Live</strong> — Rooms &amp; rates, Photo gallery, Location, Guest reviews and Blog preview. These pull straight from your property data, so they're never out of date and you don't retype anything. You only set the heading and a few options; the content comes from your rooms, photos and reviews.</p>

<h3>Saving &amp; publishing</h3>
<p>Choose <strong>Save changes</strong> to store your edits. Saved changes show in <strong>Preview</strong> but aren't live to visitors until you <strong>publish</strong> the site (coming soon).</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  COALESCE(
    (SELECT id FROM help_categories WHERE slug = 'account'),
    (SELECT id FROM help_categories ORDER BY sort_order LIMIT 1)
  ),
  'host', 'published', 4, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
