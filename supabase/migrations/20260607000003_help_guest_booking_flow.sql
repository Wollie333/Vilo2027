-- Migration: Help Centre article for the redesigned guest booking journey —
-- a display-only listing with two actions (Reserve or Request a quote) and a
-- self-contained 3-step checkout (Rooms -> Details -> Payment). Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'how-to-book-a-stay',
  'How to book a stay',
  'From a listing you can Reserve (a quick 3-step checkout) or Request a quote. Here is what each step does and when to use which.',
  $html$
<p>Every listing gives you two ways forward &mdash; no booking fees either way, and you are never charged just for looking.</p>

<h3>1 &middot; Reserve</h3>
<p>Tap <strong>Reserve</strong> to open the booking flow. You choose everything inside the checkout itself, in three quick steps:</p>
<ul>
  <li><strong>Rooms</strong> &mdash; pick your check-in and check-out dates and how many guests are coming, then add the room(s) you want. On places that allow it you can book the <em>whole place</em> in one tap (often at a discount).</li>
  <li><strong>Details</strong> &mdash; tell the host who&rsquo;s coming, add any optional extras (breakfast, a transfer, a late checkout), apply a coupon if you have one, and leave a message. Booking without an account? We set one up for you here so you can manage your trip and message your host.</li>
  <li><strong>Payment</strong> &mdash; pay securely by card, or by bank transfer (EFT) where the host offers it. Your running total is always shown on the right, including all fees.</li>
</ul>
<p>The summary on the right updates live as you go, so the price you see is exactly the price you pay.</p>

<h3>2 &middot; Request a quote</h3>
<p>Not quite ready, or want a tailored price (flexible dates, a bigger group, a special occasion)? Tap <strong>Request a quote</strong>. Tell the host your dates and party and send a short message &mdash; there&rsquo;s no payment now. The host replies with a quote you can review and accept by email, which turns into a booking in one click.</p>

<h3>Good to know</h3>
<ul>
  <li>Your payment is held securely until your trip is confirmed.</li>
  <li>Cancellation terms are set by the host and shown before you pay.</li>
  <li>Need to change something? Message your host any time from your trip page.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'guest', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
