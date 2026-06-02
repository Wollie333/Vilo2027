-- Migration: Help Centre article — age & pet pricing (RULES.md §9). Explains
-- the flat per-night model + age bands hosts set in room settings, and how the
-- charges appear on quotes, checkout and invoices. Idempotent.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'age-and-pet-pricing',
  'Pricing for children, infants & pets',
  'Set flat per-night rates and age bands per room — Vilo charges them automatically on quotes, checkout and invoices.',
  $html$
<p>Beyond the nightly room rate (which adults pay), you can add <strong>flat per-night charges</strong> for children, infants and pets. You set these per room under <strong>Listings &rarr; (a listing) &rarr; Rooms &rarr; (a room) &rarr; Age &amp; pet pricing</strong>. Whole-listing stays use the listing-level equivalents.</p>

<h3>The rates</h3>
<ul>
  <li><strong>Child / night</strong> — a flat amount per child, per night.</li>
  <li><strong>Infant / night</strong> — usually <strong>0 (free)</strong>; set an amount if you charge for cots etc.</li>
  <li><strong>Pet fee / night</strong> — a single flat per-night fee, added once when the booking has any pets.</li>
</ul>
<p>Leave any rate at <strong>0</strong> and it simply isn't charged. Adults always pay the normal room / occupancy rate.</p>

<h3>Age bands</h3>
<p>Bands decide who counts as an infant, child or adult — the hotel standard:</p>
<ul>
  <li><strong>Infant up to age</strong> (default 2): guests aged 0 to this are infants.</li>
  <li><strong>Child up to age</strong> (default 12): older than an infant and up to this age are children. Anyone above is charged as an adult.</li>
</ul>
<p>These bands are shown to the guest on the party selector so they pick the right category. Infants don't count toward the room's guest capacity.</p>

<h3>How it's charged</h3>
<p>The maths is the same everywhere — checkout, quotes and the invoice all use one engine:</p>
<ul>
  <li>Children: <em>number of children × child rate × nights</em>.</li>
  <li>Infants: <em>number of infants × infant rate × nights</em> (0 if free).</li>
  <li>Pets: <em>pet fee × nights</em>, once per booking when pets are present.</li>
</ul>
<p><strong>Worked example.</strong> Child rate R200/night, pet fee R150/night, a 3-night stay for 2 adults + 1 child + 1 dog: the guest pays the room rate <em>plus</em> R600 (child) <em>plus</em> R450 (pet). Each shows as its own line on the quote and invoice.</p>

<h3>Good to know</h3>
<ul>
  <li>These charges appear as clear line items, so guests always see what they're paying for.</li>
  <li>Set them once per room; they flow through to every quote and booking automatically.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'rooms'),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id,
      status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes,
      updated_at = now();
