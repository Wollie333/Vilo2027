-- Migration: Help Centre article (RULES.md §9) for guests messaging a host.
-- Covers how a signed-in guest reaches a host (via Request a quote, which opens
-- a conversation) and where replies land (portal inbox). Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'message-a-host',
  'Message a host',
  'Start a conversation with a host straight from a listing, and pick up their replies in your portal inbox.',
  $html$
<p>Got a question before you book? You can reach a host directly &mdash; no marketplace middleman.</p>

<h3>Starting a conversation</h3>
<p>On any stay, tap <strong>Request a quote</strong>. Tell the host your dates, who&rsquo;s coming and anything you&rsquo;d like to ask. That opens a conversation with them and (where it makes sense) gets you a tailored quote back.</p>
<p>If you&rsquo;re <strong>signed in</strong>, we already know who you are &mdash; you won&rsquo;t have to type your name or email, and you&rsquo;ll be taken straight to the conversation once you send it.</p>

<h3>Where replies appear</h3>
<ul>
  <li>Open <strong>Messages</strong> in your portal to see every conversation with a host, newest first, with an unread badge when there&rsquo;s something new.</li>
  <li>Open a conversation to read the full thread and reply.</li>
  <li>If the host sends a <strong>quote</strong>, it shows up in the thread and under <strong>Quotes</strong>, where you can accept or decline it.</li>
</ul>
<p>You&rsquo;ll also be notified by email when a host replies, so you never miss a response.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'guest', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
