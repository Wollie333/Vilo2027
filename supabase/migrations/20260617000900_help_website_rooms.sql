-- Migration: Help Centre article for the Website Rooms tab (W9). Ships with the
-- feature per RULES.md §9. Idempotent on slug. Category falls back to any existing
-- category so the FK can't be null pre-seed.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-rooms',
  'Choose which rooms show on your website',
  'Pick which rooms appear on your site, set their order, and fine-tune how each is shown — without ever touching your real prices.',
  $html$
<p>The <strong>Rooms</strong> tab controls how your rooms appear on your website. Open your website from <strong>Channels &rarr; Website</strong>, then choose the <strong>Rooms</strong> tab. Your rooms are grouped under the property they belong to.</p>

<h3>Showing &amp; hiding rooms</h3>
<p>Use the switch on each room to show or hide it on your site. The counter at the top tells you how many rooms are currently showing.</p>

<h3>Ordering</h3>
<p>Use the up/down arrows on the left of each room to set the order they appear in within their property.</p>

<h3>Display options</h3>
<p>Choose <strong>Edit display</strong> on a room to set a <strong>display name</strong>, <strong>display price</strong>, <strong>currency</strong> and <strong>description</strong>. Leave any field blank to use the room's own details. These options change only how the room <em>looks</em> on your marketing site.</p>

<h3>Prices are always live</h3>
<p>The display price is cosmetic. When a guest books, the price is always recalculated on our servers from your live rates, seasonal pricing and availability — so a display price can never affect what a guest is actually charged.</p>

<h3>Syncing</h3>
<p>Added a new room to a property? Choose <strong>Sync rooms</strong> to pull it in. Syncing also tidies up rooms you've since removed.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  COALESCE(
    (SELECT id FROM help_categories WHERE slug = 'account'),
    (SELECT id FROM help_categories ORDER BY sort_order LIMIT 1)
  ),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
