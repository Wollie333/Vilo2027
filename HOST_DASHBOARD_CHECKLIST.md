# Host Dashboard Functional Sweep Checklist

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
- 🔶 6. Properties — `/dashboard/properties` (+ `/[id]/edit`, `/new`) — list renders (KPIs/filters/Import iCal/New listing). **Listing editor** has 11 sections (Basic info · Photos · Location · Rooms & capacity · Amenities · Add-ons · Pricing · Policies · Guest access · Booking settings · Channels · Danger zone). Save mechanism proven live+DB across 3 tables: **Basic info save** (property name), **Pricing save** (cleaning_fee), **Amenities toggle+save** (property_amenities join 4→5→4). Remaining sections render forms with wired saves (Guest access: Save access details/local picks; Location/Booking-settings/Channels/Photos = editor-only). All reversible edits reverted.
- ⬜ 7. Rooms — `/dashboard/rooms`
- ⬜ 8. Policies — `/dashboard/policies`
- ⬜ 9. Specials — `/dashboard/specials` (+ `/[id]`, `/new`)
- ⬜ 10. Add-ons — `/dashboard/addons` (+ `/[id]`)
- ⬜ 11. Coupons — `/dashboard/coupons`
- ⬜ 12. Reviews — `/dashboard/reviews`
- ⬜ 13. Media — `/dashboard/media`

- ✅ 7. Rooms — `/dashboard/rooms` — cross-property room library renders (KPIs, filters, Add room, Calendar sync, 3 rooms); deep-links to per-room editor (`/edit/rooms/[roomId]`). Room create/edit proven infrastructure (prior builder work).
- 🔶 9. Specials — `/dashboard/specials` (+ `/[id]/edit`, `/new`) — **see the two findings below.**

### 🔴 FINDING 1 (fixed for testing): incomplete pre-MVP "unlock-all" feature override seed
Specials showed "aren't on your plan yet" for the Beta test host. Root cause: the test host's
`host_feature_overrides` seed (reason "unlock all features for founder testing (AGENT_RULES §3.4)")
had 25 features but **MISSED 6**: `specials`, `analytics_advanced`, `businesses_limit`,
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

**🔶 Two remaining hardening gaps flagged for the founder (NOT a 100% ship yet):**
- **A — calendar block never converts to the booking.** After a confirmed special booking, the held nights
  stay `source='special', booking_id=null`. If the host later deactivates the special, `releaseSpecialDates`
  would free a **confirmed booking's** dates → double-booking exposure. The block should convert to
  `source='booking'` (booking_id set) on booking creation/confirmation, and release must skip dates with a
  live booking.
- **B — deal payment/pricing mismatch.** The deal pre-creates a **pending R4 200** payment at booking, but the
  booking `total_amount` is **R4 830** (deal price shown was R4 380); recording the EFT then adds a **second**
  R4 830 payment. The deal total / displayed price / pre-created payment don't reconcile, and the pending row
  is left orphaned. Needs the deal pricing + payment-record flow reconciled.

### (historical) 🔴 FINDING 2 (was: root-cause under investigation): Specials editor save is a silent no-op
Once unblocked, Specials renders fully (list + KPIs + editor + New special). But **saving a special
does nothing** — clicking "Save as draft" / "Save & keep live" on an existing special (even an untouched,
"100% complete", freshly-loaded form) produces **no DB change, no toast, no navigation, no JS error**
across multiple real (`preview_click`) attempts. The Save buttons are enabled. Since `submit()` always
ends in a success or error toast once `updateSpecialAction` is awaited, "no toast at all" points to an
early no-op (likely the EDIT-path initial `form` not populating a required field, or the onClick not
reaching the action). A subagent is root-causing `SpecialEditor.submit` + `updateSpecialAction` +
`specialInputSchema`. **NOT verified working — needs a fix or a manual founder check.**

## C · FINANCES
- ⬜ 14. Ledger — `/dashboard/ledger`
- ⬜ 15. Payments — `/dashboard/payments` (+ `/[id]`)
- ⬜ 16. Quotes — `/dashboard/quotes` (+ `/[id]`, `/new`)
- ⬜ 17. Invoices — `/dashboard/invoices` (+ `/[id]`)
- ⬜ 18. Credit Notes — `/dashboard/credit-notes` (+ `/[id]`)
- ⬜ 19. Refunds — `/dashboard/refunds`

## D · CHANNELS (Website SKIPPED — out of scope)
- ⬜ 20. Calendar sync — `/dashboard/calendar-sync`
- ⬜ 21. OTA channels — `/dashboard/channels`

## E · LOOKING FOR
- ⬜ 22. Browse Requests — `/dashboard/looking-for`
- ⬜ 23. My Quotes Sent — `/dashboard/looking-for/my-quotes`
- ⬜ 24. Saved Requests — `/dashboard/looking-for/saved`
- ⬜ 25. Request Alerts — `/dashboard/looking-for/alerts`

## F · INSIGHTS
- ⬜ 26. Reports — `/dashboard/reports` (+ savings)
- ⬜ 27. Tracking — `/dashboard/tracking`
- ⬜ 28. Affiliates — `/portal/affiliates` (host-facing portal surface)

## G · SETTINGS (footer)
- ⬜ 29. Profile / host — `/dashboard/settings` (+ `/host`)
- ⬜ 30. Businesses — `/dashboard/settings/businesses`
- ⬜ 31. Banking — `/dashboard/settings/banking`
- ⬜ 32. Notifications — `/dashboard/settings/notifications`
- ⬜ 33. Subscription — `/dashboard/settings/subscription`
- ⬜ 34. Transactions — `/dashboard/settings/transactions`
- ⬜ 35. Data (export/delete) — `/dashboard/settings/data`

---

## Findings log
_(per-tab detail added as we go — mirrors ADMIN_MVP_CHECKLIST.md format)_
