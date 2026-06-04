-- Migration: Help Centre article (RULES.md §9) for the in-portal Quotes hub
-- (/portal/quotes) — where a guest finds quotes hosts have sent them, what each
-- status means, and how accepting/declining works. Idempotent upsert on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'view-and-accept-your-quotes',
  'View and accept your quotes',
  'Quotes a host has prepared for you live in your portal under Quotes — review the details, then accept to hold your dates or decline to release them.',
  $html$
<p>When you ask a host for tailored pricing (by tapping <strong>Request a quote</strong> on a stay), their reply lands in your portal under <strong>Quotes</strong>. You don&rsquo;t have to dig through email &mdash; everything is in one place, and you respond right there.</p>

<h3>What the statuses mean</h3>
<ul>
  <li><strong>Being prepared</strong> &mdash; the host is still putting your quote together. You&rsquo;ll be notified when it&rsquo;s ready.</li>
  <li><strong>Awaiting your reply</strong> &mdash; the quote has been sent. Open it to see the dates, guests and a full price breakdown, then accept or decline.</li>
  <li><strong>Accepted</strong> &mdash; you&rsquo;ve accepted; the host will be in touch to arrange the booking.</li>
  <li><strong>Booked</strong> &mdash; the quote has been turned into a confirmed booking. You&rsquo;ll find it under <strong>My trips</strong>.</li>
  <li><strong>Declined</strong> / <strong>Expired</strong> &mdash; the quote is no longer open. Message the host if you&rsquo;d like an updated one.</li>
</ul>

<h3>Accepting or declining</h3>
<p>Open a quote that&rsquo;s <em>awaiting your reply</em> and you&rsquo;ll see <strong>Accept quote</strong> and <strong>Decline</strong>. <strong>Accepting holds your dates</strong> with the host &mdash; payment is arranged afterwards directly with them. <strong>Declining</strong> releases the hold and can&rsquo;t be undone, so only decline if you&rsquo;re sure.</p>

<p>Each quote has a <strong>valid-until</strong> date. After it passes, the quote expires and can no longer be accepted &mdash; just message the host for a fresh one. If a quote is linked to a conversation, you&rsquo;ll see a link to message the host about it right from the quote.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'guest', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
