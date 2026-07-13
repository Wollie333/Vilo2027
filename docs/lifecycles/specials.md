# Specials / deals — lifecycle flow

> How a host-authored deal is created, published, discovered, priced and booked.
> A booked special is a **normal `bookings` row** carrying a `special_id` FK, so
> date-blocking, policy snapshots, VAT, payment and ledger all reuse the booking
> machinery (see [booking.md](booking.md), [payments-ledger.md](payments-ledger.md)).
> **Seasonal pricing never applies to the special's own price** — only to the
> "was price" shadow it's compared against.
>
> Audited 2026-07-13 (deep pass). Canonical pricing: `apps/web/lib/specials/pricing.ts`.

Conventions: prices stored **ex-VAT** on the `specials` row (the rate the host
sets); the guest always sees **VAT-inclusive** via `grossVat()`. Savings are
computed server-side at save and are **seasonal-aware**.

---

## Data model (`specials`)

| Group | Columns |
|---|---|
| Targeting | `host_id`, `business_id`, `property_id`, `room_id` (null = whole property) |
| Dates (`date_mode` `fixed`\|`flexible`) | `fixed_check_in/out` · `window_start/end` + `min_nights`/`max_nights` |
| Pricing (`price_mode` `flat`\|`per_night`) | `flat_total` · `per_night_price` · `currency` (from business) · `max_guests` |
| Savings badge (computed at save) | `was_price` · `savings_amount` · `savings_pct` |
| Inventory | `quantity` (≥1) · `redemptions_used` (≤ quantity, CHECK) |
| Scheduling | `go_live_at` (visibility gate) · `book_by` (deadline) |
| Merchandising | `categories[]` · `custom_tags[]` · `badge` · `is_featured` · `sort_order` |
| Visibility | `show_in_directory` · `show_on_website` (both false + active = link-only) |
| Policy | `cancellation_policy_id` (overrides room/listing/host at snapshot) |
| Lifecycle | `status` `draft\|active\|paused\|expired\|archived` · `deleted_at` (soft) |

Related: `special_addons` (required/optional upsells), `special_categories`
(admin taxonomy), `special_view_events` (cookieless analytics), `bookings.special_id`
+ `bookings.booked_via`, `blocked_dates.special_id`/`source='special'`.
Unique slug is **per host** (`(host_id, slug) WHERE deleted_at IS NULL`).

---

## 1. Create / edit (host) — `dashboard/specials/`
- 8-step editor (`SpecialEditor.tsx`); Zod schema mirrors the DB CHECKs + refinements
  (book-by ≤ check-in; fixed-date ⇒ `quantity = 1`; editor may only set `draft`/`active`).
- `createSpecialAction` / `updateSpecialAction` (`actions.ts`), gated by `canUseSpecials`.
  `business_id`+`currency` derived from the property; slug minted once, immutable on edit.
- On save the **savings badge is recomputed** server-side (`_lib/savings.ts` →
  `computeSpecialSavings` → `priceSpecialWithSavings`) and stored. ✅ verified: re-saving
  refreshes `was_price`/`savings_amount`/`savings_pct` from the live rates.
- Fixed-date activation checks availability (`special_dates_available` RPC) and blocks the
  dates (`block_special_dates`); date changes on an active deal release+reblock.

## 2. Publish & discover
- Visibility gate = `status='active'` AND `go_live_at` past (null = live now) AND not expired.
- Public deal page `/deal/[slug]` (`deal/[slug]/page.tsx`) — resolves the **earliest active**
  match by slug (⚠ per-host slug but global resolution; slug collision across hosts hides the
  later one — pre-MVP acknowledged). Prices shown VAT-inclusive.
- Directory `/deals` (`lib/specials/directory.ts` `searchSpecials`, `show_in_directory=true`),
  property-page tab (`loadPropertySpecials`), category filtering (`special_categories`).

## 3. Pricing & savings — `lib/specials/pricing.ts` ✅ verified correct
- `priceSpecialStay`: **flat** → package total + add-ons (no nightly/seasonal); **per_night**
  → `priceStay` with ONE synthetic max-priority absolute rule so seasonal/weekend never leak,
  while occupancy/cleaning/add-ons still apply.
- **Savings are seasonal-aware**: `priceSpecialWithSavings` prices the special AND a "normal
  rate" shadow that DOES apply real seasonal rules, then `specialSavings` =
  `{ amount: was−deal, pct: Math.round(amount/was*100) }`, nulled when ≤ 0 (never negative).
  → A deal priced just below an already-discounted seasonal rate honestly shows a **small**
  saving. Example (audited): property runs "Winter Off-Peak −15%"; the R1350/night deal beats
  the R1360 winter rate by only R20 ⇒ "1% off". Correct, not a bug.
