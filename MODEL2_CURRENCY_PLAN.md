# Model 2 — Per-Host Settlement Currency (MVP build plan)

**Status:** proposed, awaiting go-ahead · **Author:** this session · **Date:** 2026-07-18

## Goal
Each **host/business** picks a **settlement currency** (their currency of record).
Their whole world — listings, bookings, quotes, invoices, host ledger, payouts —
denominates in it. Guests browse in a display currency (estimate only) and are
**charged in the host's currency**. **Wielo's own revenue (subscriptions, credits,
add-on products) stays ZAR of record, forever** — a South African company keeps
ZAR books; PayPal-USD is only a collection channel for Flow B.

## Founder decisions (locked)
1. **Curated supported currency set** (not all ISO) — every currency must be
   settleable by at least one rail.
2. **Country pre-fills currency at signup, host can override.**
3. **Native price storage** — a EUR host types €120 and we store `120 EUR` as the
   currency of record. Existing ZAR listings stay ZAR.
4. **International from day one** — full country list in host signup.

## Two money flows (never mix)
| | Flow A — Bookings | Flow B — Wielo revenue |
|---|---|---|
| Guest → **Host** | Host → **Wielo** |
| Merchant of record | **Host** (own Paystack/PayPal, Wielo 0%) | **Wielo** (platform keys) |
| Currency of record | **Host's currency** ← Model 2 | **ZAR always** (do NOT touch) |

---

## The pleasant surprise: the schema is already built for this
- `businesses.country` (`'ZA'`) + `businesses.default_currency` (`'ZAR'`) + `vat_number` already exist.
- `hosts.default_currency` exists (CHECK limited to ZAR/USD — widen it).
- `lib/bookings/createBooking.ts` stamps `listing.currency` onto booking/payment/add-on rows — the chain is data-driven, not hardcoded.
- `lib/payments/pay-booking.ts` Paystack path **already charges `booking.currency`**.
- `lib/currency.ts` + `lib/fx.ts` + `<Money>`/`CurrencyProvider` display layer already exist (ZAR-base only — generalize to cross-rates).
- `lib/phone/dialCodes.ts` = 175 countries (reuse for the picker + country→currency map).

**Net:** Model 2 is a propagation + generalization job, not a rebuild.

---

## Curated settlement-currency set (proposed — confirm)
Rail coverage: **ZAR**=Paystack+EFT · **USD**=Paystack+PayPal+EFT · **EUR/GBP/AUD/CAD**=PayPal+EFT.
Optional Africa expansion (Paystack): **NGN, KES, GHS**.

MVP proposal: **ZAR, USD, EUR, GBP, AUD, CAD** (+ NGN/KES/GHS if Africa is a target).
Each currency carries metadata: symbol, decimals, and which rails can settle it.

---

## Phased build

### Phase 0 — Foundations (no behaviour change, safe to ship alone)
- **`lib/currency.ts`**: promote `DISPLAY_CURRENCIES` → a `SETTLEMENT_CURRENCIES`
  set with metadata (symbol, decimals, `rails: {paystack,paypal,eft}`). Add
  `countryToCurrency` map derived from a countries list.
- **Countries**: build `lib/geo/countries.ts` (full ISO-3166 list, reuse dialCodes
  data) + a `<CountrySelect>` form component.
- **FX cross-rates**: generalize `lib/fx.ts` from ZAR→X to **any base→any quote**
  via a single **USD-pivot** fetch (`rate(A→B) = usd[B]/usd[A]`). Keep the
  `fx_rates` admin-override table. `displayAmount()` gains real cross-conversion
  (today it only converts ZAR sources).

### Phase 1 — Host currency of record
- **Migration** (`db push --linked`):
  - Widen `hosts.default_currency` CHECK → curated set.
  - Add CHECK on `businesses.default_currency` → curated set.
  - New `properties.currency` **inherits the business's `default_currency`**
    (BEFORE INSERT trigger) instead of defaulting `'ZAR'`.
- **Host signup** (`app/[locale]/signup/host/Wizard.tsx`): full country picker →
  pre-fills settlement currency (overridable); persist `country` + `default_currency`
  on the business.
- **Business settings** (`dashboard/settings/businesses/_components/BusinessForm.tsx`):
  currency picker (curated set) = the SSOT for a business's currency. Changing it
  is guarded (warns; only affects NEW listings/bookings — never re-denominates
  existing rows).
- **Listing + add-on + seasonal + deal price entry**: display the business
  currency symbol on inputs; stamp business/listing currency instead of hardcoded
  `"ZAR"` (fix the insert sites found in the audit).

### Phase 2 — Charge path (Flow A) native currency
- **PayPal** (`pay-booking.ts`): charge **native** `booking.currency` when it's
  PayPal-settleable; **only** convert ZAR→USD when the host currency is ZAR
  (PayPal-SA can't hold ZAR). Same rule anywhere else PayPal-for-bookings runs.
- **Paystack**: already charges `booking.currency` — add a guard that the host's
  gateway supports it; otherwise hide the card rail.
- **BookingForm method gating** (correction): gate payment methods by the **host's
  settlement currency** (which rails can settle it) — NOT by the guest's display
  cookie. Removes the odd "switch display to USD to unlock PayPal" behaviour.
- **EFT**: show the host-currency amount + banking (currency-agnostic transfer).

### Phase 3 — Guest display (cross-rate) + trip/quote pages
- `<Money>` / `CurrencyProvider` / `getServerMoneyFormatter`: convert
  **host base → guest display** via cross-rates; converted → `≈` estimate.
- **Trip page + quote page**: **host-currency-primary, guest `≈` estimate**;
  real balance-due / amount-paid / payment-history stay exact in the host currency
  (never an estimate). (Generalizes the paused display work — already partly done.)

### Phase 4 — Tax/VAT jurisdiction (light for MVP)
- VAT is already per-listing (`vat_number` + `vat_rate`). Keep host-entered rate;
  **do not assume 15% for non-SA hosts.** Label generically where a non-SA host
  is involved. Deep cross-border tax = accountant follow-up, not code. Flag only.

### Phase 5 — Wielo revenue guardrail (verify, don't change)
- Confirm Flow B stays ZAR: `lib/billing/*`, `platform_ledger`,
  subscription/plan pricing, `wielo-invoice`/`wielo-credit-note`,
  `lib/billing/product-checkout.ts` (its ZAR→USD PayPal stays as-is).
- Assert host currency never leaks into `platform_ledger`.

---

## Risk & safety notes
- **No re-denomination of existing rows, ever.** A currency change on a business
  affects only new listings/bookings. Existing ZAR data stays ZAR.
- **Pre-MVP data policy** (CLAUDE.md): DB has no real data — destructive reshape is
  fair game, so the migration is low-risk.
- **Security-first** ([[feedback-security-first-always]]): server still re-prices;
  charge currency = f(host currency + method), never the client cookie.
- **Rails gate ambition**: a host can only pick a currency a connected rail can
  settle — the curated set enforces this.

## Out of scope (future)
- Model 3 (platform as merchant of record, dual ledgers, FX float).
- EUR/GBP subscription price points for Wielo (Flow B stays ZAR presentment for now).
- Automated cross-border tax determination.
