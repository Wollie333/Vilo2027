# Lifecycle — Wielo promo codes (discounts on Wielo's own products)

A host types a code at Wielo product checkout and pays less for a membership,
credit pack, service or once-off. Admin-owned, self-serve for the buyer, and
re-validated server-side on every path — the client never sends a price.

Status: **shipped + witnessed live on both surfaces (2026-07-17).**

> **Not the same feature as `docs/lifecycles/coupons.md`.** That one is a HOST's
> coupon discounting a GUEST's stay (booking-shaped: nights, rooms, add-ons).
> This one is WIELO's coupon discounting a HOST's product order. They share a
> metaphor, not a grain — separate tables, separate resolvers, separate UIs.

> **Not comping.** An admin who wants to give a plan away uses **"Activate
> without charging"** (one click, audit-logged) on the user's subscription. Promo
> codes exist for *self-serve marketing* — the host redeems it themselves.

---

## Data model

**`platform_coupons`** — `code` (unique on `upper(code)` platform-wide) ·
`description` (internal note) · `discount_type` percent|fixed · `discount_value` ·
`product_id` XOR `product_type` (both NULL = every product) · `currency` ·
`min_spend` · `starts_at`/`ends_at` · `max_redemptions` · `per_user_limit` ·
`redeemed_count` · `is_active` · `created_by`.

**`platform_coupon_redemptions`** — `coupon_id` + `order_id`
(**UNIQUE together** = idempotency) · `user_id` (nullable: a buyer can pay as a
passwordless lead) · `amount_discounted` · `currency`.

**`product_orders`** gains `coupon_id` + `discount_amount`.
**`platform_ledger.coupon_id`** — the P1.4 placeholder column (a bare uuid with
no FK, all-NULL across 37 rows) was adopted and given its FK rather than adding a
second competing column.

### Why a separate table (decision, 2026-07-17)
`coupons.host_id` is NOT NULL and cascades from `hosts`; `property_id`,
`room_id`, `addon_id`, `min_nights` and `scope` are all meaningless for a product
order. A Wielo code has no host, so it would have to live as `host_id = NULL` in
a table whose entire access model reads "a host owns this row" — and its unique
index is `(host_id, upper(code))`, where **Postgres treats NULLs as distinct**,
so two Wielo codes could silently share a code. Code reuse would have been near
zero either way (different targeting, different redemption object), so the live
booking money path was left completely untouched. Founder approved.

## Money rules
- The discount comes off the **whole order** (price + setup fee) — one rule to
  explain, and it matches how `min_spend` reads.
- `amount = price + setup_fee_amount − discount_amount`. The subtotal is always
  recoverable as `amount + discount_amount`, which is how apply/remove re-price
  **without compounding**.
- **Discounts land on whole Rands.** `formatMoney()` renders whole Rands
  app-wide and every Wielo product is priced in whole Rands, so a percentage was
  the first thing able to produce cents (30% off R599 = R179.70). That would
  print "R 419" while Paystack charged R419.30 — a label that lies. Rounding the
  discount keeps **shown == charged**. Clamped AFTER rounding so a 100%-off code
  on an odd price can't drive an order negative.
- A fixed code is capped at the total: R500 off a R200 item makes it free, never
  −R300.

## Surfaces
1. **`/pay/product/[token]`** — `PromoCodeField`. Covers every admin pay-link and
   the self-serve `/p/[slug]` page (which redirects here). Applying rewrites the
   order row, so Paystack / PayPal / EFT all bill the reduced amount without
   knowing a code was involved.
2. **Signup wizard plan step** — `SignupPromoField`. This path jumps straight to
   the Paystack card form and **skips the pay page**, so without its own field a
   welcome code would be unusable at exactly the moment a new host holds one.
   Shown only when a PAID plan is selected; cleared when the plan changes (a
   Starter-only code must not look applied to another tier). The preview is
   cosmetic — `startSignupCheckoutAction` re-resolves the code server-side.
