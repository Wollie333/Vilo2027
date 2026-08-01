# Sub-feature User Flows — Host POV + Guest POV

> **Purpose (founder):** double-check every host sub-feature works end-to-end from BOTH the host's
> and the guest's point of view. Each feature below maps the HOST flow (create/manage) and the GUEST
> flow (discover/book/apply/see), with the verification status of each step.
>
> **Legend:** ✅ verified live+DB · 🟡 verified via harness/integration (not yet clicked live) · ⬜ pending
> · ⚠️ works w/ caveat · 🔴 broken
>
> **Test host:** host@wielodemo.com (entitled to paid features via the **Beta** product for testing).
> **Backstop:** `pnpm test:flows` (93/0) exercises the guest/booking side (redemption, coupon pricing,
> add-ons on invoice, policy snapshot). This doc adds the explicit host+guest UI flows.

---

## 1. SPECIALS (pre-packaged deals)

### Host flow
1. Dashboard → **Specials** → **New special** ✅
2. 9-step wizard: Details (title/description) → Property → Dates (fixed / flexible window) → Pricing
   (flat total / per-night) → Availability → Extras → Merchandising → Publish → Review ✅
3. **Save & publish** → `specials.status = 'active'` ✅ (DB-verified: `midweek-escape-3-nights-special-rate`,
   Seaview Cottage, fixed 2026-08-18→21, flat R3000, `show_in_directory/show_on_website = true`)
4. Special appears in the directory + on the host website 🟡 (flags set; storefront render pending live click)
5. Pause / expire flips it off the storefront ⬜ (`expire_specials()` cron + status toggle)

### Guest flow
1. Guest discovers the special — Wielo directory `/c/[category]` or the host's website Specials page,
   or a direct deal link `/deal/[slug]` 🟡
2. Guest opens the deal → sees title, dates, flat/per-night price, savings badge, `was_price` 🟡
3. Guest books the special → `redeem_special()` claims one unit (race-safe, row-locked) →
   `bookings.special_id` set, `redemptions_used++` 🟡 (harness X)
4. **Sold-out cap**: once `redemptions_used = quantity`, `redeem_special` returns false → booking refused 🟡
   (DB `special_redemptions_within_cap` CHECK)
5. Booking funnels through the ONE persist tail (`persistBookingAndPay`) — invoice, blocks, notifications 🟡
6. **Cancel releases the redemption** ⚠️ — should drop by exactly 1, but C1 double-decrement (staged fix
   `20260801250000`, not yet pushed) drops by 2. Harness X2 documents it.

---

## 2. COUPONS (discount codes)

### Host flow
1. Dashboard → **Coupons** → **New coupon** ✅
2. 4-step wizard: Details (code + internal note + active) → Discount (% or fixed) → Limits & validity
   (scope order/accommodation/addons · usage limit · expiry · per-guest limit) → Review ✅
3. **Create coupon** → `coupons` row ✅ (DB-verified: `VERIFY10`, percent/10/order/active)
4. Live guest preview inside the editor shows the discount applied (R2400 → −R240 → R2160) ✅

### Guest flow
1. Guest enters the code at checkout (app checkout / host website checkout) 🟡
2. Server **recomputes** the discount (never client-trusted) via `priceBooking` → `coupon_discount` on the
   booking 🟡 (harness coupon pricing)
3. Invoice shows the discount line (`line_items.discount_amount` = coupon) 🟡 (harness T)
4. **Limits enforced**: usage limit (`max_redemptions` vs `redeemed_count`), expiry (`ends_at`),
   per-guest (`per_guest_limit`), min nights / min spend 🟡
5. On booking cancel/unwind the coupon redemption is **released** 🟡 (migration `20260719210000`)
6. ⚠️ **Coupons is NOT feature-gated** (`assertFeatureEnabled → return true`) — every host incl. Free can
   use it, unlike its paid siblings. Founder config decision.

---

## 3. ADD-ONS (optional extras)

### Host flow
1. Dashboard → **Add-ons** → **New add-on** (or start from a Template) ✅
2. 6-step editor: Details (name/category/description) → Pricing (5 models: per booking / night / guest /
   person / couple) → Availability (which listings & rooms, lead time, daily capacity) → Photo → Review ✅
3. Set price + stock + required/optional + min/max quantity → **Save** ✅ (DB-verified: "Guided sunset hike",
   `per_guest_per_night`, R250, category experiences)
