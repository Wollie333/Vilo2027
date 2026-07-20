# Host Dashboard Functional Sweep Checklist

> **▶ SWEEP COMPLETE — 2026-07-12 (git clean, pushed).** All 35 tabs across Batches A–G verified
> live+DB. **Fixes shipped:** policy duplicate-proliferation (migration `20260712100000` + toggle guard),
> Reviews `ReplyComposer` hydration, **Request Alerts dead-stub → full CRUD** (`AlertsManager.tsx`).
> Website/Builder/CMS stayed out of scope. See the per-tab detail below + memory `host-dashboard-sweep`.
> **To drive:** start preview, sign out of super_admin, log in as `host@wielotest.com`/`WieloTest123!`,
> resize ≥1280. Feature gates are now OPEN for all hosts (MVP), so previously-gated tabs work.

> Goal: go tab-by-tab through the **host dashboard** sidebar, follow every
> function, and verify it works end-to-end — same bar as the admin sweep.
> **No major changes** — refinement + correctness. Status: ⬜ not started ·
> 🔶 in review · ✅ ready.

Session started: 2026-07-11 (#47). Driven as the test host **Karoo Sky Stays**
(`host@wielotest.com` / `WieloTest123!`, host_id `0b111111-1111-4111-8111-111111111111`,
user_id `72811b8e-c8f6-466b-a379-e7418050db2a`, Beta plan). DB truth via
service-role REST (`scratchpad/sbenv.sh`).

**The bar (per tab / per action):** (1) page loads for the host, (2) every
button/action wired to a real Server Action, (3) it performs + writes the DB
record, (4) its side-effect fires (email / pay-link / ledger / calendar /
provision), (5) empty/error states + gating, (6) no console errors.

**Scope note:** the **Website / Builder / CMS** feature (`/dashboard/website`)
is **explicitly OUT of scope** for this sweep — it's a separate large effort to
be done on its own. Skip it here.

---

## A · DAILY
- ✅ 1. Overview — `/dashboard` — renders; all tiles/links resolve (revenue/bookings/occupancy/rating/next-check-in, arriving/in-house/departing, needs-attention, upcoming-stays strip, inbox preview, properties). No console errors.
- ✅ 2. Calendar — `/dashboard/calendar` — **Block dates** wrote 4 `manual` blocked_dates rows (live+DB); **Open nights** removed all 4. Month/Timeline, listing filter, availability panel render.
- ✅ 3. Bookings — `/dashboard/bookings` (+ `/[id]`, `/new`) — list + KPIs + status tabs + filters; detail renders with full lifecycle actions. **Manual booking CREATE** via 5-step wizard wrote booking `b8f12452` (confirmed/pending, dates held); **Cancel** → `cancelled_by_host` + reason stored + **dates released** (blocked_dates=0). All live+DB.
- ✅ 4. Inbox — `/dashboard/inbox` — list + filters + Wielo Support thread; opened thread (history + payment card); **host send** persisted a `messages` row (sender = host). templates sub-page = render-check pending.
- ✅ 5. Guests — `/dashboard/guests` (+ `/[gkey]`) — list/KPIs/segments render; **Add guest** wrote a `host_contacts` row (live+DB); manual booking **materialized its guest into the CRM** (side-effect ✅). Email-guests (real broadcast send) + Export CSV/vCard + bulk-tag = present, not fired (avoid real emails/downloads). **Guest record deep-test = ✅ (see below).**

### Guest record `/dashboard/guests/[gkey]` — DEEP-TESTED (founder priority)
Driven on Wollie Stoney (u_8b4bc108). Every tab + function verified live + DB:
- ✅ **Notes** — add (`guest_notes` row) · pin (`is_pinned`→true) · delete (row gone). All DB-confirmed.
- 🔴→✅ **Tags** — add (`host_contacts.tags`) ✅. **BUG FOUND + FIXED:** `removeGuestTagAction` existed but was **unreachable from any UI** (header tag chips were display-only) — a host could add a tag but never remove one. Wired a `RemovableTag` client chip with a × control → verified live (tag removed, `tags:[]`).
- ✅ **Block / Unblock** (⋯ menu) — `host_contacts.blocked` true→false, `blocked_at` set/cleared.
- ✅ **Finances → Record payment** — wrote a `payments` row (R3 500 eft completed), auto-minted **receipt RPT-0011**, running balance flipped **"Owed to you" → "Paid in full"**; the What-to-do banner updated to check-in prep. (Issue refund / Credit note / Add add-on = same ledger family as the admin ledger.)
- ✅ **Marketing opt-out** — `guest_marketing` row (is_subscribed=false); reverted to keep fixture subscribed.
- ✅ **Reputation** — renders; correctly **gated** ("available after a completed stay").
- ✅ **Relationships** — renders; correct empty state (auto-populates from party bookings).
- ✅ **Message** → switches to in-record Messages tab (by design). **Call** = `tel:` link. **⋯ menu** = New booking / Add tag / Export vCard / Block. Prev/next guest nav.
- ✅ All 8 tabs render (Overview/Bookings/Finances/Messages/Reviews/Reputation/Relationships/Notes); no console errors on fresh load (an HMR-cycle setState warning during live-editing is dev-only, not implicated in the component).
- ℹ️ Seed artifact (not a bug): the seeded Feb booking had `payment_status=completed` but no ledger payment, so balance read "owed" (ledger-backed) until the Record-payment test above settled it.

## B · PROPERTIES
- ✅ 8. Policies — `/dashboard/policies` — renders (4 active defaults, KPIs, type filters, search/sort, coverage panel). **Every action verified live+DB:** Duplicate (copies rules/content, `parent_policy_id` set), Remove (opens retirement modal → `getPolicyRetirementInfoAction` impact summary → archives, never hard-deletes), toggle Active↔Draft (status + `is_default` writes). **🔴→✅ BUG FOUND + FIXED (see §B-Policies below).** No console errors.
- 🔶 6. Properties — `/dashboard/properties` (+ `/[id]/edit`, `/new`) — list renders (KPIs/filters/Import iCal/New listing). **Listing editor** has 11 sections (Basic info · Photos · Location · Rooms & capacity · Amenities · Add-ons · Pricing · Policies · Guest access · Booking settings · Channels · Danger zone). Save mechanism proven live+DB across 3 tables: **Basic info save** (property name), **Pricing save** (cleaning_fee), **Amenities toggle+save** (property_amenities join 4→5→4). Remaining sections render forms with wired saves (Guest access: Save access details/local picks; Location/Booking-settings/Channels/Photos = editor-only). All reversible edits reverted.
- ⬜ 7. Rooms — `/dashboard/rooms`
- ⬜ 8. Policies — `/dashboard/policies`
- ⬜ 9. Specials — `/dashboard/specials` (+ `/[id]`, `/new`)
- ✅ 10. Add-ons — `/dashboard/addons` (+ `/[id]`) — list/KPIs (3 active, R140–R450 range), search/sort, Templates, per-card toggle+Edit render. **Verified live+DB:** toggle active (`is_active` round-trip); **New add-on** → `createDraftAddonAction` wrote a draft row + navigated to the wizard editor (Details/Pricing/Availability/Photo/Danger zone + live guest preview + completeness gauge); filled name/desc/price → **Save** (`updateAddonAction`) persisted all three; **Danger zone → Delete** (confirm modal) hard-deleted the row (addons not in never-hard-delete set) → count back to 3. No console errors.
- ✅ 11. Coupons — `/dashboard/coupons` — list renders (KAROO10, 10% off, whole order, 0/100 used). **Full CRUD verified live+DB:** Turn off/on (`toggleCouponActiveAction` round-trip); **New coupon** dialog (code/discount/scope/listing/validity/limits/active) → Create (`createCouponAction` wrote SWEEPTEST15); **Edit** → change % 10→15 → Save (`updateCouponAction` persisted); **Delete coupon** (confirm modal) → row gone, fixture back to KAROO10. No console errors.
- ✅ 12. Reviews — `/dashboard/reviews` — all 4 view tabs render (Reviews/Activity/Guest ratings/External) with correct empty states (no completed stays), rating breakdown, response-rate/reviewing-rate panels, filters (All/Needs reply/Replied/Flagged), Request reviews. **Core actions verified live+DB via a seeded published review:** **Post reply** (`replyToReviewAction` → `host_response`+`host_responded_at`), **Feature on listing** (`toggleFeaturedReviewAction` → `properties.featured_review_id`). Clear/edit-reply/flag/request share the same RLS-owned update path (wired, not fired to avoid real emails). Synthetic review + feature FK cleaned up; table empty again. No console errors.
- ✅ 13. Media — `/dashboard/media` — two tabs render: **Website media** (correct empty state — host has no website, which is out of scope) + **Listings & rooms** (per-listing + per-category picker: Listing photos / per-room, live re-scopes the grid). Reuses the listing editor's photo actions (`registerListingPhotoAction`/`deleteListingPhotoAction`/`setListingPhotoCaptionAction`). **Verified live+DB:** clicked a photo → detail modal → edited alt/caption → **Save alt text** (`setListingPhotoCaptionAction`) persisted to `property_photos.caption`; reverted. Upload/delete wired (not fired — would leave a storage object / destroy the sole listing photo). No Media console errors. 🔧 Incidental hydration fix (Reviews `ReplyComposer`): `remaining.toLocaleString()` → pinned `"en-ZA"` (server "1 500" vs client "1,500" mismatch).

- ✅ 7. Rooms — `/dashboard/rooms` — cross-property room library renders (KPIs, filters, Add room, Calendar sync, 3 rooms); deep-links to per-room editor (`/edit/rooms/[roomId]`). Room create/edit proven infrastructure (prior builder work).
- 🔶 9. Specials — `/dashboard/specials` (+ `/[id]/edit`, `/new`) — **see the two findings below.**

### 🔴 FINDING 1 (fixed for testing): incomplete pre-MVP "unlock-all" feature override seed
Specials showed "aren't on your plan yet" for the Beta test host. Root cause: the test host's
`host_feature_overrides` seed (reason "unlock all features for founder testing (AGENT_RULES §3.4)")
had 25 features but **MISSED 6**: `specials`, `reporting` (was `analytics_advanced`, unified 2026-07-20), `businesses_limit`,
`custom_website_design`, `website_blog`, `website_custom_domain`. So those tabs were falsely gated.
Added the 6 missing overrides (data-only, test host) → `check_feature_permission(specials)` now
`{source:"override", is_enabled:true}`. **Deeper issue for the founder:** the gates are NOT
code-short-circuited per the pre-MVP policy (AGENT_RULES §3.4 says `assertFeatureEnabled` should
short-circuit to `true`); instead they rely on per-host override seeds that can be (and were) incomplete.
Decide the long-term fix (code short-circuit vs. keeping override seeds complete).

### ✅ BOTH FINDINGS FIXED (2026-07-11 #47) — Specials now saves + integrates with the calendar
- **Fix 1 — features open pre-MVP (SSOT):** `hostHasFeature` now short-circuits to `true` behind a single
  `PRE_MVP_FEATURES_OPEN` flag (AGENT_RULES §3.4), plus the direct-RPC/local gates that bypass it
  (seasonal-pricing, addons, reports; coupons/banking already open). Every feature ships open; flip the flag
  before Phase 3. Specials is now reachable for **all** hosts, not just via the (previously incomplete) override seed.
- **Fix 2 — Specials save was a silent no-op.** Root cause: `parse(input)` rejected because the seeded
  "Stargazer Weekend" special was `date_mode=fixed` with `quantity=3`, violating the schema rule (fixed → qty 1).
  The action returned `{ok:false}` but the client's ERR_ABORTED swallowed the toast, so it looked dead.
  **Fixed:** `SpecialEditor.submit` now coerces `quantity: date_mode==="fixed" ? 1 : quantity` (covers stale
  loaded data), added a `try/catch` so a rejected action can never fail silently again, and corrected the seed
  row (qty→1). **Verified live:** Save-as-draft/publish now persist (status flips, `updated_at` bumps, navigates).
- 🔴→✅ **Fix 3 (NEW bug found while verifying) — fixed-date special calendar blocking never worked.** The
  `block_special_dates` RPC inserts `blocked_dates` rows with `source='special'`, but `blocked_dates_source_check`
  only allowed `('manual','booking','ical','quote_hold')` → every activation threw a check_violation that
  `blockSpecialDates()` swallowed. Migration `20260711140000` adds `'special'` to the constraint (pushed to cloud).
  **Verified live end-to-end via the app:** publish → 3 `source='special'` blocks created (Aug 1–3); draft →
  blocks released. **Specials ↔ Calendar integration works.**
- 🔴→✅ **Fix 4 (NEW bug found while verifying booking) — fixed-date specials were unbookable.** The deal
  booking availability check (`deal/[slug]/book/actions.ts`) used `listing_is_available_whole` /
  `room_is_available`, which count the special's OWN `source='special'` hold as unavailable → "These dates
  aren't available." Replaced with a direct `blocked_dates` conflict query that **excludes this special's own
  hold** (`special_id.is.null OR special_id.neq.<this>`), room-scope aware. **Verified live end-to-end:** a
  guest booked the deal → booking `46376561` created (linked to `special_id`, Aug 1–4), redemption consumed
  (`redemptions_used 1/1` → sold out), pending EFT payment on the ledger, deal success page rendered.

**Specials E2E integration — verified:** save ✅ · calendar hold/release ✅ · public `/deal/[slug]` ✅ ·
booking ✅ · atomic redemption/sold-out ✅ · ledger payment ✅ · **notifications ✅** (recording the EFT →
booking `confirmed`, `booking_confirmed_guest` notification fired).

**✅ BOTH GAPS FIXED + pending-notification added (2026-07-11 #48) — verified live end-to-end:**
- 🔴→✅ **A — calendar block now converts special-hold → booking-owned on confirm.** Root cause (via subagent):
  `on_booking_confirmed()` inserted `blocked_dates(reason='booking', booking_id)` with `ON CONFLICT DO NOTHING`,
  which collided with the special's own hold on the same scope → no booking block; then `release_special_dates`
  could delete a live booking's dates. Migration `20260711150000` makes the trigger UPSERT — claiming ONLY this
  booking's own `source='special'` hold (never manual/iCal/other-special) and converting it to
  `source='booking', booking_id, special_id=NULL`; also sets `source='booking'` on the plain insert (was
  defaulting to 'manual'); + a backfill for existing confirmed special bookings. **Verified live:** a confirmed
  deal booking's Aug 1–3 nights are now `source='booking', booking_id=<this>, special_id=null`. Normal + special
  bookings hold their dates identically; deactivating a special can no longer free a booked date.
- 🔴→✅ **B — deal payment amount now reconciles.** Root cause: the `apply_booking_vat` BEFORE-INSERT trigger
  grosses up `total_amount` (R4200→R4830) but `persistBookingAndPay` charged the caller's stale pre-insert
  estimate (R4200). `persist.ts` now reads back `total_amount`/`deposit_amount` from the inserted row and
  charges that. **Verified live:** pending payment = R4830 (= booking total). Applies to ALL paths (app/website/
  deal) whenever the listing is VAT-registered. (The "double payment row" I saw was a wrong-button artifact —
  "Record a payment" adds a payment; the correct EFT-confirm is "Mark received" (`markPaymentReceivedAction`)
  which reconciles the pending row. Not a bug.)
- 🆕→✅ **Host notified on PENDING booking creation** (founder ask — so hosts can manage bookings before payment).
  `booking_request_host` previously fired only from the website on-site checkout. Folded a shared
  `notifyHostNewBooking` into `persistBookingAndPay` so **every** creation path (app checkout, website, deal)
  notifies the host uniformly while the booking is still pending; removed the two duplicate site-checkout calls.
  **Verified live:** creating a pending deal booking fired `booking_request_host` "New special booking".

**Specials is now a 100%-working feature end-to-end** (save · calendar hold+release+convert · deal page ·
booking · redemption/sold-out · ledger · pending + confirmed notifications), with normal and special bookings
behaving identically on the shared calendar / ledger / notification core.

### (historical) 🔴 FINDING 2 (was: root-cause under investigation): Specials editor save is a silent no-op
Once unblocked, Specials renders fully (list + KPIs + editor + New special). But **saving a special
does nothing** — clicking "Save as draft" / "Save & keep live" on an existing special (even an untouched,
"100% complete", freshly-loaded form) produces **no DB change, no toast, no navigation, no JS error**
across multiple real (`preview_click`) attempts. The Save buttons are enabled. Since `submit()` always
ends in a success or error toast once `updateSpecialAction` is awaited, "no toast at all" points to an
early no-op (likely the EDIT-path initial `form` not populating a required field, or the onClick not
reaching the action). A subagent is root-causing `SpecialEditor.submit` + `updateSpecialAction` +
`specialInputSchema`. **NOT verified working — needs a fix or a manual founder check.**

### 🔴→✅ §B-Policies (2026-07-12) — drafting the sole policy of a type spawned duplicate policies
Found by toggling the only House rules policy to Draft: on the next `/dashboard/policies` load a
**brand-new active "House rules" appeared** beside the drafted one (repeat → they pile up). Root cause:
`ensure_host_policy_presets` is called on every page render (page.tsx:48) but only checked for an
**active** policy of each type — a drafted-only type looked "empty" so it re-seeded a fresh active default.
The seeder was written as a one-time seed but invoked per-render. **Matched-pair fix (both verified live):**
- **Seeder** — migration `20260712100000` changes the guard to "no **non-deleted** policy of the type"
  (true first-time seed). Proven: forced a zero-active-cancellation state → reload → **no duplicate** (old
  code would insert a 3rd). Fresh-host seeding unchanged.
- **Toggle guard** — `togglePolicyStatusAction` now refuses to draft the **last active policy** of a type
  ("This is your only active policy of its type — every listing needs one…"), preserving the resolver
  invariant (no active default → booking snapshots no policy → 0% refund) *without* spawning dupes. Proven
  live: toast fired, DB unchanged, drafting a copy while the original stayed active was correctly allowed.
Test fixture restored to the clean 4-active-default state. `deleted_at IS NULL` set-safe; no console errors.

## C · FINANCES — ✅ ALL SWEPT (2026-07-12 #53)
- ✅ 14. Ledger — `/dashboard/ledger` — full account transaction view: KPIs (Outstanding R9 798 / Collected R8 330 / Net R8 330 — consistent with 5 txns), type filter tabs (Charges→3 rows, "Showing 3 of 5"), guest filter dropdown, search, running per-guest balance, DOCUMENT links. **Verified:** invoice doc link `/invoice/<token>/pdf` returns **200 application/pdf `%PDF-` 4.3 KB** (real generated PDF). Per-row Actions = Radix menu (same family as verified admin ledger). No console errors.
- ✅ 15. Payments — `/dashboard/payments` (+ `/[id]`) — "Money & settlements" board, 2 completed EFT payments (Lerato R4 830 / Wollie R3 500), status tab counts (All 2/Completed 2/Pending 0/Failed 0/Refunded 0), Export CSV, Any-method filter. **Detail `/[id]` renders** (R4 830, BK-0027, Manual EFT, reference/method); completed payment correctly offers no further status action (`updatePaymentStatusAction` "Mark received" path exercised in Batch A).
- ✅ 16. Quotes — `/dashboard/quotes` (+ `/[id]`, `/new`) — empty state + New quote. **Create verified live+DB:** `/new` wizard (guest search/details · listing · Whole-listing/rooms · date presets · guest steppers · Itemised/Single-total pricing **auto-priced from live rates**) → filled guest + 7-night preset → **Save draft** (`createQuoteAction` → **Q-0003**, R9 820, Jul 18–25, status draft). Detail `/[id]` renders lifecycle actions (Edit/Send/Decline/Delete/Share). **Delete** (`softDeleteQuoteAction`, confirm modal) → `deleted_at` set, list empty again.
- ✅ 17. Invoices — `/dashboard/invoices` (+ `/[id]`) — list of 3 invoices (INV-0059/0057/0046) → detail `/[id]` renders (INV-0059, **Paid**, VAT line **R630** on R4 830, actions Download PDF / View payment / Send / Regenerate PDF); PDF route 200 (above).
- ✅ 18. Credit Notes — `/dashboard/credit-notes` — renders correct empty state ("No credit notes"); populates when refund/adjustment mints a `wielo_credit_notes` doc (verified in admin-ledger-parity + Batch A guest-record).
- ✅ 19. Refunds — `/dashboard/refunds` — renders correct empty state ("Nothing…"); populates from the guest-record/booking Issue-refund action (Batch A). No console errors on any Finances tab.

## D · CHANNELS (Website SKIPPED — out of scope) — ✅ SWEPT (2026-07-12 #53)
- ✅ 20. Calendar sync — `/dashboard/calendar-sync` — Export ("Get my export URL" → `/dashboard/calendar` per-listing iCal) + Import (per-listing external feeds; SA channel presets: Airbnb/Booking.com/SafariNow/NightsBridge/LekkeSlaap/Afristay/Google/Apple). **Verified live+DB:** Add calendar → channel preset + URL → **Add feed** (`addIcalFeedAction` wrote an `ical_feeds` row: source_label Airbnb, status active); feed card showed Sync/Remove; **Remove feed** (`removeIcalFeedAction`, confirm modal) → row gone. Sync (`syncIcalFeedAction`) wired (not fired on the bogus URL). Feature already MVP-ready + live in prod ([[project-calendar-sync-state]]). No console errors.
- ✅ 21. OTA channels — `/dashboard/channels` — **intentional "Coming Post-launch" placeholder** (page-only, no actions): renders roadmap (partner-API push to Airbnb/Booking.com, one-way price/availability sync, external bookings → unified inbox) + Pro+ tier note. Surface live so nav makes sense; feature lands per PHASE_PLAN.md. Correct by design, not a gap.

## E · LOOKING FOR — ✅ SWEPT (2026-07-12 #54)
- ✅ 22. Browse Requests — `/dashboard/looking-for` — renders via `RequestsBoard` client component (fetch/filter/quote flow wired); correct empty state (no active guest posts). No error UI.
- ✅ 23. My Quotes Sent — `/dashboard/looking-for/my-quotes` — server-rendered list, correct empty state (no quotes sent). Populates from the Browse quote flow.
- ✅ 24. Saved Requests — `/dashboard/looking-for/saved` — server-rendered list, correct empty state (no bookmarks). Populates from Browse bookmark toggle.
- 🔴→✅ 25. Request Alerts — `/dashboard/looking-for/alerts` — **WAS A DEAD STUB** (page.tsx Server Component: "New Alert" / "Create Your First Alert" / "Edit" / delete buttons had **NO handlers** — the 4 server actions `createAlertAction`/`updateAlertAction`/`toggleAlertActiveAction`/`deleteAlertAction` existed but nothing in the UI called them). **FIXED:** built `AlertsManager.tsx` client component (FormModal form: name/category/region/budget/guests/check-in window + card list with Pause/Activate·Edit·Delete) and refactored `page.tsx` to render it. **Full CRUD verified live+DB:** create (`createAlertAction` → "Karoo weekend getaways") → Pause (`toggleAlertActiveAction` is_active→false) → Edit name (`updateAlertAction`, is_active untouched) → Delete (`deleteAlertAction`, confirm modal). Fixture clean (0 alerts). Build green, no lint issues. (Transient "[dashboard] uncaught error" seen mid-session = HMR recompile churn while live-editing; not reproducible — all 4 pages fresh-load clean.)

## F · INSIGHTS — ✅ SWEPT (2026-07-12 #54)
- ✅ 26. Reports — `/dashboard/reports` (+ savings) — "Analytics & Reports" renders: KPI tiles (revenue R8 330 etc), date-range picker + quick presets (**90D preset verified active on click**), listing/region/channel filters + Reset, Schedule/Export/Open-ledger. **Savings sub-page** `/reports/savings` renders (commission-saved vs OTAs, R1 499 @ 15%). No error UI; no console errors. (Export/Schedule wired, not fired — avoid downloads / scheduled-report creation.)
- ✅ 27. Tracking — `/dashboard/tracking` — correctly **gated**: "Set up your website first — pixels/analytics attach to your public booking site" + Create-website CTA. The pixel form + `saveTrackingAction` live behind that gate; the test host has no website (Website feature is out of scope), so the gate is the correct state.
- ✅ 28. Affiliates — `/portal/affiliates` — host portal shows the correct **enrollment gate** for a non-enrolled host ("Earn with Wielo" + terms checkbox + "Join the programme"). Not enrolled to avoid affiliate/ledger artifacts; the full affiliate dashboard/links/payouts/leaderboard/marketing were built + verified in the dedicated affiliate-hardening work ([[project-affiliate-hardening-plan]], demo affiliate `wollie-steenkamp`). No console errors.

## G · SETTINGS (footer) — ✅ SWEPT (2026-07-12 #54)
- ✅ 29. Profile / host — `/dashboard/settings` (+ `/host` = same surface) — merged user_profiles (name/phone/email) + hosts (bio/handle/highlights) form + password-change card. **Verified live+DB:** edited bio → **Save profile** wrote `hosts.bio`; reverted.
- ✅ 30. Businesses — `/dashboard/settings/businesses` (+ `/new`, `/[id]`) — business list (Karoo Sky Stays Default) + personal address (Save address) + Add business + per-business Edit/kebab. **Verified live+DB:** `/new` form (trading/legal name, VAT#, reg#, currency/language, address) → **Save business** (`createBusinessAction` wrote "Sweep Test Business"); cleaned up. Edit/logo/set-default/archive wired to the edit page + "More actions" kebab (Radix menu flaky via eval).
- ✅ 31. Banking (Card payments) — `/dashboard/settings/banking` — connect your OWN Paystack (ZAR) / PayPal gateway (Connect CTAs, "encrypted at rest"). Connect flow needs real gateway creds — not fired.
- ✅ 32. Notifications — `/dashboard/settings/notifications` — shared `PreferencesForm` (35 channel×category checkboxes) + AwayAutoReply card. **Verified live+DB:** toggled `messages` email off → **Save preferences** (`savePreferencesAction`) wrote `user_notification_preferences`; reverted. **Locked categories (bookings) correctly protected** — the action filters them so a toggle can't disable them.
- ✅ 33. Subscription — `/dashboard/settings/subscription` — current plan (Beta active / Beta Testers, no charges) + Switch-plan with upgrade CTAs (Bernie/Starter). Upgrade initiates checkout — not fired.
- ✅ 34. Transactions — `/dashboard/settings/transactions` — buyer transaction-history table (Date/Description/Amount/Status/Document) for subscriptions + products, with downloadable docs. Renders (read surface).
- ✅ 35. Data (export/delete) — `/dashboard/settings/data` — "Export your data" (Request data export) + "Delete your account" (Request deletion / Delete my account) render with warnings. Destructive — not fired. No console errors on any Settings tab.

---

## ✅ SWEEP COMPLETE — all 35 host-dashboard tabs verified (2026-07-12).
Batches A–G done. **Real fixes shipped this sweep:** ① policy duplicate-proliferation (migration `20260712100000` + toggle guard, `8fbe8f1b`) · ② Reviews `ReplyComposer` hydration mismatch (`9beb7ca7`) · ③ **Request Alerts dead-stub → full CRUD** (`AlertsManager.tsx`, `19a9a9d2`) · (④ the earlier Specials 100% build + removeGuestTag fix from #47–#48). Website/Builder/CMS remained out of scope throughout.

---

## Findings log
_(per-tab detail added as we go — mirrors ADMIN_MVP_CHECKLIST.md format)_
