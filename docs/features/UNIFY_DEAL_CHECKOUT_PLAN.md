# Plan: unify the deal checkout into the main listing checkout

> **✅ DONE 2026-07-13.** Implemented exactly as planned. `BookingForm` gained
> `deal?: DealCheckoutContext`; `SpecialBookingForm` deleted; `createSpecialBookingAction`
> + schema extended to accept `additional_guests` (party manifest — the one capability
> the plan promised that the old form lacked); `CheckoutDateEditor` gained optional
> `minDate`/`maxDate`/`maxNights` bounds. Both flows verified live end-to-end (a real
> EFT deal booking created `BK-0045` with `special_id`/`origin='special_booked'`/party/
> redemption++; normal booking regression clean). See CHANGELOG 2026-07-13.

> **Decision (founder, 2026-07-13):** deals should be booked through the **main
> listing checkout**, not a separate form. Route `/deal/[slug]/book` to render the
> main `BookingForm` in a new "deal mode", delete the duplicate deal form, and keep
> the deal submit action. Do this as a **dedicated, careful session** — it edits the
> single most critical revenue path.

## Why
- The backend is already shared: both `createBookingAction` (→ `createBookingCore`)
  and `createSpecialBookingAction` end in the **same** `lib/bookings/persist.ts`
  `persistBookingAndPay` (insert booking → payment → notify).
- The duplication is the **front-end form + pre-persist validation/pricing**:
  - Main: `apps/web/app/[locale]/property/[slug]/book/BookingForm.tsx` (~2,846 lines) —
    mature: rooms/dates, contact + inline guest account, add-ons, party manifest,
    coupons, 3 payment rails, VAT display, terms, summary card. 3-step wizard.
  - Deal: `apps/web/app/[locale]/deal/[slug]/book/SpecialBookingForm.tsx` (~652 lines) —
    a stripped-down variant + `deal/[slug]/book/actions.ts` `createSpecialBookingAction`.
- Unifying = deals inherit the mature checkout (payment UX, party manifest, future
  features), one place to fix booking bugs, ~1,000 fewer lines.

## Where a deal differs from a normal booking (the only real forks)
1. **Pricing** — deal uses `priceSpecialStay` (`lib/specials/pricing.ts`: flat package,
   or per-night with a synthetic max-priority rule so seasonal/weekend never apply).
   Normal uses `priceStay` (seasonal/combo/whole-listing/weekly/monthly + coupon).
2. **Dates/room** — fixed deal locks exact dates; flexible/evergreen constrains to
   window + min/max nights (evergreen = no window end, any future date ≥ window_start).
   Room/whole-property is pre-set by the deal (`special.room_id`).
3. **Inventory/identity** — deal claims `redeem_special` (quantity cap), stamps
   `bookings.special_id` + `origin='special_booked'`, snapshots the special's
   cancellation override, and folds in the compulsory add-ons.
4. **Coupons / multi-room combos / seasonal** — N/A for a pre-priced deal (hide them).

## Implementation

### 1. New prop on `BookingForm` — `deal?: DealCheckoutContext`
Add an optional context; when present the form runs in "deal mode":
```ts
export type DealCheckoutContext = {
  specialId: string;
  slug: string;
  title: string;
  priceMode: "flat" | "per_night";
  flatTotal: number | null;
  perNightPrice: number | null;
  dateMode: "fixed" | "flexible";
  isEvergreen: boolean;
  fixedCheckIn: string | null;
  fixedCheckOut: string | null;
  windowStart: string | null;
  windowEnd: string | null;   // null when evergreen
  minNights: number | null;
  maxNights: number | null;
  roomId: string | null;      // null = whole property
  maxGuests: number | null;
  wasPrice: number | null;
  savingsAmount: number | null;
  savingsPct: number | null;
  requiredAddonIds: string[]; // pre-selected + locked on
};
```

