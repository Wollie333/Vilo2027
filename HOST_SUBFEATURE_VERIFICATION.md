# Host Sub-feature Verification — Specials · Coupons · Add-ons · Calendar sync · Policies · Reviews

> **Goal (founder):** every host sub-feature must be seamless and work. Drive the real
> host UI (host@wielodemo.com, logged in), assert every side-effect in the DB via
> service-role, fix on the spot. A box flips to ✅ only with real evidence.
>
> **Legend:** ⬜ not tested · 🔄 testing · ✅ verified live+DB · ⚠️ works w/ caveat · 🔴 broken
>
> **Integration backstop:** `pnpm test:flows` (93/0) already exercises the BOOKING side of
> these (specials redemption = journey X, add-ons on invoice = S/O, coupon pricing, policy
> snapshot = I6). This doc verifies the HOST-FACING management flows end-to-end.

---

## 1. Specials
**User flow:** Dashboard → Specials → New special → set title/dates/price/quantity → publish →
appears in directory/website → guest books → `redemptions_used` increments → sold-out caps →
cancel releases the redemption.

- ✅ Create a special via the UI wizard (9-step; details autosave as you go)
- ✅ Configure fixed-date + flat price + quantity; **publish → `status=active`** (DB-verified:
  `midweek-escape-3-nights-special-rate`, Seaview Cottage, fixed 2026-08-18→21, flat R3000)
- ✅ Flagged for storefront: `show_in_directory=true`, `show_on_website=true`
- ✅ Booking increments `redemptions_used`; sold-out cap = `special_redemptions_within_cap` CHECK +
  race-safe `redeem_special` (integration: harness X + DB constraints)
- ⚠️ Cancel releases exactly one redemption — C1 fix staged `20260801250000`, NOT yet pushed (still
  double-decrements on cloud; harness X2 documents it)
- ⚠️ Gate correctly LOCKS Free (upgrade prompt) + grants entitled host (source=product) ✅. Minor: a
  transient "1 error" toast appeared during the wizard but publish succeeded (non-blocking — likely an
  autosave hiccup / hero-image-needs-website notice); worth a glance.

## 2. Coupons
**User flow:** Dashboard → Coupons → New coupon → % or fixed, limits/expiry → guest applies at
checkout → server recomputes discount → usage tracked → limit/expiry enforced → released on unwind.

- ✅ Create a % coupon via the UI wizard (4-step: Details→Discount→Limits→Review). DB-verified:
  `VERIFY10`, discount_type=percent, value=10, scope=order, is_active=true. "Coupon created" toast.
- ✅ Live guest preview in the editor shows the discount applied (R2400 → −R240 → R2160) — the
  discount math renders correctly before save
- ✅ Scope (order/accommodation/addons) + limits/expiry + per-guest limit all in the wizard (schema
  enforces %≤100, room/addon targeting matches scope, ends_at≥starts_at)
- ✅ Applies at checkout server-side (`priceBooking` recomputes; harness coupon-pricing coverage);
  `redeemed_count`, coupon_discount on booking + invoice discount line (harness T + release-on-unwind
  migration `20260719210000`)
- ⚠️ **Coupons is NOT feature-gated** (`assertFeatureEnabled → return true`) — open to every host incl.
  Free, unlike its siblings. Config decision needed (see findings).

## 3. Add-ons
**User flow:** Dashboard → Add-ons → New add-on → pricing model (flat / per-night / per-person /
per-unit) + required/optional + stock → guest selects at checkout → priced server-side → lands on
invoice → stock decrements.

- ✅ Create add-on via the UI (draft → 6-step editor → save). DB-verified: "Guided sunset hike",
  `pricing_model=per_guest_per_night`, `unit_price=250`, `category=experiences`. "Add-on saved" toast.
- ✅ **5 pricing models** offered (Per booking / night / guest / person / couple); guest-pays preview
  computes live (R250 × 2 guests × 2 nights = R1000)
- ✅ Existing seeded add-ons render correctly (Daily breakfast R120 per-person/night; Welcome wine
  basket R500 per booking) with their models
- ✅ Required/optional, stock ("blank = unlimited, sells out at 0"), min/max quantity all in the editor
- ✅ Add-on lands on `booking_addons` + invoice `line_items.addons` (integration: harness S/O)
- ✅ Gate grants entitled host (Business, source=product); correctly LOCKS Free

