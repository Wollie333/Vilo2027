# Lifecycle — Coupons (discount codes)

Guests type a code at checkout; the host defines the code, discount, targeting,
validity window and caps. Every redemption is re-validated server-side — the
client is never trusted for eligibility.

Status: **create/edit on the left-rail editor pattern + autosave (2026-07-13).**

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

## Follow-ups / ideas
- Preview could note "won't apply below R{min_spend}" when a minimum is set.
- Copy-code affordance + clone-coupon on the list.
- Scheduled/expired coupons are flagged on the list; a prune of long-expired ones
  could be added with the autosave TTL cron.
