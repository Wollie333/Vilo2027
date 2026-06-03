-- Migration: Help Centre articles (RULES.md §9) for the features added alongside
-- the Trip Details + Quote Detail redesign:
--   * guest access details + local picks on a listing
--   * the per-booking welcome note
--   * quote view-tracking + host-only internal notes
-- Idempotent upserts on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'guest-access-and-local-tips',
  'Add guest access details and local tips',
  'Give guests their check-in method, door code, Wi-Fi and your favourite nearby spots — shown automatically on their trip page.',
  $html$
<p>Everything a guest needs for a smooth arrival lives on their <strong>Trip</strong> page. You fill it in once per listing under <strong>Listings &rarr; edit &rarr; Guest access</strong>, and Vilo shows it to confirmed guests at the right time.</p>

<h3>Access &amp; arrival</h3>
<ul>
  <li><strong>Check-in method</strong> &mdash; e.g. <em>Self check-in &middot; smart lock</em> or <em>Meet the host</em>.</li>
  <li><strong>Arrival instructions</strong> &mdash; how to find the place, where to park, which door to use.</li>
  <li><strong>Door code</strong> and <strong>Wi-Fi password</strong> &mdash; these are sensitive, so guests only see them from <strong>24 hours before check-in</strong>. Until then they see a &ldquo;unlocks closer to check-in&rdquo; note. The Wi-Fi network name shows earlier.</li>
</ul>
<p>Access details are stored separately from your public listing and are <strong>never shown publicly</strong> &mdash; only the guest with a confirmed booking sees them.</p>

<h3>Local picks</h3>
<p>Add your favourite nearby places &mdash; where to eat, what to do, what to see. Give each a short blurb and (optionally) a photo and a distance like &ldquo;5 min walk&rdquo;. They appear as &ldquo;your host&rsquo;s local picks&rdquo; on the trip page. Leave it empty and the section simply doesn&rsquo;t show.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'listings'),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'welcome-note-to-guest',
  'Send your guest a personal welcome note',
  'Add a warm, personal note to a booking — it greets the guest at the top of their trip page.',
  $html$
<p>A short personal note goes a long way. Open any booking under <strong>Bookings</strong> and add a <strong>welcome note</strong> &mdash; it appears as &ldquo;a note from your host&rdquo; on the guest&rsquo;s trip page, signed in your name.</p>
<ul>
  <li>Use it to point out little touches: a welcome basket, the best spot for sundowners, when you&rsquo;ll be around.</li>
  <li>It&rsquo;s <strong>guest-facing</strong> &mdash; keep private reminders in <strong>internal notes</strong> instead, which only you and your team can see.</li>
  <li>You can edit or clear it any time; changes show on the trip page immediately.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'host', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'quote-tracking-and-notes',
  'See when a guest opens your quote, and keep private notes',
  'The quote page shows where the guest is in the journey, how often they have opened it, and gives you a host-only notes thread.',
  $html$
<p>Every quote has a live <strong>status tracker</strong> &mdash; Created &rarr; Sent &rarr; Viewed &rarr; Accepted &rarr; Booked &mdash; so you always know where things stand.</p>

<h3>Open tracking</h3>
<ul>
  <li>When a guest opens the quote link you sent, Vilo records it. You&rsquo;ll see <strong>how many times</strong> they&rsquo;ve opened it and <strong>when they last looked</strong>.</li>
  <li>The full <strong>activity</strong> list shows each open and key moments (sent, viewed, accepted) with timestamps.</li>
  <li>If they&rsquo;ve looked but not replied, a one-tap <strong>Send a reminder</strong> nudge is right there.</li>
</ul>

<h3>Internal notes</h3>
<p>The <strong>internal notes</strong> thread on the quote is <strong>host-only</strong> &mdash; jot down things like held dates or follow-up plans. Guests never see it. The guest-facing message is the separate <strong>message</strong> on the quote itself.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