### 2. Fork points inside `BookingForm.tsx` (line refs are pre-unification)
- **Initial state**: when `deal`, force `scope`/room to the deal target, pre-fill dates
  (fixed) or default to `windowStart` + `minNights` (flexible), pre-select
  `requiredAddonIds` in `addonQty`, and lock them.
- **Pricing block** (`breakdown`, ~L584–640): `deal ? priceSpecialStay({...}) : priceStay({...})`.
  Feed the deal's unit (room or whole-property) + required add-ons; no seasonal/coupon.
- **Step 1 (Rooms) UI**: in deal mode replace the room picker with a locked deal summary
  (room/whole-property, dates or window, min/max nights, savings). Keep the date input
  editable only for flexible/evergreen (constrained); locked for fixed.
- **Coupon UI** (~L650–690 + summary): hidden when `deal`.
- **Multi-room combo / whole-listing / weekly-monthly discount**: skipped in deal pricing.
- **`pay()` submit** (~L880–957): when `deal`, call `createSpecialBookingAction` with
  `{ special_id, check_in, check_out, guests, selected_addons(optional only — required
  are server-forced), payment_method, contact, party, policy_acknowledged }` instead of
  `createBookingAction`. Keep the inline `createCheckoutGuestAccountAction` step as-is.
- **Guest cap**: use `deal.maxGuests ?? room/property max`.

Keep step 2 (Details/contact) and step 3 (Payment/terms/summary) **entirely reused**.

### 3. `createSpecialBookingAction` (`deal/[slug]/book/actions.ts`)
Already does the authoritative work (status/date/sold-out guards, re-price via
`priceSpecialStay`, `redeem_special` + rollback, `special_id`, policy snapshot,
required add-ons, `persistBookingAndPay`). **Keep it** as the deal submit path — its
input schema (`deal/[slug]/book/schemas.ts`) is the contract the unified form calls.
It currently returns `{ ok }` and the FORM redirects; align redirect handling with the
main flow (the main action `redirect()`s server-side; the special one returns and the
form pushes). Pick one convention.

### 4. Deal book page (`deal/[slug]/book/page.tsx`)
Render `<BookingForm ... deal={dealCtx} />` (it already loads the special + property +
payment rails + required add-ons). Map the loaded special → `DealCheckoutContext`.
Remove the `SpecialBookingForm` import.

### 5. Delete
- `deal/[slug]/book/SpecialBookingForm.tsx` (folded into BookingForm deal mode).
- Any now-unused props/i18n keys.

## Verification (DO NOT skip — critical path)
Drive **both** flows live end-to-end and confirm parity:
1. **Normal booking** (regression guard): `/property/[slug]/book` — pick dates + a room,
   add-on, coupon, EFT → booking created, priced correctly, no regression.
2. **Deal booking (fixed)**: `/deal/karoo-fixed-.../book` — dates locked, deal price,
   sold-out still blocks, redemption increments.
3. **Deal booking (flexible)** and **evergreen** (`karoo-midweek-escape`, now evergreen):
   any future dates, min/max nights enforced, required add-on locked-on, deal price +
   VAT correct, `special_id` + `origin='special_booked'` on the booking.
4. Confirm the money matches `priceSpecialStay` to the cent and VAT is inclusive.

## Risks
- Editing the 2,846-line critical checkout — a mistake regresses **all** bookings.
  Mitigate: gate every fork behind `if (deal)`, keep normal-mode code paths untouched,
  verify the normal flow first.
- Redirect/return convention mismatch between the two actions.
- The deal form's date picker constraints (evergreen no-max, fixed locked) must survive
  the merge — already implemented in `SpecialBookingForm`; port the logic.

## Test data (test host `0b111111`, property `0b222222…221`)
- `karoo-fixed-stargazer-weekend` — fixed, flat, **sold out** (qty1/used1).
- `karoo-midweek-escape` — **evergreen** now (is_evergreen, no window end/book-by),
  per-night, has a required add-on "Farm breakfast".
- `milkyway-room-flash` — flexible (min=max=2), flat, room-scoped.
See `docs/lifecycles/specials.md` + memory `project-specials-audit`.
