# Vilo — Current Task

> ⚠️ **Reset this file at the start of every Claude Code session.** This is your session contract — the agent will not work outside this scope without asking first.

**Session note (2026-06-03 — branch `feat/trip-quote-detail-design`, NOT committed):**
Redesigned two pages to match the founder's reference HTML (`~/Downloads/Trip
Details.html`, `~/Downloads/Quote Detail.html`), wiring every rich section to
real data + new host-editing surfaces (approved approach: add real DB backing,
not placeholder content).
- **Guest Trip Details** moved into the portal shell → new
  `app/portal/trips/[id]/page.tsx` (old `/my-trips/[id]` is now a redirect; its
  Cancel/Refund components + actions moved alongside the new page). Trips list
  `detailHref` + notification/confirmation deep links repointed to
  `/portal/trips/[id]`.
- **Host Quote Detail** rewritten at `app/dashboard/quotes/[id]/page.tsx`
  (status stepper, activity timeline, dark conversion card, internal-notes thread
  `QuoteInternalNotes`); reuses existing `QuoteActions`/`QuoteShare`.
- **Host editing:** new "Guest access" tab on the listing editor
  (`tabs/GuestAccessTab.tsx` + `saveListingAccessAction`/`replaceLocalPicksAction`),
  welcome-note card on booking detail (`updateBookingHostMessageAction`),
  `addQuoteNoteAction` on quotes.
- **Quote open-tracking** wired into the public `app/q/[id]/[token]/page.tsx`
  (bumps `view_count`, logs `quote_view_events`).
- Migrations `…000001`→`…000005` (listing_access [host-only] + listing_local_picks
  [public], bookings.host_message, quote_notes, quote_view_events, help articles)
  — **already pushed via `supabase db push --linked` and types regenerated**.
- `pnpm build` + `pnpm lint` green. **Not committed** (awaiting founder go-ahead).
- Follow-ups: local-pick image upload (text-only for now); founder smoke-test of
  the host-access tab + a guest viewing `/portal/trips/[id]`.

**Session note (2026-06-03 — CONSOLIDATION → pushed to `main`):**
Two parallel workstreams were merged into one linear branch
(`feat/host-payment-gateways`) and pushed to `main`: (1) **host payment
gateways** (BYO Paystack/PayPal — see note below) and (2) **room/quote
pricing** stacked on top (per-room/listing children/infants/pets allow toggles,
quote-level discount, quote deposit terms + booking balance tracking, capacity
guard, listing suitability chips, payment-record page redesign). No file
overlap except `packages/types/database.types.ts`, which carries both sets of
hand-edits. Migrations are sequential `…000016`→`…000021`. Combined `pnpm build`
+ `pnpm lint` green.
Then added **AGENT_RULES §4.5/§4.6**: a listing can't go live without a valid
default EFT account (app gate in `togglePublishAction` + DB trigger
`trg_listing_requires_bank`), and checkout always falls back to EFT if
Paystack/PayPal fail (`book/actions.ts`). Single source of truth
`lib/payments/eft.ts › hostHasValidEft`. Migrations `…000022` (trigger) +
`…000023` (help). Logic-only, no type changes. build + lint green.
**Combined TODO before the DB is live:** (1) `supabase db push --linked`
(applies `…000016`→`…000023` in order); (2) `supabase gen types typescript
--linked > packages/types/database.types.ts`; (3) set `PAYMENT_CIPHER_KEY` in
`.env.local` + Doppler dev (value handed to founder in chat — NOT committed);
(4) founder pastes Paystack test keys + a PayPal sandbox app and smoke-tests
Settings → Banking & business → Payment gateways (connect → validate → request a
payment). See CHANGELOG 2026-06-03 + 2026-06-02 entries.

**Session note (2026-06-02 — branch `feat/host-payment-gateways`, NOT committed):**
Built host-side **bring-your-own payment gateways** so hosts connect their OWN
Paystack + PayPal credentials and accept booking payments directly (Vilo takes
0%; platform monetises via subscription only — a separate, later flow using
Vilo's own keys). Scope was deliberately **host side only** — guest checkout /
booking-create wiring (the currency↔gateway toggle) is **deferred to the
guest-portal task** per founder direction.
- New `host_payment_gateways` table (secrets encrypted at rest via new
  `PAYMENT_CIPHER_KEY`, never sent to client), `hosts.default_currency`,
  `fx_rates` cache. Migrations `20260602000016` + `20260602000017` (help).
- Settings UI on `/dashboard/settings/banking` → "Payment gateways": connect /
  edit / enable / remove per gateway, **live validation on save**, Paystack
  **statement descriptor** field, default-currency picker, and a Paystack
  **"Request a payment"** link generator (accept money today, pre-portal).
- Libs: `lib/crypto/payments.ts`, `lib/paypal.ts`, `lib/fx.ts` (ZAR→USD daily
  cache, open.er-api.com); `lib/paystack.ts` now takes an optional per-host
  secret (+ descriptor), env key retained for subscription billing.
- `pnpm build` + `pnpm lint` green. `database.types.ts` HAND-EDITED (Docker
  down) to add the two tables + `default_currency`.
**TODO before merge:** (1) `supabase db push --linked` + `supabase gen types
typescript --linked > packages/types/database.types.ts` (output should match
the hand-edit); (2) set `PAYMENT_CIPHER_KEY` in `.env.local` + Doppler dev
(value handed to founder in chat — NOT committed); (3) founder pastes Paystack
test keys + a PayPal sandbox app and smoke-tests connect → validate → request a
payment. See CHANGELOG 2026-06-02 top entry.

**Session note (2026-06-02 — branch `feat/unified-pricing-engine`, NOT committed):**
Three things shipped: (1) refund **payout-method** picker (Paystack/PayPal/EFT/
Manual) on the Refunds queue + booking Issue-refund panel → persisted on
`refund_requests.refund_method`; (2) new **Credit Notes** feature (`credit_notes`
table, list at `/dashboard/credit-notes`, detail page, auto-created by trigger on
refund completion + manual create from an invoice); (3) collapsible **Finances**
sidebar group = Quotes → Invoices → Credit Notes. Migrations `20260602000000/1/2`
(**not yet `db push`-ed**); types hand-edited. `pnpm build`+`pnpm lint` green.
**TODO:** push migrations to linked remote + regen types; founder to supply
invoice/quote/credit-note detail + PDF designs (built logic-first, minimal
styling); credit-note PDF + public `/credit-note/[token]` page deferred.
See CHANGELOG 2026-06-02 entry.

**Session note (2026-05-29 — branch `feat/policy-manager`, NOT merged):**
Built the Policy Manager at `/dashboard/policies` — three separately-assignable
kinds (refund terms / check-in-out / house rules), listing-wide default +
per-room overrides, locked presets (duplicate-to-customise), WYSIWYG + summary,
guest "Read full policy" popup on listing + checkout, and the booking
`snapshot_booking_policies` call (guest + manual flows) that was never wired.
Migration `20260529000000_policy_manager_ui_support.sql`. **Docker would not
start**, so `packages/types/database.types.ts` was HAND-EDITED to match the
migration (new `policies.summary`/`check_in_time`/`check_out_time`,
`listing_policies.room_id`, `ensure_host_policy_presets` RPC). `pnpm build` +
`pnpm lint` both green against the hand-edited types. **TODO before merge:** run
`supabase db reset && supabase gen types typescript --local > packages/types/database.types.ts`
to regenerate types properly (output will be identical) and run the manual E2E
in the CHANGELOG verification list. See CHANGELOG 2026-05-29 entry.

**Date:** 2026-05-28 (post listing-taxonomy session)
**Phase:** Pre-MVP launch path. Listing taxonomy (admin-managed
categories + amenities + per-category SEO landing pages at /c/[slug])
shipped on `main` this session. Notification system still on
`feat/notifications` (8 commits, awaiting merge). Remaining work is
operational + the deferred host-side wire-ups below.
**Session note (2026-05-28b):** Rebuilt `/dashboard/bookings/new`
(ManualBookingForm) to the "New Booking Page" design and wired it to real
backends — `listing_rooms`, `listing_addons`⨝`addons`, `blocked_dates`
(two-month range calendar + per-room availability), past-guest search,
`booking_notes` for the internal note. Action now re-prices add-ons
server-side, guards availability via RPCs, and explicitly writes
`blocked_dates` on confirmed bookings (the status-UPDATE trigger doesn't
fire on a direct confirmed INSERT — latent bug fixed). See `CHANGELOG.md`
top entry for the full list + deliberately-omitted (no-backend) bits.
Build + lint green. **Not committed yet.**

**Session Goal (next):** **First**: apply the taxonomy migration when
Docker is up — `supabase start && supabase db reset && supabase gen types
typescript --local > packages/types/database.types.ts`. Then pick:
(a) wire the host wizard / new-listing / edit BasicTab to the new
category picker (deferred this session — see `CHANGELOG.md` 2026-05-28
"Deferred"), (b) pass the amenity catalog into AmenitiesTab, or (c) any
of the launch-ops items below.

---

## What's now in prod (as of 2026-05-25 wave 3)

- Experience listings end-to-end: host editor (Logistics + Schedule
  tabs), guest discovery card, detail page with slot picker, booking
  flow with slot-capacity guard, success page + my-trips both render
  experience bookings correctly.
- Dashboard top-right "New booking" button now actually navigates to
  `/dashboard/bookings/new`.
- Active platform_staff get an "Admin" toggle in the dashboard topbar
  → `/admin`; reverse link already existed at the bottom of the admin
  sidebar.
- AAL2 (MFA) gate on `/admin` dropped pre-MVP (migration
  `20260525000009`); restore before public launch.
- Test super-admin account exists: `Wollie@ManaMarketing.co.za` /
  `Admin123#`. Founder `wollie333@gmail.com` is back to plain host.

