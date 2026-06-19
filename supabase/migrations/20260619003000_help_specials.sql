-- Migration: Help Centre article for Specials (S7b). Ships with the feature
-- per RULES.md §9. Idempotent on slug. Category falls back to any existing
-- category so the FK can't be null pre-seed.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'specials',
  'Creating and selling Specials',
  'Specials are pre-packaged accommodation deals — a fixed or flexible stay at a set price. Learn how to build one, show off the savings, choose where it sells, and track how it performs.',
  $html$
<p>A <strong>Special</strong> is a ready-made deal for one of your properties — for example "3 nights for the price of 2" or a discounted long-weekend package. Guests see one clear price and can book it directly, with no negotiation. You'll find Specials under <strong>Properties &rsaquo; Specials</strong> in the sidebar.</p>

<h3>Building a Special</h3>
<p>Choose <strong>New special</strong> and work through the editor: pick the property, give the deal a name and description, add a hero image, and set its dates. A Special can have <strong>fixed dates</strong> (an exact check-in and check-out) or be <strong>flexible</strong> (a minimum number of nights bookable inside a wider window). You can also set a <strong>go-live</strong> date, a <strong>book-by</strong> deadline, and a limited <strong>quantity</strong> so the deal sells out once it's gone.</p>

<h3>Pricing &amp; savings</h3>
<p>You can price a Special two ways. A <strong>flat package price</strong> is an all-in total for the whole stay — nothing else is added. A <strong>per-night price</strong> is multiplied across the nights and still includes any compulsory add-ons. Either way, Vilo compares your deal against what the same stay would normally cost at your seasonal rates and shows guests a <strong>savings badge</strong> (the amount and percentage they're saving), so the value is obvious.</p>

<h3>Where it shows</h3>
<p>Each Special has its own visibility controls. Turn on the <strong>Vilo directory</strong> to list it on the public Specials page where guests browse deals across hosts. Turn on <strong>show on website</strong> to feature it on your own branded site (add a <strong>Specials</strong> section to any page in the website builder). Both channels send guests to the same checkout, so prices and availability never drift apart. A Special can also be marked <strong>featured</strong> to push it to the front of the list.</p>

<h3>How a booking works</h3>
<p>When a guest books a Special, the deal price is the one that's charged — Vilo re-checks it on the server, claims one unit against the quantity cap, and reserves the dates. If a booking falls through, the unit is released back so the deal can sell again. From the guest's side it's a normal booking: it appears in your calendar, bookings list and ledger like any other.</p>

<h3>Tracking performance</h3>
<p>Open any Special to see its <strong>report</strong>: revenue from confirmed stays, how many units have sold against the cap (sell-through), the booking funnel, total savings passed on to guests, and the most recent bookings. Use it to see which deals are working and which need a nudge on price or promotion.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  COALESCE(
    (SELECT id FROM help_categories WHERE slug = 'listings'),
    (SELECT id FROM help_categories ORDER BY sort_order LIMIT 1)
  ),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