3. **`/admin/promo-codes`** — list (status badge: Active / Off / Scheduled /
   Expired / Used up, redemption count, total discounted) + a left-rail editor
   (`/new`, `/[id]/edit`) per the create-data default layout, with autosave.

## The money path
`resolvePlatformCoupon(admin, ctx)` (`lib/billing/platform-coupons.ts`) is the
single validation authority — active · window · product/type target · currency ·
`min_spend` · `max_redemptions` · `per_user_limit`. Used by the pay page, the
signup preview, and `createProductOrder`.

**An invalid code FAILS order creation** rather than quietly billing full price
(unlike the website booking quote, which ignores a bad coupon by design).

`redeem_platform_coupon(coupon, order, user, amount, currency)` records the
redemption once the money is real. Called by **every settle path**: Paystack
return (`confirmProductOrderByReference`), PayPal capture
(`capturePayPalProductOrder`), and the webhook backstop (`processProductEvent`).
Idempotent per order, so the return path and the webhook can both run.

### Cap semantics (deliberate)
Caps are enforced when a code is **applied**, not at redemption. By settle time
the buyer has already paid the price they were shown, so refusing to record would
only lose the audit row — it could not un-charge them. The cost: a cap can be
overshot at the margin when several buyers hold pending discounted orders at
once. The alternative (charging someone more than the checkout page promised) is
strictly worse. Same trade-off the booking coupon makes for anonymous per-guest
caps.

## Security
- RLS: admin-only (`is_super_admin()`) on both tables. Buyers never read the
  catalogue — resolution runs server-side via the service-role client, so codes
  can't be enumerated through PostgREST. **Verified: role `anon` sees 0 rows.**
- `redeem_platform_coupon` is `SECURITY DEFINER` with a **pinned `search_path`**
  and `REVOKE ALL … FROM PUBLIC` (not just `anon` — `CREATE FUNCTION` grants
  EXECUTE to PUBLIC by default, which is why every `REVOKE … FROM anon` in this
  repo is a no-op; see `20260716310000`). **Verified: ACL is
  `postgres=X | service_role=X` — no PUBLIC grant.**
- Deleting a redeemed code is blocked server-side (it would cascade its
  redemptions away and rewrite what a buyer was charged) — turn it off instead.

## Verified live (2026-07-17)
Admin editor → created `SAVE30` (30% off Starter) → audit row written
(`target_type='platform_coupon'`, which needed migration `20260717000200` — the
`admin_audit_log` CHECK is a fixed list and would have thrown on every write).
- **Pay page:** bogus code → *"That promo code isn't valid"*, amount stays R 599.
  `SAVE30` → **R 599 → −R 180 → R 419**, and the DB row reads `amount = 419`
  exactly (shown == charged). Remove → back to R 599. Re-apply as lowercase
  `save30` → R 419 again (no compounding, case-insensitive).
- **Signup wizard:** no promo field on Free; selecting Starter reveals it;
  `SAVE30` → *"R 180 off — you'll pay R 419 at checkout"*; switching to Wielo
  Quotes drops it; re-applying the Starter-only code there → *"This promo code
  doesn't apply to this item."*
- **Redemption:** `redeem_platform_coupon` called twice on the real order →
  1 redemption row, `redeemed_count = 1` (idempotent).

## Not verified / open
- 🔴 **No card or PayPal settlement was witnessed end-to-end** — that needs real
  payment details, which the agent may not enter. The redemption RPC is proven
  against the real order; the settle *callers* are proven only by build + types.
  **Founder smoke-test needed.**
- ⚠️ **EFT product orders have no settle path at all** (pre-existing, not this
  feature): `recordProductEftIntent` says "Settling happens when the admin marks
  it received", but no such admin action exists — so an EFT product order never
  becomes `paid`, no plan activates, and no promo redemption is recorded. Promo
  codes are no worse off than the rest of the EFT flow. Needs a decision.
- Codes are not restricted by buyer segment (e.g. new hosts only) — `per_user_limit`
  is the only per-person control.