## 4. Calendar sync (iCal)
**User flow:** Dashboard → Calendar sync → add import URL (Airbnb/Booking.com) → sync pulls VEVENTs
→ writes `blocked_dates` (source `ical`) → dates unavailable. Export: token-gated `.ics` feed with
a generic SUMMARY (no guest PII). SSRF guard on import.

- 🟢 **CODE-VERIFIED (2026-08-01)** — full path mapped + read; see file:line below. Live host-UI
  click still pending founder (add/remove a real feed), but the mechanism is sound end-to-end.
- 🟢 Add an import feed — `addIcalFeedAction` (`calendar-sync/actions.ts:45`) Zod + `assertFullHost`
  + `assertOwnsListing` + room-belongs-to-listing guard → inserts `ical_feeds` via the **RLS-scoped**
  client (so `host_manage_own_ical_feeds` also gates); `23505` → "already added".
- 🟢 Sync writes `blocked_dates` (source `ical`) — `syncFeed` (`lib/ical-sync.ts:50`) → RPC
  `import_ical_blocks` (`20260707140000`): `SECURITY DEFINER`, deletes only THIS feed's `source='ical'`
  rows then inserts `ON CONFLICT … DO NOTHING` (manual/booking/quote_hold blocks always win),
  service_role-only. Parser skips `STATUS:CANCELLED`, clamps to `[today, today+2yr]`, caps 1000 dates.
- 🟢 Export feed `/ical/[property_id]/[token]` (`app/ical/.../route.ts:16`) — UUID gate, 503 if
  `ICAL_TOKEN_SECRET` unset, HMAC `verifyListingToken` → 401 on mismatch. **Generic SUMMARY / no PII:**
  `collapseConsecutiveDates` (`lib/ical.ts:167`) emits only `"Booked"`/`"Blocked"` (+ room name),
  **never echoes the `reason` free-text**; no ATTENDEE/mailto. Smoke: `smoke-ical-export.mjs` asserts
  `!/mailto:|ATTENDEE/`.
- 🟢 Import SSRF guard (`lib/security/ssrf.ts`) — http(s) only; resolves DNS `lookup(all:true)`, rejects
  if ANY resolved addr is private/loopback/link-local/ULA/CGNAT incl. `169.254.0.0/16` metadata;
  `fetchGuarded` re-validates on **every redirect hop** (`redirect:"manual"`, max 5) — closes the
  TOCTOU/redirect bypass.
- 🟢 Remove feed clears only ITS `ical` blocks — `removeIcalFeedAction` (`actions.ts:96`): ownership
  verified FIRST via RLS client, THEN admin delete scoped `.eq("ical_feed_id",feedId).eq("source","ical")`
  (never another host's), then the `ical_feeds` row.
- Smoke scripts exist: `apps/web/scripts/smoke-ical-{export,import,cron}.mjs` (+ unit/integration tests).
- ⬜ **Founder live click:** add a real Airbnb/Booking.com feed in the UI, sync, confirm dates block; remove it.

## 5. Policies
**User flow:** Dashboard → Policies → create/edit cancellation policy → assign to listing →
snapshot freezes at booking creation → drives refund math → host edits don't touch live bookings.

- 🟢 **CODE + DB-VERIFIED (2026-08-01)** — path mapped + read; live-DB probe `verify-policy-resolver.mjs`
  run (see below). Live host-UI click (create/assign) still pending founder.
- 🟢 Create / edit a policy — `createPolicyAction`/`updatePolicyAction` (`dashboard/policies/actions.ts:276`,
  `:304`) write `policies` (type=cancellation) + child `policy_cancellation_rules` (tiers: `days_before`
  0-3650, `refund_percent` 0-100, UNIQUE per `days_before`, max 12) + `policy_content`. **No
  `cancellation_policies` table** — generic `policies` domain (`20260502000000`).
- 🟢 Assign to a listing — `setListingPolicyAction` (`actions.ts:877`) → join table `property_policies`
  (listing-wide `room_id=null` or per-room). Resolution precedence (`resolve_listing_policy_id`,
  `20260610180000`): room override → listing-wide → host active default → NULL. **Probe: 2/2 published
  listings resolve a cancellation policy** ✅.
- 🟢 Snapshot freezes on booking creation — `snapshot_booking_policies` RPC called from **all 4
  production paths**: `lib/bookings/persist.ts:330`, quote-convert `accept-convert.ts:285`, host-manual
  `bookings/new/actions.ts:322`, quote actions `:1516`. Captures full tiers into `snapshot_data` jsonb,
  `ON CONFLICT (booking_id,policy_type) DO NOTHING` (`20260712140000`). ⚠️ It's a **best-effort RPC (not
  a trigger)** — on failure it alerts admins but does NOT unwind the booking (missing snapshot → 0% refund).
