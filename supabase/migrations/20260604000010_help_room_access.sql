-- Migration: refresh the "guest access" help article for per-room access, the
-- new gate-code field, and the 1-hour-before-check-in unlock. Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'guest-access-and-local-tips',
  'Set guest access — per room or whole listing',
  'Give guests their gate/door codes, Wi-Fi and arrival steps. Set them per room and/or for the whole listing — the guest sees the access for exactly what they booked.',
  $html$
<p>Everything a guest needs to arrive lives under <strong>Listings &rarr; edit &rarr; Guest access</strong> (whole-listing access) and on each room under <strong>Rooms &rarr; edit a room &rarr; Guest access</strong> (per-room access).</p>

<h3>What you can set</h3>
<ul>
  <li><strong>Check-in method</strong> &mdash; e.g. <em>Self check-in &middot; smart lock</em>.</li>
  <li><strong>Arrival instructions</strong> &mdash; how to find the place, parking, which door.</li>
  <li><strong>Gate code</strong>, <strong>door code</strong>, <strong>Wi-Fi network</strong> and <strong>Wi-Fi password</strong>.</li>
</ul>

<h3>Per room vs whole listing</h3>
<p>The guest is shown the access for <strong>exactly what they booked</strong>:</p>
<ul>
  <li><strong>Whole-listing booking</strong> &rarr; they see the listing&rsquo;s access.</li>
  <li><strong>One room</strong> &rarr; they see that room&rsquo;s access. <strong>Two rooms</strong> &rarr; they see both rooms&rsquo; access, one block each.</li>
  <li>Anything you leave blank on a room <strong>falls back to the listing</strong> access &mdash; so you can set one Wi-Fi for the whole place but a different door code per room.</li>
</ul>

<h3>When the guest sees codes</h3>
<p>The sensitive bits &mdash; <strong>gate code, door code and Wi-Fi password</strong> &mdash; unlock for the guest <strong>1 hour before check-in</strong> (a physical-key courtesy), and only on a confirmed booking. Until then they see a &ldquo;unlocks 1 hour before check-in&rdquo; note. Access details are never shown on your public page.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'listings'),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
