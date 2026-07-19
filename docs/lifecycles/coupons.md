# Lifecycle — Coupons (HOST discount codes for BOOKINGS)

Guests type a code at checkout; the host defines the code, discount, targeting,
validity window and caps. Every redemption is re-validated server-side — the
client is never trusted for eligibility.

Status: **create/edit on the left-rail editor pattern + autosave (2026-07-13).**

> **Scope:** this is a HOST's coupon against a GUEST's stay (`coupons` table,
> booking-shaped). **Wielo's own promo codes** — a host paying less for a Wielo
> membership / credit pack / service — are a separate feature on a separate
> table: see [`platform-coupons.md`](./platform-coupons.md). Don't cross-wire
> them; `resolveCoupon()` here requires nights/rooms and cannot price a product.

---

## Data model (`coupons` table)
`code` (unique per host, uppercased) · `description` (private note) ·
`discount_type` percent|fixed · `discount_value` · `scope` order|accommodation|addons ·
`property_id` / `room_id` / `addon_id` (targeting) · `min_nights` · `min_spend` ·
`starts_at` / `ends_at` (day-open/day-close UTC) · `max_redemptions` ·
`per_guest_limit` · `redeemed_count` · `is_active`. Validation in
`app/[locale]/dashboard/coupons/schemas.ts` (`couponInputSchema`).

## Host create/edit — left-rail editor
- **Pages:** `/dashboard/coupons/new` (create) · `/dashboard/coupons/[id]/edit`
  (edit). Shared data loader `_data.ts` (listings + active rooms + active add-ons).
- **`CouponEditor.tsx`** — identity bar (autosave indicator) + 4-step rail:
  1. **Details** — code, internal note, active toggle.
  2. **Discount** — type (%/amount), value, scope, and listing/room/add-on targeting.
  3. **Limits & validity** — dates, min nights, min spend, max redemptions, per-guest cap.
  4. **Review** — readiness checklist + summary rows with quick-edit jumps + the
     single Create/Save CTA (identity-bar button hides on Review — one primary
     button on the last step).
- **Live guest preview** (docked in the rail): the code as a checkout chip with a
  worked example (25% off a R2,400 order = −R600 → guest pays R1,800), recomputing
  as the host edits.
- **Auto-save drafts** (`entity_type:"coupon"`, see `docs/lifecycles/autosave-drafts.md`):
  whole-form snapshot, resume banner, cleared on save.
- **List** (`CouponsManager.tsx`) — cards with a live status badge (Active /
  Off / Scheduled / Expired / Used up), inline turn-on/off + delete, edit → the
  edit page. (The old modal `CouponDialog` was removed.)

## Server actions (`actions.ts`)
`createCouponAction` / `updateCouponAction` (Zod re-validate + ownership checks
on listing/room/add-on targets + duplicate-code guard) · `toggleCouponActiveAction`
· `deleteCouponAction`. All RLS-scoped to the host.

## Redemption (guest checkout) — the money path (`lib/coupons.ts`)
`resolveCoupon(admin, ctx)` is the single validation authority, used by both the
guest preview (`validateCouponAction`) and the authoritative booking action:
- active · within `starts_at`/`ends_at` · listing/room/add-on target matches the
  cart · `min_nights` · `max_redemptions` (total cap) · `per_guest_limit`
  (pre-check for a friendly message) · `min_spend` on the eligible subtotal.
- The **atomic** per-guest cap + final decrement happen in the `redeem_coupon()`
  DB function at booking time (`coupon_redemptions` ledger + `redeemed_count`).
- The discount reduces the eligible subtotal (scope-dependent); VAT is recomputed
  on the discounted base.

## Verified live (2026-07-13)
Create via the new editor → guest preview recomputes → autosave local+server →
list shows it → edit loads the values → applied at checkout: **25% off a R4,080
stay = −R1,020, VAT recomputed to R504, total R5,037 → R3,864.**

## Deep audit — 2026-07-16 (full-matrix pass)

**Stacking / order of operations** (`lib/pricing/engine.ts` `couponDiscountFor`,
applied LAST on the already stay-discounted base; cleaning never eligible):
- Coupons DO stack with seasonal/weekend/LOS/whole-property discounts + add-ons.
- Coupons do NOT stack with **specials/deals** — `lib/specials/pricing.ts` hardcodes
  `couponDiscount: 0` and deal checkout never passes a coupon. Intentional.

