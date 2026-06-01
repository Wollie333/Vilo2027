-- Migration: Help Centre article — "Cancelling a booking" (RULES.md §9).
-- Covers host + guest cancellation, the policy refund, and the calendar release.
-- Categorised under Bookings, audience both. Idempotent.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'cancelling-a-booking',
  'Cancelling a booking',
  'How hosts and guests cancel, what refund the cancellation policy gives, and what happens to the calendar.',
  $html$
<p>Both hosts and guests can cancel a booking. Whatever the reason, Vilo runs the same enterprise flow: it works out the policy-entitled refund, frees the calendar, and notifies the other party.</p>

<h3>How a host cancels</h3>
<p>Open the booking in <strong>Dashboard → Bookings</strong> and click <strong>Cancel</strong>. A dialog shows exactly what the guest will be refunded under the booking's cancellation policy, and lets you add a reason (the guest sees it). Confirm, and:</p>
<ul>
  <li>The booking moves to <em>cancelled by host</em>.</li>
  <li>The blocked dates are released so the room is bookable again.</li>
  <li>If the guest had paid, a refund request for the policy amount is created automatically and lands in your <strong>Refunds</strong> queue.</li>
  <li>The guest is emailed + notified.</li>
</ul>

<h3>How a guest cancels</h3>
<p>Open the trip under <strong>My trips</strong> and click <strong>Cancel booking</strong>. The dialog shows the refund you'll get under the host's cancellation policy for your dates. Confirm, and the booking is cancelled, the dates are freed, your host is notified, and — if you'd paid — a refund request for the entitled amount is opened for you automatically.</p>

<h3>How the refund is worked out</h3>
<p>Every booking freezes the listing's cancellation policy at the time of booking, so the terms never change under you. When a cancellation happens, Vilo compares how many days before check-in it is to the policy's rules (e.g. 100% up to 30 days, 50% up to 7 days, 0% after) and refunds that percentage of what was paid. Cleaning fees and add-ons follow the same policy. The exact figure is always shown before you confirm.</p>

<h3>Good to know</h3>
<ul>
  <li>Cancellation can't be undone — the dates are released immediately.</li>
  <li>A guest can cancel up to confirmation; once a stay is checked-in, contact the host.</li>
  <li>The refund request is processed from the Refunds queue (card refunds via the provider; EFT refunds are sent by the host).</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'both',
  'published',
  4,
  now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id,
      audience = EXCLUDED.audience,
      status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes,
      updated_at = now();
