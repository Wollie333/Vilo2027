-- Migration: refresh the website Rooms help article for the enterprise Rooms tab
-- (Phase 7 — featured/badge, property group headers, live preview, drag reorder).
-- Ships with the feature per RULES.md §9. Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-rooms',
  'Rooms on your website',
  'Choose which rooms show, reorder them, feature your best, add badges, group by property and preview it all live.',
  $html$
<p>The <strong>Rooms</strong> tab controls how your rooms appear on your website. Booking always uses your live prices and availability — everything here is presentation only.</p>

<h3>Show, hide &amp; reorder</h3>
<p>Toggle each room on or off, and <strong>drag</strong> rooms by the handle to set the order they appear. Use <strong>Sync rooms</strong> to pull in any rooms added to your properties since you set the site up.</p>

<h3>Feature a room &amp; add badges</h3>
<p>Open a room's <strong>display options</strong> to <strong>feature</strong> it (a highlighted card) or add a short <strong>badge</strong> like "Best for couples" or "Sea view". You can also override the room's display name, price, currency and description for the website — these are cosmetic and never change what a guest is charged.</p>

<h3>Room facts</h3>
<p>Cards automatically show a few useful facts pulled from each room — how many it sleeps, beds, bed type and whether it's ensuite.</p>

<h3>Group headings per property</h3>
<p>If you have more than one property, expand <strong>Property heading &amp; intro</strong> to give each property its own heading, introduction and banner image above its rooms — so your rooms page reads as distinct places to stay.</p>

<h3>Live preview</h3>
<p>The preview on the right shows your rooms section exactly as visitors will see it. It updates when you <strong>Save</strong>, and your changes go live on the site when you <strong>Publish</strong>.</p>
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