- VAT display: `lib/pricing/vat.ts` `grossVat(amount, effectiveVatRate(property))`; `was_price`,
  deal price and `savings_amount` are each grossed for display (cent-level rounding only).

## 4. Book a special — `deal/[slug]/book/` ✅ verified
> **Unified checkout (2026-07-13):** the deal page now renders the **main `BookingForm`** in
> "deal mode" (`deal?: DealCheckoutContext`) — the same 3-step wizard as a normal stay, with the
> room/price (and fixed-deal dates) locked, coupons/combos/seasonal/age-extras hidden, and pricing
> via `priceSpecialStay`. The old bespoke `SpecialBookingForm` is deleted. The deal checkout now
> also carries the **party manifest** (`additional_guests`). The submit path below is unchanged.
1. Inline guest account (form), then auth.
2. Re-load special (admin); guard `status=active` + not deleted + **runtime date guards**
   (`go_live_at`/`book_by`) + **sold-out guard** (`redemptions_used >= quantity`).
3. Fixed ⇒ forced dates; flexible ⇒ validate window + min/max nights + guest cap.
4. Availability = `blocked_dates` count over the stay, **excluding this special's own hold**.
5. **Re-price server-side** with `priceSpecialStay` — the client estimate is never trusted.
6. `persistBookingAndPay`: insert booking (`origin='special_booked'`, `special_id`, `booked_via`)
   → **`redeem_special`** race-safe cap claim (rollback `release_special`) → booking_rooms/addons
   → `snapshot_booking_policies` (special's cancellation override) → `startBookingPayment`
   → `notifyHostNewBooking` ("New special booking …").
7. VAT: booking inserted ex-VAT; `apply_booking_vat` trigger grosses the scalar money columns;
   persist reads back the post-VAT total to charge.
- Redemption returned on terminal status by `on_booking_cancelled`; abandoned pending bookings
  released by the existing `expire-pending-bookings`/`expire-eft-bookings` crons.

## 5. Sold-out & expiry ✅ verified / 🔧 fixed
- **Sold out** enforced at 3 layers: no CTA on the deal page, "This deal is sold out" on the
  book page, and the server action's `redemptions_used >= quantity` guard. (Cap claim itself is
  race-safe via `redeem_special`'s conditional UPDATE.)
- **Expiry**: `expire_specials()` flips lapsed active deals → `expired` (stay window / book-by
  past), and `on_special_status_change` releases fixed-date `blocked_dates` on that transition.
  🔧 **This function shipped UNSCHEDULED** ("cron wired later") — fixed in migration
  `20260713110000_schedule_expire_specials_cron.sql` (daily 02:15 UTC). Verified: backdating a
  deal's `book_by` + running `expire_specials()` flips it to `expired`.

## 6. Admin & reporting
- No dedicated admin specials moderation page. Deal **reports** land in `listing_reports`
  (`target_type='deal'`) and are triaged in admin Moderation. Categories managed at
  `admin/platform/deal-categories`. Per-host analytics: `lib/specials/reporting.ts`.

---

## Audit results (2026-07-13)

**Correct / verified live:** server-side re-pricing (client never trusted) · VAT-inclusive
display (flat + per-night) · sold-out enforcement (3 layers) · window/min-max-nights guards ·
race-safe quantity cap · **seasonal-aware savings** · redemption increment/return.

**Fixed:** `expire_specials()` cron scheduled (`20260713110000`). Refreshed two seed specials
whose hand-authored `was_price` ignored the active winter seasonal (milkyway 12%→3%,
midweek 16%→1%) by re-saving through the real compute path.

**Open (founder calls, not bugs):**
- **Trivial savings badges** — a deal barely below an active seasonal rate shows "1% off".
  Honest, but weak UX. Consider suppressing the badge below a threshold (e.g. hide < ~5%).
- **Per-host slug, global `/deal/[slug]` resolution** — cross-host slug collision hides the
  later deal. Pre-MVP unlikely; make slug globally unique or disambiguate before scale.
- **No notification on special publish or expiry** (booking notification exists).
- Flexible-deal pending-overlap is mitigated at confirmation (`on_booking_confirmed` +
  `get_special_booking_conflict`), consistent with the normal request-to-book flow — by design.