- 🟢 Refund math reads the snapshot, not the live policy — `calculate_policy_refund_amount`
  (`20260502000004`) reads `policy_snapshots.snapshot_data->'rules'`, walks tiers DESC, first threshold
  wins. **Probe: refund calc → `{rule_applied:"Full refund", refund_percent:100}`** for a snapshotted
  booking ✅. App caller `lib/bookings/cancel.ts:51`.
- 🟢 Editing the policy does NOT change an existing snapshot — immutability trigger
  `forbid_policy_snapshot_mutation` (`20260712150000`): UPDATE always blocked; DELETE only inside the
  GDPR purge (GUC-gated). So post-booking edits can't alter an existing booking's refund entitlement.
- ⚠️ **Finding (demo-data hygiene, NOT a prod bug):** 9/15 bookings in the demo DB had **no cancellation
  snapshot** — all seed-created via direct insert (`seed-demo.mjs`/`seed-analytics.mjs` bypass
  `persist.ts`, never call the snapshot RPC). Production paths all snapshot. **Consequence for the
  founder:** cancelling a *seeded* demo booking returns 0% refund and looks broken. **Fixed** `seed-demo.mjs`
  to call `snapshot_booking_policies` after each booking insert (re-seed to heal). To live-verify refund
  math, cancel a booking **created through the UI** (which snapshots), not a pre-seeded one.
- ⬜ **Founder live click:** create a policy in the UI, assign to a listing, make a booking, then edit the
  policy and confirm the existing booking's terms are unchanged.

## 6. Reviews
**User flow:** Dashboard → Reviews → request review → guest submits (token) → host notified →
host responds → aggregate rating recalculated → flag → moderation.

- ✅ Host responds → `review_response_guest` fires (in_app+email); edit doesn't re-notify (2026-08-01)
- 🟢 **CODE + DB-VERIFIED (2026-08-01)** — path mapped + read; live-DB probe `verify-reviews.mjs`
  **all green** (after fixing a stale `reviews→properties` embed in the probe to use the
  `!reviews_listing_id_fkey` hint the real dashboard loader uses).
- 🟢 Request a review — SSOT `sendReviewRequest` (`lib/reviews/request.ts:32`): eligibility gate
  (completed + paid + no existing review), account guest → `dispatchEvent(review_request_guest)` + system
  card w/ tokenised link; account-less → direct transactional email. Host-initiated
  `requestReviewsAction` (`dashboard/reviews/actions.ts:21`) stamps `review_request_queue.sent_at` to
  block double-fire. Auto-request: `enqueueReviewRequest` at checkout (`send_at = now+60min`) →
  `review-request-worker` (bearer-gated) drains + daily 09:00 backstop cron (`20260610000002`).
  ⚠️ Copy mismatch: UI says "5 minutes", actual delay = 60 min (functionally harmless; worker is
  delay-agnostic).
- 🟢 Guest submits via token-gated link → `reviews` row — public page `review/[bookingId]/page.tsx`
  (`force-dynamic`, token gate) + `submitReviewAction` (`actions.ts:48`): HMAC `verifyReviewToken`,
  admin client (guests have no INSERT RLS), booking gates (completed + checked_out + no existing), insert
  scoped to booking, `is_published:true` (publish-immediately, `20260716260000`). Photos scoped to
  `${bookingId}/` folder.
- 🟢 `new_review_host` fires to the host — dispatched from `submitReviewAction:177` (resolves host
  `user_id`), registry `registry.ts:800` (dedupe `new_review:{review_id}`), resolver `misc.ts:166`,
  email template registered.
- 🟢 Aggregate rating recalculated — trigger `trigger_review_published` AFTER INSERT OR UPDATE OF
  is_published (`20260610000001:127`) → `on_review_published()` recomputes `properties.avg_rating/
  total_reviews` AND `hosts.avg_rating/total_reviews` (re-created against renamed cols in
  `20260617000300:2129`).
- 🟢 Flag a review → `review_flags` — `flagReviewAction` (`actions.ts:258`): reason enum,
  `assertReviewOwnership`, insert `review_flags` (RLS `host_flag_own_reviews` + UNIQUE per flagger,
  `20260716330000`), sets `reviews.flagged`. Admin moderation queue `admin/reviews` (hide/restore via
  `withAdminAudit`, `reviews.moderate`).
- ⬜ **Founder live click:** request a review from the dashboard, open the tokenised link, submit as a
  guest, confirm the host notification + the aggregate rating bump + flag→moderation.

