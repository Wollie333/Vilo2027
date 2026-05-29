# Vilo — Current Task

> ⚠️ **Reset this file at the start of every Claude Code session.** This is your session contract — the agent will not work outside this scope without asking first.

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
