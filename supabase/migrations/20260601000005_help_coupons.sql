-- Migration: Help Centre article — "Discount coupons"
--
-- In-app explainer for the coupon feature (host setup + guest redemption),
-- categorised under Listings (pricing & promotions). Idempotent.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'discount-coupons',
  'Discount coupons: create, target & redeem',
  'Codes guests enter at checkout. Discount the whole order, accommodation, or add-ons; target a listing or room; time-box it and cap redemptions.',
  $html$
<p>Coupons are codes you create and a guest types in at checkout for money off. You stay in full control — Vilo takes no cut, and every redemption is re-checked on the server so a code can't be abused.</p>

<h3>Where coupons sit in the price</h3>
<p>A coupon is applied <strong>after</strong> seasonal rates, weekend rates and length-of-stay discounts, on the part of the bill you choose. Cleaning fees are never discounted by a coupon.</p>

<h3>Create one in Dashboard → Coupons</h3>
<ol>
  <li><strong>Code</strong> — what the guest types (e.g. <code>WELCOME10</code>). Letters, numbers, <code>-</code> and <code>_</code>; one of each code per account.</li>
  <li><strong>Discount</strong> — a percentage (e.g. 10%) or a fixed amount (e.g. R250 off). A fixed amount never exceeds the eligible total.</li>
  <li><strong>Applies to</strong> —
    <ul>
      <li><em>Whole order</em>: accommodation + add-ons.</li>
      <li><em>Accommodation only</em>: the room/base nightly subtotal.</li>
      <li><em>Add-ons only</em>: just the extras.</li>
    </ul>
  </li>
  <li><strong>Where</strong> — all your listings, one listing, or (with accommodation scope) a single room.</li>
  <li><strong>Limits</strong> — a validity window (valid from / until), a minimum nights or minimum spend, a total redemption cap, and a per-guest cap.</li>
</ol>

<h3>How guests use it</h3>
<p>On the checkout sidebar the guest enters the code and taps <strong>Apply</strong>. The discount line appears immediately and updates the total. If they change their dates or rooms, the coupon clears and they re-apply — that keeps the quoted price honest. The server re-validates the code and records the redemption atomically when the booking is made, so caps are never exceeded even if two guests redeem the last one at the same moment.</p>

<h3>Worked examples</h3>
<ul>
  <li><strong>WELCOME10 — 10% off the whole order:</strong> on a R2 000 room + R200 breakfast, the guest saves R220 (cleaning untouched).</li>
  <li><strong>ROOMSONLY — 20% off accommodation:</strong> the R2 000 room drops by R400; add-ons are unchanged.</li>
  <li><strong>SUITE50 — 50% off, room-targeted:</strong> only the selected suite's subtotal is discounted; other rooms in the same booking are not.</li>
  <li><strong>R500OFF — fixed amount, min spend R3 000:</strong> applies only when the eligible total is at least R3 000, and never discounts more than the eligible amount.</li>
</ul>

<h3>Common mistakes</h3>
<ul>
  <li>Room targeting needs a listing selected first, and only applies with “accommodation” scope.</li>
  <li>A fixed-amount coupon larger than the eligible total just zeroes that part — it never makes the total negative.</li>
  <li>Turning a coupon “off” stops new redemptions immediately but doesn't change bookings already made.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'listings'),
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