See `CHANGELOG.md` 2026-05-25 wave 3 entry for full detail + the five
commits (`2fdc586` → `2eba3c0`).

### Enterprise notification system (2026-05-26 — on `feat/notifications`)

8 commits, ~6,500 LOC. Not merged yet. See `NOTIFICATIONS.md` §9–§10 and
`supabase_database.md` Domain 13 for the full architecture.

Shipped: single `dispatchEvent()` entry point cooperating with the email
resolver pattern, 9-category taxonomy with lucide icons + per-role
defaults, host + guest preferences UI with quiet hours / digest /
dedupe, super-admin broadcasts (info / warning / critical) with
audience targeting and acknowledgement tracking, admin individual sends
to selected users via multi-pick + chip strip with history view at
`/admin/notifications/sent`, digest worker (daily + weekly cadences),
bell with category filter tabs + severity styling.

**Before merging:**
- Run `vault.create_secret` for `push_worker_url`, `digest_worker_url`,
  `broadcast_worker_url` in each env's Supabase SQL Editor (all three
  share the existing `email_worker_secret`).
- `supabase db reset` + `supabase gen types typescript --local >
  packages/types/database.types.ts`.
- Smoke: send one broadcast (warning) to `all`; confirm BroadcastBanner
  renders on dashboard / admin / account pages.

