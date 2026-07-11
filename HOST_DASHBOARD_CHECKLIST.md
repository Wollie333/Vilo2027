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
- 🔶 5. Guests — `/dashboard/guests` (+ `/[gkey]`) — list/KPIs/segments/Add-guest render; manual booking **materialized its guest into the CRM** (side-effect ✅). **Guest record deep-test = ✅ (see below).**

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
- ⬜ 6. Properties — `/dashboard/properties` (+ `/[id]` editor, `/new`)
- ⬜ 7. Rooms — `/dashboard/rooms`
- ⬜ 8. Policies — `/dashboard/policies`
- ⬜ 9. Specials — `/dashboard/specials` (+ `/[id]`, `/new`)
- ⬜ 10. Add-ons — `/dashboard/addons` (+ `/[id]`)
- ⬜ 11. Coupons — `/dashboard/coupons`
- ⬜ 12. Reviews — `/dashboard/reviews`
- ⬜ 13. Media — `/dashboard/media`

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
