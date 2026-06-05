-- Migration: Help Centre article (RULES.md §9) for accepting a quote and paying
-- from the inbox thread. Idempotent upsert on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'accept-a-quote-and-pay',
  'Accept a quote and pay',
  'Accepting a quote turns it into a booking you can pay right away — deposit or in full, by card or EFT.',
  $html$
<p>When a host sends you a quote it appears as a card in your <strong>Messages</strong> thread (and under <strong>Quotes</strong>). Here&rsquo;s what happens when you go ahead.</p>

<h3>Accepting</h3>
<p>Tap <strong>Accept</strong> on the quote. It immediately becomes a <strong>booking</strong> and the card changes to <strong>&ldquo;Pay to confirm&rdquo;</strong>. Your dates stay held while you pay.</p>

<h3>Paying</h3>
<ul>
  <li>Tap <strong>Pay now</strong> on the card. You can choose to pay the <strong>deposit</strong> (the default, if the host set one) or the <strong>full amount</strong>.</li>
  <li>Pick <strong>Card</strong> (secure payment via Paystack) or <strong>EFT</strong> (you&rsquo;ll get the host&rsquo;s banking details and a reference to transfer).</li>
  <li>Once your payment is confirmed, the card updates to <strong>Confirmed</strong> and your stay appears under <strong>My trips</strong>. If you paid a deposit, the remaining balance is due before check-in.</li>
</ul>

<p>Changed your mind before paying? Just <strong>decline</strong> the quote — that releases the held dates. Quotes also have a validity date; after it passes you&rsquo;ll need the host to send a fresh one.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'guest', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