4. Live guest-pays preview computes correctly (R250 × 2 guests × 2 nights = R1000) ✅
5. Toggle Active → live to guests; assign to specific listings/rooms ✅ (existing seeded add-ons show this)

### Guest flow
1. At checkout the guest sees the "extras" list — the add-ons offered on that listing/room 🟡
2. Guest selects add-ons (+ quantity where allowed); **required** add-ons are pre-included 🟡
3. Server prices the selection (per the model) → `booking_addons` rows 🟡 (harness O)
4. Add-on lines land on the invoice `line_items.addons` 🟡 (harness S)
5. **Stock** decrements on booking; sells out at 0 (blank = unlimited) 🟡
6. On cancel, non-refundable add-ons are retained before the policy refund (per the `is_refundable` flag) 🟡

---

## 4. POLICIES (cancellation policies)

### Host flow
1. Dashboard → **Policies** → create / edit a cancellation policy (tiers, refund %, windows) ⬜ (live click)
2. Assign a policy to a listing ⬜
3. Gate: entitled via Beta product (source=product) ✅; correctly locks Free ✅

### Guest flow
1. Guest sees the cancellation policy at booking time 🟡
2. **Snapshot frozen** at booking creation (`policy_snapshots`) — host edits later do NOT change an
   existing booking's terms 🟡 (harness I6 + immutability trigger `20260712150000`)
3. On cancel, the **refund math reads the snapshot**, not the live policy 🟡 (harness cancellation path)
4. Refund → credit note / refund request per the frozen policy 🟡

---

## 5. CALENDAR SYNC (iCal import/export)

### Host flow
1. Dashboard → **Calendar sync** → add an import URL (Airbnb / Booking.com `.ics`) → `ical_feeds` row ⬜
2. Sync pulls VEVENTs → writes `blocked_dates` (source `ical`) ⬜ (`syncFeed` / `/api/ical-sync-worker`)
3. Import **SSRF guard** — resolves DNS, rejects private/metadata IPs, re-validates every redirect hop 🟡
   (verified in code, `SECURITY_CHECKLIST` §11)
4. Remove feed clears only ITS `ical`-sourced blocks (never another host's) 🟡 (ownership-gated)

### Guest flow
1. Imported blocked dates read **unavailable** to the guest at checkout 🟡 (`listing_is_available_whole`)
2. Export: the host's Wielo calendar is a **token-gated `.ics`** feed at `/ical/[property]/[token]`,
   with a generic SUMMARY (no guest PII) — other platforms import it to avoid double-booking 🟡

---

## 6. REVIEWS

### Host flow
1. Dashboard → **Reviews** → request a review (email + in-app enqueued) ⬜ (live click; `sendReviewRequest`)
2. Host is notified `new_review_host` when a guest submits 🟡
3. Host **responds** → `review_response_guest` fires to the guest ✅ (live-verified 2026-08-01: in_app+email;
   editing the reply does NOT re-notify — first-reply guard holds)
4. Host can **flag** a review → admin moderation queue (`review_flags`) ⬜
5. Aggregate listing rating recalculated on new review (trigger) 🟡 (Reviews page showed 4.80 avg + 20% reply)

### Guest flow
1. Guest receives the review request (24h after checkout cron, or host-initiated) 🟡
2. Guest submits via a **token-gated** link (no login) → `reviews` row 🟡
3. Guest is notified when the host replies (`review_response_guest`) ✅ (proven)

---

## Cross-cutting

- **Feature gating** (`PRE_MVP_FEATURES_OPEN = false`, enforced): Specials/Add-ons/Policies gate via the
  real RPC and correctly lock Free (upgrade prompt) ✅. **Config gaps for the founder:** coupons is ungated
  (open to all); Add-ons/Policies are only granted by the internal Beta product, NOT the paid pro tiers
  (Founder/Starter) — a paying host currently can't use Add-ons/Policies. Fix in admin ProductEditor.
- **Server-authoritative money:** every guest-facing price (special, coupon, add-on) is recomputed
  server-side; the client is never trusted (harness-proven).
- **"Maximum update depth" React error** in the CMS editors: ✅ RESOLVED — confirmed a DEV-only artifact
  (StrictMode + HMR). A clean production build (`pnpm build`, exit 0) + `next start` under aggressive editor
  interaction produced ZERO console errors. No code change needed; the prod build is green.
