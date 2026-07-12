# Seasonal pricing lifecycle (rule → booking price)

> How a host's seasonal rate follows through the whole booking price engine so
> the quoted, charged, and invoiced price agree to the cent. See
> `BUSINESS_PRINCIPLES.md` Principle #12. Status: 🟢 verified live end-to-end
> (guest estimate + server-frozen breakdowns) 2026-07-12.

**Key fact:** seasonal pricing is applied at ONE chokepoint — the canonical TS
engine `lib/pricing/engine.ts::priceStay` (`resolveNightlyRate`). Every surface
that prices a stay calls `priceStay` with the listing's seasonal rules, so none
of them can disagree. Seasonal was already wired; this doc records the flow.

---

### Step 1 — Host defines a season
- Trigger: host adds/edits a rule. Actor: host. Files:
  `dashboard/seasonal-pricing/{page,SeasonalPricingManager,actions}.tsx` (also
  reachable as the wizard's optional **Seasons** step — see `onboarding.md`).
- DB writes: `property_seasonal_pricing` — `property_id`, optional `room_id`
  (room scope beats listing scope), `start_date`/`end_date` (both inclusive),
  `adjustment_type` (`absolute` = flat nightly | `percent` = ± on the room's own
  rate), `adjustment_value`, `priority`, `min_nights`, `is_active`.
- Migrations: created `20260501000002` → room scope + priority
  `20260524000008` → absolute/percent `20260601000001` → renamed to
  `property_seasonal_pricing` `20260617000200/300`.

### Step 2 — The nightly-rate resolution (the SSOT)
- Functions: `engine.ts::resolveNightlyRate(date, unit, rules)` per night, called
  in a per-night loop by `priceStay` (`eachNight`). Precedence for one night:
  1. **Seasonal** rule (via `pickRule`: room-scoped → higher priority → newest).
     - `absolute` → the rule value IS the flat nightly (extra-guest fees for
       `per_room_plus_extra` still add on top; per-person scaling is overridden).
     - `percent` → the base occupancy nightly × (1 ± value%), preserving
       per-guest scaling. Clamped at ≥ 0.
  2. else **weekend** rate on Fri/Sat (`VILO_WEEKEND_DAYS`), unless `per_person`.
  3. else **base** rate.
- Then **occupancy** (`occupancyNightly`) applies the room's `pricing_mode`
  (`per_room` / `per_person` / `per_room_plus_extra`). A seasonal rule overrides
  the weekend rate for that night.
- `effectiveMinNights` = max(listing min, any overlapping active rule's min).
- Because it loops per night, **a stay spanning in-season and out-of-season
  nights prices each night independently**.

### Step 3 — The full stay price (server SSOT, ignores client prices)
- Trigger: guest checkout / quote / re-price. Actor: system.
- Authoritative path: `lib/bookings/createBooking.ts::priceBooking` →
  loads `property_seasonal_pricing` for the stay window (`:514`), maps to
  `SeasonalRule[]`, builds `engineInput.seasonalRules`, calls `priceStay`, then
  layers cleaning (once, never discounted), add-ons, stay discounts
  (whole-place, length-of-stay), and a server-validated coupon.
- **VAT** is applied AFTER the engine by the DB trigger `apply_booking_vat`
  (BEFORE INSERT on `bookings`) — host prices are ex-VAT (net); the guest is
  charged VAT-inclusive.
- DB writes: `bookings.price_breakdown` (frozen itemised breakdown incl.
  `seasonalNights`, per-night source labels), `total_amount`, `vat_amount`.

### Step 4 — Every other price surface uses the same engine
All call `priceStay` with `seasonalRules`, so they equal the charge to the cent:
- Guest checkout estimate — `property/[slug]/book/BookingForm.tsx`.
- Single-room widget — `property/[slug]/rooms/[roomId]/RoomBookingWidget.tsx`.
- On-site (website) quote + create — `lib/website/siteCheckout.ts` → `priceBooking`.
- Host quote / enquiry auto-price + change-dates re-price —
  `lib/pricing/quote.ts::computeStayPricing` (also loads seasonal).
- `/pay` links charge the already-frozen `total_amount` (seasonal baked in at
  creation — no re-price).

**Deliberately NOT seasonal (by design):** host **manual** bookings
(`dashboard/bookings/new` — host sets the price directly) and a special's own
price (`lib/specials/pricing.ts` uses a synthetic max-priority rule; real
seasonal only feeds the was-price shadow). The DB `calculate_booking_price()` is
a seasonal-aware cross-check only, not the live charge path.

---

## Verified (2026-07-12, test host `host@wielotest.com`)

Listing base R1600; rules: Winter Off-Peak −15% (01 Jul–31 Aug), Festive Peak
R2400 (15 Dec–10 Jan, min 3n), Aloe-Suite spring +25% (room-scoped).

- **Guest estimate**, Klein Cottage (base R1000), stay 26 Jun–02 Jul: rooms
  subtotal **R5 850** = 5 × R1000 + **1 season-priced night** (01 Jul, −15% =
  R850); + R120 cleaning + 15% VAT = **R6 866**. The one in-season night priced
  distinctly from the five base nights.
- **Server-frozen** `bookings.price_breakdown`: BK-0037 (28–30 Jul) →
  `seasonalNights=2` @ R1020 (−15% on R1200); BK-0036 (15–18 Dec) →
  `seasonalNights=3` @ R2400 (Festive Peak); BK-0035 (10–12 Dec, before the
  peak starts) → `seasonalNights=0`. The server SSOT froze seasonal per-night.