---

## 🔴 BLOCKER found (2026-08-01) — feature gating is ENFORCED; test host is locked out

- `PRE_MVP_FEATURES_OPEN = false` in `apps/web/lib/products/featureGate.ts` — the pre-MVP
  "all features open" switch (AGENT_RULES §3.4) is OFF, so `hostHasFeature` resolves via the real
  `check_feature_permission` RPC.
- Demo host (`host@wielodemo.com`, Cape Coast Retreats): subscription `active`, **`plan='free'`,
  `product_id=null`** → every feature resolves `is_enabled=false, source=default`.
- **Gated features (LOCKED for the test host):** Specials, Coupons, Add-ons, Policies — each has a
  `canUse…`/`hostHasFeature` gate at the UI + action layer. Specials page shows *"Specials aren't on
  your plan yet — Upgrade your plan."*
- **Un-gated (accessible):** Calendar sync, Reviews (no feature gate).
- **Impact:** the founder can't smoke-test 4 of 6 features until the test host is entitled. This is
  also a real launch decision: which of these are free-tier vs paid, and is gating meant to be ON now.

**To verify, the test host needs entitlement** — options: (a) host-level feature overrides for the
test host (`source=host`, scoped, realistic), (b) assign a product/plan that grants them, or
(c) flip `PRE_MVP_FEATURES_OPEN=true` for testing (bypasses gating; must not ship if launch gates).

### ✅ RESOLVED — "Maximum update depth exceeded" was a DEV-mode artifact, NOT a production bug
Fired in dev (Add-on editor) alongside the "1 error" toast. **Confirmed via a clean production build**
(`pnpm build` → BUILD_ID `9wAu…`, exit 0; `next start`): under aggressive interaction — 5 rapid
pricing-model switches, price edits, toggle flips, and a Save — the prod build produced **ZERO console errors**
(no "Maximum update depth", no "1 error" toast), and the Save succeeded. Root cause: React StrictMode
double-invocation + HMR noise in the degraded Next 14.2.35 dev server (same session that threw blank screens +
SSR `useContext` errors). Static proof the code is loop-free: AddonEditor has NO useEffect, no render-phase
setState, no render-phase toast; all handlers clean; autosave `draftValue` fields are stable primitives;
`useAutosaveDraft` has correct deps/refs. **No code change needed.** (Aside: the prod build itself is green —
a useful launch signal.)

## Evidence log (append as verified)

- **2026-08-01 — Feature-gating blocker (above).** `check_feature_permission` returns
  `is_enabled=false, source=default` for specials/coupons/addons/policies (+ reviews/calendar_sync,
  which don't gate). `PRE_MVP_FEATURES_OPEN=false`; demo host has no product.
  **Founder decisions:** gating is INTENDED (paid features); entitlement matches the host's
  product/subscription.

### 🔴 CONFIG FINDINGS (founder's admin domain — flag before launch)
Gate behavior with enforcement ON (`PRE_MVP_FEATURES_OPEN=false`):
| Feature | Gate | Free host | Granted by product |
|---|---|---|---|
| Specials | real `hostHasFeature("specials")` | LOCKED ✅ | Beta, Founder, Starter |
| Add-ons | real `check_feature_permission("addons")` | LOCKED ✅ | **Beta only** |
| Policies | real `check_feature_permission("policies")` | LOCKED ✅ | **Beta only** |
| Coupons | `assertFeatureEnabled → return true` | **OPEN** ⚠️ | none |
| Calendar sync | no gate | OPEN | n/a |
| Reviews | no gate | OPEN | n/a |

1. **Coupons is still the pre-MVP short-circuit** (`return true`) while its siblings enforce — so it's
   open to every host incl. Free, inconsistent with "coupons is a paid feature." Decide: gate it (real
   `check_feature_permission("coupons")` + grant on the paid products) or keep it free.
2. **Add-ons + Policies are granted ONLY by the internal "Beta" (business, R0) product — NOT by the
   real paid tiers Founder (pro, R599) or Starter (pro, R999).** So a host who BUYS a pro plan gets
   Specials but CANNOT use Add-ons or Policies. Almost certainly a product-config gap — the pro
   products need `addons` + `policies` (+ `coupons` if gated) added in the admin ProductEditor.
3. The demo/test host has `product_id=null` (Free) — to verify the paid features, assigned it to the
   **Beta** product (grants specials/addons/policies via `source=product`) — the proper
   product/subscription path per the founder's decision.