**Fixed: invoice now itemizes the coupon discount.** `ensure_booking_invoice` built
`line_items` with NO discount line, yet both invoice renderers (`invoice/[token]/
page.tsx` + `pdf/route.ts` → `InvoiceDocument`) already read `line_items.discount_amount`
— so the reduction was baked into the total but invisible on the document. Migration
`20260716130000` adds `discount_amount` + `coupon_code` to `line_items`; renderers now
show "Discount (CODE) − R…". **Verified** via a ROLLBACK txn: a freshly generated
invoice for a coupon booking emitted `discount_amount:250, coupon_code:AUDIT10`.
- NOTE: `ensure_booking_invoice` is create-if-missing (not regenerate) — the line
  appears on invoices generated AFTER a coupon is set (new coupon bookings). Fine
  pre-MVP (no real invoices to backfill).

**By-design / deferred (not bugs):**
- Feature gate stubbed open (`actions.ts` `assertFeatureEnabled` → true, pre-MVP
  AGENT_RULES §3.4). Restore `check_feature_permission` before paid tiers.
- Per-guest cap unenforceable for anonymous checkouts (only the total cap applies;
  the DB per-guest cap needs a signed-in `guest_id`).
- No currency guard in `resolveCoupon` (coupon vs booking currency) — impossible today
  (frontend ZAR-locked); add when multi-currency arrives.
- No admin UI for HOST coupons — admin access is DB-only via RLS
  `is_super_admin()`. (Still true. `/admin/promo-codes` added 2026-07-17 manages
  **Wielo's own** promo codes, a different table — it does not surface these.)
- Cosmetic: FK names `coupons_listing_id_fkey`/`_room_id_fkey` still say "listing"
  after the `property_id` column rename.

## Live-green e2e — 2026-07-19 (real bookings, both VAT states)

First true end-to-end exercise of the money path (0 coupon bookings existed before).
Driven as a real authed guest through the 3-step checkout on `mana-bush-lodge`.

- **Non-VAT host** — `SAVE20` (20% order) on Tamboti 2 nights (R10 800) →
  guest preview −R2 160 → **server re-priced identically** (BK-0078: `coupon_id`,
  `coupon_discount 2160`, total R8 640) → `redeem_coupon` fired (`coupon_redemptions`
  row R2 160 + `redeemed_count` 0→1) → **coupon line item shows for guest** (trip
  receipt) **and host** (booking Payments card) → invoice INV-0102 itemizes it.
- **VAT-registered host** — set the property VAT number, `VATTEST20` (20% order) →
  **VAT recomputed on the DISCOUNTED base**: R10 800 ex-VAT − R2 160 → R8 640,
  VAT 15% = R1 296, total R9 936 (BK-0079). Invoice INV-0103 = **Tax Invoice** with a
  proper **VAT (15%) R1 296** line beside the discount, foots to R9 936.

### 🔧 FIXED — invoice showed phantom VAT = the discount (non-VAT hosts)
Both invoice renderers stored `subtotal` NET of the discount (`total − vat`) yet showed
a separate discount line, so the totals block couldn't foot. Worse, the **hosted page
re-derived** VAT as `total − (subtotal − discount)` = `vat_stored + discount` → a non-VAT
host's coupon invoice fabricated a VAT line equal to the discount and mislabelled itself a
**Tax Invoice**. Fix (presentation-only, no stored-data change, no-discount invoices
byte-identical): show Subtotal **pre-discount** (`subtotal + discount`) and trust the stored
`vat_amount` (never re-derive). Files: `invoice/[token]/page.tsx`,
`invoice/[token]/pdf/route.ts`. Verified live (hosted HTML + rastered PDF) for both VAT and
non-VAT: Subtotal → Discount (CODE) → [VAT (15%) if registered] → Total, all footing.

### Known behaviour (not changed) — redemption not released on cancel
`on_booking_cancelled` releases blocked_dates + **special** redemptions, but NOT coupon
redemptions — a cancelled/declined coupon booking keeps consuming `redeemed_count` +
`per_guest_limit`. Defensible (anti cancel-rebook farming) but inconsistent with specials;
founder to decide if cancel should return a coupon slot.

## Follow-ups / ideas
- Preview could note "won't apply below R{min_spend}" when a minimum is set.
- Copy-code affordance + clone-coupon on the list.
- Scheduled/expired coupons are flagged on the list; a prune of long-expired ones
  could be added with the autosave TTL cron.
