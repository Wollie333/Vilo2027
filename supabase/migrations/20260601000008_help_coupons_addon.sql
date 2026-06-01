-- Migration: refresh the "Discount coupons" help article for per-add-on targeting
-- (RULES.md §9 — editing a feature refreshes its article). Idempotent upsert.

UPDATE help_articles
SET
  excerpt = 'Codes guests enter at checkout. Discount the whole order, accommodation, or add-ons — and target one listing, one room, or one add-on. Time-box it and cap redemptions.',
  body_html = $html$
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
  <li><strong>Target (optional)</strong> — narrow it further:
    <ul>
      <li>To one <strong>listing</strong>, or all of them.</li>
      <li>With <em>accommodation</em> scope, to a single <strong>room</strong>.</li>
      <li>With <em>add-ons</em> scope, to a single <strong>add-on</strong>.</li>
    </ul>
    A targeted coupon only applies when that room or add-on is actually in the booking.
  </li>
  <li><strong>Limits</strong> — a validity window (valid from / until), a minimum nights or minimum spend, a total redemption cap, and a per-guest cap.</li>
</ol>

<h3>How guests use it</h3>
<p>On the checkout sidebar the guest enters the code and taps <strong>Apply</strong>. The discount line appears immediately and updates the total. If they change their dates or rooms, the coupon clears and they re-apply — that keeps the quoted price honest. The server re-validates the code and records the redemption atomically when the booking is made, so caps are never exceeded even if two guests redeem the last one at the same moment. The per-guest cap is also pre-checked for signed-in guests, so they're warned before checkout.</p>

<h3>Worked examples</h3>
<ul>
  <li><strong>WELCOME10 — 10% off the whole order:</strong> on a R2 000 room + R200 breakfast, the guest saves R220 (cleaning untouched).</li>
  <li><strong>ROOMSONLY — 20% off accommodation:</strong> the R2 000 room drops by R400; add-ons are unchanged.</li>
  <li><strong>SUITE50 — 50% off, room-targeted:</strong> only the selected suite's subtotal is discounted; other rooms in the same booking are not.</li>
  <li><strong>SPA25 — 25% off, add-on-targeted:</strong> with a R400 breakfast and a R600 spa in the cart, only the spa is discounted (−R150); breakfast is untouched.</li>
  <li><strong>R500OFF — fixed amount, min spend R3 000:</strong> applies only when the eligible total is at least R3 000, and never discounts more than the eligible amount.</li>
</ul>

<h3>Common mistakes</h3>
<ul>
  <li>Room targeting needs a listing selected first and only applies with “accommodation” scope; add-on targeting only applies with “add-ons” scope.</li>
  <li>A targeted coupon won't apply if the guest hasn't added that room or add-on — they'll see a clear prompt.</li>
  <li>A fixed-amount coupon larger than the eligible total just zeroes that part — it never makes the total negative.</li>
  <li>Turning a coupon “off” stops new redemptions immediately but doesn't change bookings already made.</li>
</ul>
$html$,
  read_time_minutes = 5,
  updated_at = now()
WHERE slug = 'discount-coupons';
