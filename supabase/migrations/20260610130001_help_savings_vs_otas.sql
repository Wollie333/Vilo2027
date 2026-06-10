-- Migration: Help Centre article for the commission-savings feature — the
-- header "$" badge ("Vilo has saved you R X so far") and the Reports → Savings
-- page that compares what each OTA would have charged. Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'savings-vs-otas',
  'How much Vilo has saved you: the OTA commission comparison',
  'The dollar badge in the top bar and the Savings page under Reports show what direct booking has kept in your pocket — the commission Booking.com, Airbnb and the rest would have skimmed off the same revenue.',
  $html$
<p>Every booking that comes through Vilo is a <strong>direct</strong> booking, so Vilo takes <strong>0% commission</strong>. The big online travel agents (OTAs) don&rsquo;t &mdash; they take a cut of each reservation. The savings tools show you exactly what that cut would have been.</p>

<h3>The "$" badge in the top bar</h3>
<p>Tap the <strong>dollar icon</strong> next to your booking-link button. A quick popup tells you how much commission you&rsquo;ve kept so far &mdash; your confirmed direct-booking revenue measured against a typical 15% OTA commission. Tap <em>See full breakdown</em> to open the detailed report.</p>

<h3>Reports &rarr; Your savings vs OTAs</h3>
<p>From <em>Analytics &amp; Reports</em>, tap <strong>Your savings vs OTAs</strong>. The page leads with your total commission saved, then lays out a side-by-side table:</p>
<ul>
  <li><strong>Vilo</strong> &mdash; 0%, so R&nbsp;0 paid. You keep it all.</li>
  <li><strong>Each OTA</strong> &mdash; its typical host-side commission applied to your direct-booking revenue, i.e. what that platform would have charged you for the same bookings.</li>
</ul>

<h3>How the numbers are worked out</h3>
<p>The revenue base is your <strong>confirmed direct bookings</strong> (confirmed, checked-in and completed stays). The headline &ldquo;saved so far&rdquo; uses a 15% rate so it matches the platform-wide figure shown elsewhere on Vilo. Each row in the table uses that platform&rsquo;s own typical rate.</p>
<p>Commission rates are typical figures for the South African market and vary by listing, plan and promotion, so treat the comparison as a well-grounded estimate rather than an invoice. Either way, the commission you didn&rsquo;t pay is real money that stayed with you.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'payments'),
  'host', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
