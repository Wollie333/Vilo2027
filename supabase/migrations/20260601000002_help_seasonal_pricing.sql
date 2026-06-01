-- Migration: Help Centre article — "How seasonal pricing works"
--
-- Surfaces the canonical seasonal-pricing rules (the 5-stage pricing stack,
-- absolute vs percentage rules, Fri+Sat weekends, precedence) in the in-app
-- Help Centre (help_articles is DB-backed). Idempotent: re-runs update in place.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'how-seasonal-pricing-works',
  'How seasonal pricing works',
  'Set higher festive rates or slow-season discounts and know exactly what each guest is charged. The rules, in plain English, with worked examples.',
  $html$
<p>Vilo prices every booking the same way, in five fixed stages. Once you know the order, you can predict every cent — and the preview you see, the price the guest sees at checkout, and the amount we charge are always identical.</p>

<h3>The Vilo pricing stack</h3>
<ol>
  <li><strong>Nightly rate</strong> — for each night we pick exactly one rate, in this order: <strong>a seasonal rule → your weekend rate → your base rate</strong>.</li>
  <li><strong>Occupancy</strong> — your per-guest / extra-guest settings adjust that nightly rate.</li>
  <li><strong>Stay discounts</strong> — whole-place combo, then length-of-stay (weekly 7+ nights, monthly 28+ nights). A percentage off the nights subtotal only.</li>
  <li><strong>Fees &amp; extras</strong> — cleaning fee (once) and add-ons. These are never discounted.</li>
  <li><strong>Total</strong> — Vilo never adds a commission or success fee.</li>
</ol>
<p><strong>Weekend nights are Friday and Saturday</strong> — the high-demand leisure nights.</p>

<h3>What a seasonal rule is</h3>
<p>A rule has a <strong>When</strong> (a date range — a one-day range is a single-date override like New Year's Eve), a <strong>What</strong>, a <strong>Where</strong> (the whole place or one room), a <strong>Priority</strong>, and an optional minimum-nights for those dates.</p>
<p>The <strong>What</strong> can be one of two types:</p>
<ul>
  <li><strong>Set price</strong> — the exact nightly price for those dates. Your extra-guest fee still applies on top. Best for a whole listing or a single room. (On a per-person room, a set price is a flat room nightly and won't scale by guest count — use a percentage there.)</li>
  <li><strong>Percentage</strong> — a +/- change like +40% for the festive season or -20% for slow winter. It scales your base, per-guest and extra-guest rates together, so it stays correct across multi-room and per-person listings. A percentage replaces the weekend rate on the nights it covers.</li>
</ul>

<h3>The three golden rules for overlaps</h3>
<ul>
  <li><strong>More specific wins</strong> — a room rule beats a whole-place rule, for that room.</li>
  <li><strong>Higher priority wins</strong> — stack a short holiday (priority 10) over a long season (priority 1).</li>
  <li><strong>Newest wins ties.</strong></li>
</ul>
<p>Seasonal rules never stack — exactly one wins per night, and it replaces the weekend rate on the nights it covers.</p>

<h3>Worked examples</h3>
<ul>
  <li><strong>Festive +50%, a three-room guesthouse:</strong> an R1 200 room becomes R1 800/night and an R2 000 room becomes R3 000/night on the covered dates. Cleaning and discounts are unchanged.</li>
  <li><strong>Single-night New Year's Eve:</strong> a one-day "set price" of R3 000 at priority 10 sits on top of a longer R1 500 December season at priority 1 — only 31 December is R3 000; the nights around it stay R1 500.</li>
  <li><strong>Winter -20%:</strong> an R1 000 room becomes R800/night across the slow season, and per-guest pricing still scales.</li>
  <li><strong>Weekend vs season:</strong> a Thursday-to-Sunday stay with an R1 000 base and R1 500 weekend rate and no season is R1 000 (Thu) + R1 500 (Fri) + R1 500 (Sat). If a festive season covers those nights, the season replaces the weekend rate.</li>
</ul>

<h3>Common mistakes</h3>
<ul>
  <li>Using a "set price" rule on a per-person room and expecting it to scale with guests — use a percentage instead.</li>
  <li>Forgetting that cleaning fees and add-ons are never discounted.</li>
  <li>Two overlapping rules with the same priority — give the one you want to win a higher priority number.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'listings'),
  'host',
  'published',
  5,
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