---

## Launch-blockers still open (need founder input)

### Ops 1 — Paystack live keys + webhook
- Paste live `sk_live_…` + `pk_live_…` into Doppler `dev`.
- Generate webhook secret + register endpoint in Paystack dashboard.
- Replace optimistic refund completion in
  `apps/web/lib/actions/refunds.ts` with real `transaction/refund` call.

### Ops 2 — PayPal live integration
- `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` + `PAYPAL_WEBHOOK_ID` in
  Doppler. Flip `NEXT_PUBLIC_PAYPAL_ENV` to `live` when ready.

### Ops 3 — Resend domain verification
- Add Resend DNS records on `vilo.co.za` or `viloplatform.com`.
- Once verified, swap `EMAIL_FROM_ADDRESS` from `onboarding@resend.dev`
  to a vilo-domain sender.
- Then: update email templates (`emails/templates/BookingConfirmedGuest`
  etc.) to accept experience props — currently they assume
  `checkIn/checkOut/nights`.

### Ops 4 — Region migration
- Supabase project is in Frankfurt; SA users want SA region. Coordinate
  a maintenance window, snapshot + restore into a new project, rotate
  keys, point Vercel/Doppler at the new ref.

### Security 5 — Restore MFA gate
- Build `/account/mfa-enrol` (TOTP enrol + verify, recovery codes).
- Revert migration `20260525000009` (re-add `aal2` clause to
  `is_super_admin()` and `has_admin_permission()`).
- Restore the `if (aal !== "aal2") throw new AdminMfaRequired()` line
  in `apps/web/lib/admin/requireAdmin.ts` + the matching catch branch
  in `apps/web/app/admin/layout.tsx`.

---

## Deferred (post-MVP polish — confirmed safe to skip)

- **Policy library / visual cancellation builder** — current free-text
  policy field works.
- **POPIA fulfilment automation** — `/dashboard/settings/data` UI
  accepts requests; founder fulfils manually for now.
- **Quote room-level picker** — `quote_rooms` schema exists; whole-
  listing quotes work for MVP.
- **Inbox attachments + booking-link insert** — toolbar shows "coming
  soon" today; text-only inbox is functional.
- **Seasonal pricing bulk copy** — copy rules across listings.
- **"This month" date filter** in dashboard topbar — cosmetic
  placeholder, no filter wiring.
- **Experience duration-overlap check** — current capacity check is
  exact-time match; back-to-back overlap can collide but host can
  decline.
- **Guest inbox** (JG-10) — host can message guest from
  `/dashboard/inbox` but guest can't see thread.

---

## Out of scope for any single session

Anything not picked from the list above. If the picked track reveals
adjacent work, file it; don't fix in the same session unless trivial.
