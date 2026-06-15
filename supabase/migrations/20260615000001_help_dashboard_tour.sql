-- Migration: Help Centre article companion to the in-dashboard guided tour —
-- a written walk-through of the eight areas the tour highlights, so the feature
-- ships with docs (RULES.md §9). Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'find-your-way-around-the-dashboard',
  'Find your way around the dashboard',
  'A quick tour of your dashboard — where bookings, the inbox, your calendar, listings, finances and settings live, and how to share your direct booking link. Replay the interactive tour any time from Help.',
  $html$
<p>New to {brand}? Your dashboard puts everything in the left-hand menu. Here is what each area is for. You can also <strong>replay the interactive guided tour</strong> any time &mdash; open <em>Help &amp; docs</em> and choose <strong>Take a 2-min tour</strong>.</p>

<h3>Overview</h3>
<p>Your home base. Once you go live, your revenue, bookings, occupancy and ratings appear here at a glance, along with anything that needs your attention.</p>

<h3>Bookings</h3>
<p>Every reservation lands here. Confirm or decline pending stays, see who&rsquo;s checking in next, and open any booking for full details.</p>

<h3>Inbox</h3>
<p>Guest messages and enquiries live in the Inbox. Fast replies win more bookings &mdash; an unread count shows right on the menu item.</p>

<h3>Calendar</h3>
<p>See every stay across your listings in one place. Block dates, spot gaps, and keep your direct bookings in sync with other channels.</p>

<h3>Listings</h3>
<p>Add and edit your places to stay &mdash; photos, pricing, rooms and amenities. Polished listings turn browsers into bookings.</p>

<h3>Finances</h3>
<p>The Finances group holds your ledger, payments, quotes, invoices, credit notes and refunds &mdash; a full picture of what you&rsquo;re owed and what you&rsquo;ve been paid.</p>

<h3>Settings</h3>
<p>Home to your banking details, business profile and subscription plan. Get these right so payouts reach you.</p>

<h3>Your direct booking link</h3>
<p>The calendar button in the header opens your direct booking page. Share it on social, WhatsApp or your own website &mdash; guests book you directly, commission-free.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'account'),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
