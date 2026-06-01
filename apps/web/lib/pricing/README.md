# Vilo pricing — the single source of truth

**Everything a stay costs is computed by one function: `priceStay()` in
`engine.ts`.** If you ever need to change how money is calculated, change it
here — never re-implement pricing in a component or an action.

## Why one place

Preview, checkout, the charged amount, and the invoice must agree to the cent.
The only way to guarantee that is a single pure function that every surface
calls. No surface is allowed to add/subtract/scale prices on its own.

## The Pricing Stack (fixed order)

`priceStay()` applies these stages in this exact order:

1. **Nightly rate** — per night, pick ONE: seasonal rule → weekend rate
   (Fri+Sat) → base rate. (`resolveNightlyRate`)
2. **Occupancy** — `pricing_mode` scales that rate by guests
   (per_room / per_person / per_room_plus_extra). (`occupancyNightly`)
3. **Stay discounts** — whole-place combo, then length-of-stay (weekly 7+,
   monthly 28+). % off the nights subtotal only. (`applyStayDiscounts`)
4. **Fees & extras** — cleaning (once) + add-ons (`computeAddonSubtotal`).
   Never discounted by stay discounts.
5. **Coupon** — a pre-validated coupon as the final discount stage, on the
   scope the host chose (order / accommodation / add-ons, optionally one
   room or one add-on). Cleaning is never coupon-eligible. (`couponDiscountFor`)
6. **Total** — no commission, no success fee.

The output (`PriceBreakdown`) is fully itemised: per-night rate + source label,
discounts, add-ons, coupon, and the effective minimum-nights. It is snapshotted
onto `bookings.price_breakdown` so invoices/refunds/support read the exact bill.

## Who calls it (and nothing else may)

| Surface | File | Role |
|---|---|---|
| **Authoritative charge** | `app/listing/[slug]/book/actions.ts` | recalculates server-side; never trusts the client; persists the breakdown + records coupon redemption |
| Checkout estimate | `app/listing/[slug]/book/BookingForm.tsx` | live sidebar — equals the charge to the cent |
| Listing sidebar teaser | `app/listing/[slug]/BookingWidget.tsx` | whole-listing quick estimate |
| Rooms cart | `app/listing/[slug]/RoomsCartSidebar.tsx` | per-room running total |
| Mobile sticky bar | `app/listing/[slug]/MobileBookingBar.tsx` | mobile total |
| Single-room page | `app/listing/[slug]/rooms/[roomId]/RoomBookingWidget.tsx` | one-room estimate |
| Host seasonal preview | `app/dashboard/seasonal-pricing/*` | year-at-a-glance |

Server-side coupon validation lives in `@/lib/coupons` (`resolveCoupon`) and is
shared by the guest preview and the authoritative action.

**Out of scope by design:** host-entered *manual* bookings and quotes
(`dashboard/bookings/new`, `dashboard/quotes`) — the host sets those prices
directly, so they intentionally do not run through the engine.

## Rules for changing pricing

1. Change the maths in `engine.ts` only. Add a journey test in `pricing.test.ts`
   for the new behaviour (these tests are the proof the financial logic is
   correct — keep them green).
2. Never compute a total, discount, or nightly rate in a component or action.
   Map your data to `PricingUnit[]` / `StayAddon[]` and call `priceStay()`.
3. If a column feeds pricing, plumb it into the engine input — don't special-case
   it downstream.
4. The DB function `calculate_booking_price()` is a secondary cross-check for the
   flat (whole-listing / single-room) case only; the TS engine is canonical.
