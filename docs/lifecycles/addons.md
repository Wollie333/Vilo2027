# Add-ons — lifecycle & audit

> Deep audit 2026-07-16. **Verdict: money layer is sound.** The double-charge guard
> holds, both add-on paths charge exactly once, guest add-ons are re-priced
> server-side. The open items are a founder decision (G7 refundability) + two rare
> edge cases, documented below. No correctness fix was needed.

## Data model
- `addons` (host catalog, `20260524000005_addons_catalog.sql`; enriched `…000001`,
  `…000006`): `pricing_model` (per_stay/per_night/per_guest/per_guest_per_night/
  per_couple), `unit_price`, `min/max_quantity`, `is_required`, `stock_quantity`,
  `allow_custom_quantity`, `vat_included` (informational only — NOT used in maths;
  VAT is applied at booking level).
- `property_addons` (was `listing_addons`) — per-listing + per-room scoping
  (`room_id` NULL = listing-wide) + `unit_price_override`.
- `booking_addons` — `label`, `quantity`, `unit_price`, `subtotal` (plain numeric,
  computed at insert — the old GENERATED column was dropped because it was wrong for
  non-flat pricing), `addon_id` (NULL = free-form), `source` ∈ `quote`|`host_added`|
  `guest_added`, `invoice_id` (which invoice billed it).
- `quote_addons` (VAT-less snapshot on the quote), `special_addons` (bundling).

## Two paths
- **(a) Quote/booking-time** (`source='quote'`): priced in `lib/pricing/engine.ts`
  `priceStay`→`addonsTotal`; cloned quote→booking on accept (`lib/quotes/accept-convert.ts`);
  rides inside `bookings.total_amount`, emitted on the single `kind='booking'` invoice
  (`ensure_booking_invoice` filters add-on lines to `source='quote'`).
- **(b) Post-booking**: host `dashboard/bookings/[id]/payment-actions.ts`
  `addBookingAddonAction` (`source='host_added'`) + guest `portal/trips/[id]/addon-actions.ts`
  `addGuestBookingAddonAction` (`source='guest_added'`, **price re-resolved from the
  catalog server-side — client price never trusted**). Each bumps `total_amount`+`vat_amount`
  (VAT `grossUpVat` at the booking's frozen `vat_rate`) and mints a separate `kind='addon'`
  invoice (`lib/payments/invoicing.ts` `createAddonInvoice`).

## Double-charge guard — CONFIRMED HOLDING
`ensure_booking_invoice` sets the booking-invoice total = `total_amount − Σ(non-voided
kind='addon' invoices)` and lists only `source='quote'` add-on lines. Fix migration
`20260712210000`; **verified the guard survived the later coupon-line migration
`20260716130000`** (subtraction + `source='quote'` filter both intact). Net:
- `quote` add-ons → no addon invoice → stay inside the booking invoice.
- `host_added`/`guest_added` → own addon invoice → subtracted from the booking invoice.
Stay charged once, each add-on once, on both paths.

## Pricing / coupon interaction
Add-ons are step 4 "fees & extras" — **never discounted** by stay/LOS discounts
(`applyStayDiscounts` only sees base+cleaning). Coupons CAN target add-ons:
`scope='addons'` discounts the add-ons subtotal (optionally one via `coupon.addon_id`);
`scope='order'` includes accommodation+add-ons; cleaning never eligible. Coupon is the
final stage and is now itemized on the invoice.

## Open / residual (surfaced, not fixed)
- **G7 refundability — OPEN (founder decision).** No per-add-on refundable flag and no
  per-line refund exist. Refunds operate at booking-total/payment level (`refund_requests`
  references `booking_id`+`payment_id`, no notion of which portion is an add-on). On
  cancellation, add-on STOCK is released but there is no differential refund. Building this
  = new `addons.is_refundable` (or per-line) + refund-flow changes; needs founder sign-off
  on the model.
- **Residual: null addon-invoice edge case.** If `createAddonInvoice` returns null (invoice
  numbering hiccup) AFTER `total_amount` was bumped, the add-on is charged once but baked
  into the booking invoice un-itemized and `booking_addons.invoice_id` stays NULL. Money is
  correct; itemization/tracking is off. Rare; recommend a guard that logs + optionally rolls
  back the total bump on invoice-mint failure.
- **Guest post-booking is whole-listing only** (`addon-actions.ts` hard-filters
  `room_id IS NULL`) — a guest can't add a room-scoped add-on after booking.
- **Host post-booking add-ons are free-form** (client `label`/`unit_price`, no `addon_id`,
  no catalog re-price, no stock decrement) — asymmetric with the guest path. By design
  (host sets the price) but noted.
- **Plan gate inert pre-MVP** — `assertAddonsEnabled` short-circuits true
  (`PRE_MVP_FEATURES_OPEN`); restore before paid tiers.
- Cosmetic: dead SQL `compute_addon_subtotal` (5-arg, unused) diverges from the
  authoritative 4-arg TS mirror — harmless (never called).
