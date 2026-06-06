-- Migration: Help Centre article for the guest broadcast (bulk mailer). Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'guest-broadcasts',
  'Emailing your guests (broadcasts)',
  'Send one tasteful email to your guest list — by segment — once a month, with a built-in unsubscribe. Owning your guest relationship, the right way.',
  $html$
<p>From <strong>Guests &rarr; Email guests</strong> you can send a single broadcast to your guest list. It&rsquo;s deliberately simple and built to keep you compliant and your guests happy.</p>

<h3>How it works</h3>
<ul>
  <li><strong>Pick an audience</strong> &mdash; all subscribed guests, or a segment (VIP, Returning, New, Via OTA, or <em>Lapsed</em> for win-backs). A live line shows exactly how many will receive it and how many are skipped.</li>
  <li><strong>Write once</strong> &mdash; a subject and a message. Use <code>{{first_name}}</code> to greet each guest by name. It&rsquo;s sent from your brand, and replies come back to your email.</li>
  <li><strong>Send</strong> &mdash; recipients are recalculated at send time, deduplicated, and anyone without an email or who has unsubscribed is automatically skipped.</li>
</ul>

<h3>The guardrails (why this protects you)</h3>
<ul>
  <li><strong>Once per calendar month.</strong> One broadcast per month so guests never feel spammed. If you&rsquo;ve already sent this month, the composer tells you the next available date.</li>
  <li><strong>Every email can be unsubscribed</strong> in one click (and via the mail client&rsquo;s built-in unsubscribe). Opt-outs are immediate and final &mdash; only the guest can opt back in.</li>
  <li><strong>Consent first.</strong> Guests who booked are emailable on the existing-customer basis; manually-added contacts are only included once you&rsquo;ve confirmed you have their consent.</li>
</ul>

<p>Each guest&rsquo;s subscription is private to you &mdash; a guest can be subscribed with one host and unsubscribed with another. You can see and honour a guest&rsquo;s status on their record under <strong>Marketing</strong>.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
