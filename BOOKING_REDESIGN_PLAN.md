# Booking Redesign Plan — Simplified Guest Booking

> **Goal:** A simplified, modern, fast guest booking journey. The public
> listing page **shows** the property and offers exactly **two actions**:
> **Reserve** (→ self-contained multi-step booking flow) or **Request a quote**
> (→ existing quote modal). Guests **cannot** book directly off the listing or
> select rooms there. Easy. Simple. Fast.
>
> **Designs (canonical — match these):**
> - Listing page → `C:\Users\Wollie\Downloads\Listing 3.0.html`
> - Booking flow → `C:\Users\Wollie\Downloads\Booking Flow.html`
>
> Work **phase by phase**. After every phase: `pnpm build` + `pnpm lint`
> green, commit + push, then tick the **Progress** box below.

---

## 1. Where we are today (investigated 2026-06-07)

- **Typecheck is clean** (`tsc --noEmit` exit 0). Nothing in the repo is broken.
  The earlier "everything went off" redesign work is **not recoverable** from git
  (working tree clean, no stash/branch holds it) → treat as a **fresh build**.
- **Listing page** (`apps/web/app/listing/[slug]/page.tsx`) — dark immersive hero,
  floating gallery, scroll-spy subnav already shipped (`97e93fb`). It currently
  has **inline room/date/guest selection** in the sidebar that we must remove:
  - `BookingWidget.tsx` — whole-listing date+guest picker + "Reserve · R…" CTA.
  - `RoomsCartSidebar.tsx` + `RoomsCartProvider.tsx` — per-room cart, per-room
    guest steppers, "Reserve N rooms · R…" CTA.
  - `MobileBookingBar.tsx` — mobile sticky bar mirroring the above.
  - Both currently deep-link to `/listing/[slug]/book?from=…&to=…&room_ids=…`.
- **Request a quote** — **already complete**. `RequestQuoteButton.tsx`
  (canonical `FormModal`) → `POST /api/enquiry` → `lib/enquiry/create-enquiry.ts`
  (`createEnquiry`, `guestQuoteRequestSchema`). Writes to `quotes` table. Host
  responds in `/dashboard/quotes`; guest views at `/q/[id]/[token]`. **Reuse it.**
- **Checkout** (`apps/web/app/listing/[slug]/book/`) — today a **2-step**
  *Review trip → Payment* form (`BookingForm.tsx`, 2396 lines) that **receives**
  an already-made room selection by URL. Has a dark summary sidebar + stepper
  already. Server logic is solid and stays:
  - `actions.ts` → `createBookingAction`, `createCheckoutGuestAccountAction`,
    `validateCouponAction`.
  - `schemas.ts` → `createBookingSchema` (scope `whole_listing | rooms`,
    `room_ids`, `room_guests`, addons, coupon, payment_method `paystack | eft`).
  - Canonical pricing engine `priceStay()` (`@/lib/pricing`).
  - Confirmation page `apps/web/app/booking/[id]/success/page.tsx` (Paystack
    fast-path verify + EFT pending state). **Stays.**

## 2. Target architecture (LOCKED decisions)

1. **Listing page = display + 2 CTAs only.** No date picker, no room cart, no
   guest steppers on the listing. A clean **reserve panel** (sticky sidebar +
   mobile bar) with: price-from, trust line, **Reserve** button, **Request a
   quote** button.
2. **Reserve → `/listing/[slug]/book`** (self-contained). All dates / rooms /
   guests are chosen **inside the booking flow**. No URL params required (an
   optional `?from&to` prefill is allowed but never required).
3. **Request a quote → existing `RequestQuoteButton`** (restyle to match the new
   design if needed; no logic change).
4. **Booking flow = 3 in-page steps**: **Rooms → Details → Payment**, with the
   dark night-gradient summary on the right, a top stepper, and a mobile bottom
   bar carrying the price + primary CTA (CTA lives in the summary, per design).
   Step 1 adapts to `listing.booking_mode`:
   - `whole_listing` → dates + guests only (no room cards).
   - `rooms_only` → room cards (no whole-place toggle).
   - `flexible` → room cards **+** whole-place toggle (save 10%).
5. **Keep all server logic**: `createBookingAction`, `priceStay()`, coupons,
   add-ons, Paystack + manual-EFT, `/booking/[id]/success`. Client restructure only.
6. **Real payment rails only**: Card (Paystack) + manual EFT. The design's
   "Capitec Pay / Ozow" are Paystack channels — do **not** add fake methods.
7. **Dynamic data only** (no hardcoded "Karoo/Lerato"): rooms, seasonal rates,
   cleaning fee, discounts, add-ons, host name, cover, rating all from the DB.
8. **Help article** (RULES §9) updated for the new checkout (DB-backed
   `help_articles` seed migration).
9. **Confirmation** stays redirect-based (Paystack → success page; EFT → success
   page in pending state). The design's inline "You're booked" screen is the
   success page, not an in-form step.

## 3. Open flags (resolve in-phase, don't pre-decide)

- **F1 · Add-on units.** Design shows *per stay / per night / per person·night*.
  Current add-on model = `unitPrice` + `allowCustomQuantity` + a `perNight`
  notion (`PricingModel` in `dashboard/addons/schemas`). In Phase 4, map the
  three design units onto the existing model. **If it can't express
  per-person·night, flag the founder — no schema change without approval.**
- **F2 · In-flow per-room availability.** Step 1 must show which rooms are free
  for the chosen dates and re-check when dates change. Reuse the blocked-date /
  availability data the listing widgets already load; add a small server action
  (`checkRoomsAvailabilityAction`) only if client-side data is insufficient.
- **F3 · Listing-page cleanup.** Removing inline selection makes
  `RoomsCartProvider` / `RoomsCartSidebar` / `BookingWidget` selection logic
  redundant on the listing. Delete or slim them — keep it lean (no dead code).

---

## 4. Phases

> Each phase is independently shippable: build + lint green, commit + push.

### Phase 0 — Plan (this document)
- **Do:** Save this plan; point `CURRENT_TASK.md` at it.
- **Done when:** committed.
- **Commit:** `docs: booking redesign plan (simplified 2-CTA listing + 3-step flow)`

### Phase 1 — Listing page: display-only + two CTAs
- **Do:** Replace the inline-selection sidebar with a **ReservePanel** (sticky
  desktop + mobile bar): price-from, trust/refund line, **Reserve** → `/book`,
  **Request a quote** → existing modal. Strip date/room/guest selection from the
  listing. Keep the rooms section as **display-only** (already is). Match
  `Listing 3.0.html`.
- **Files:** `listing/[slug]/page.tsx`, `BookingWidget.tsx` (→ becomes/【replaced
  by】 `ReservePanel.tsx`), `RoomsCartSidebar.tsx`, `MobileBookingBar.tsx`,
  `RoomsCartProvider.tsx` (slim/remove — F3), `RequestQuoteButton.tsx` (restyle
  only if needed).
- **Accept:** Listing shows exactly two CTAs; no on-page room/date selection;
  Reserve lands on `/book`; quote modal opens & submits; build + lint green.
- **Commit:** `feat(listing): display-only listing with Reserve + Request-a-quote CTAs`

### Phase 2 — Booking flow scaffold (3-step shell)
- **Do:** Make `book/page.tsx` render with **no** `room_ids`/dates (direct entry);
  load listing + all rooms + add-ons + seasonal rules + EFT banking + contact
  prefill. Restructure `BookingForm.tsx` into 3 in-page steps **Rooms(0) →
  Details(1) → Payment(2)** with the top stepper, dark summary sidebar, mobile
  bottom bar, and the CTA-in-summary pattern. Step bodies can be placeholders.
- **Files:** `book/page.tsx`, `book/BookingForm.tsx`.
- **Accept:** Navigate all 3 steps (stepper + CTA labels: *Continue to details →
  Continue to payment → Pay R…*); direct `/book` entry works; build + lint green.
- **Commit:** `refactor(checkout): 3-step Rooms→Details→Payment shell`

### Phase 3 — Step 1 "Rooms" (in-flow selection)
- **Do:** Build the Rooms step: dates bar (check-in/out), guests popover
  (adults/children/infants), **whole-place toggle** (save 10%, `flexible` only),
  room cards with Add/Remove + select-check + per-room price, live availability
  for the chosen dates (F2). Drive `scope` + `room_ids` + `room_guests`; update
  the dark summary + total via `priceStay()`. Adapt to `booking_mode`.
- **Files:** `book/BookingForm.tsx`, maybe `book/actions.ts`
  (`checkRoomsAvailabilityAction` if needed), `book/CheckoutDateEditor.tsx`.
- **Accept:** Pick rooms or whole place + dates + guests; summary/total correct;
  can't advance without a valid, available selection; build + lint green.
- **Commit:** `feat(checkout): in-flow room, date & guest selection (step 1)`

### Phase 4 — Step 2 "Details"
- **Do:** Guest details form (full name, email, phone, arrival window, trip type,
  message). Add-ons grid wired to real add-ons + units (F1). Coupon input
  (existing `validateCouponAction`). Anonymous guests: collect details now,
  create account at submit via `createCheckoutGuestAccountAction`.
- **Files:** `book/BookingForm.tsx`.
- **Accept:** Step validates (name/email/phone); add-ons + coupon reflected in
  the summary; build + lint green.
- **Commit:** `feat(checkout): guest details + add-ons + coupon (step 2)`

### Phase 5 — Step 3 "Payment" + submit
- **Do:** Payment method (Card/Paystack + manual EFT when host has banking), pay
  panel, legal copy, submit → `createBookingAction` → redirect to Paystack auth
  URL (card) or `/booking/[id]/success` (EFT). Per-step validation; processing
  state.
- **Files:** `book/BookingForm.tsx`.
- **Accept:** Full booking completes end-to-end on **both** rails and lands on
  `/booking/[id]/success`; build + lint green.
- **Commit:** `feat(checkout): payment step + end-to-end booking submit (step 3)`

### Phase 6 — Polish, dynamic-data sweep, docs
- **Do:** Verify no hardcoded content; responsive + reduced-motion +
  keyboard/a11y; final visual pass vs both designs. Help-centre article for the
  new checkout (seed migration into `help_articles`). Update `CHANGELOG.md` +
  `CURRENT_TASK.md`. Live service-role query sweep (per QA memory) if queries
  changed.
- **Files:** help seed migration, `CHANGELOG.md`, `CURRENT_TASK.md`, misc.
- **Accept:** Build + lint green; help article live; changelog updated.
- **Commit:** `docs(checkout): help article + changelog for redesigned booking`

---

## 5. Progress

- [x] **Phase 0** — Plan saved + CURRENT_TASK pointed here
- [ ] **Phase 1** — Listing: display-only + 2 CTAs
- [ ] **Phase 2** — Booking flow 3-step shell
- [ ] **Phase 3** — Step 1 Rooms (in-flow selection)
- [ ] **Phase 4** — Step 2 Details (+ add-ons + coupon)
- [ ] **Phase 5** — Step 3 Payment + submit
- [ ] **Phase 6** — Polish + help article + changelog

## 6. Session notes (append as we go)

- 2026-06-07 — Plan created. Decisions locked: self-contained checkout;
  listing display-only with Reserve + Request-a-quote; quote feature reused
  as-is; real payment rails only; server logic preserved.
