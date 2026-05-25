# Vilo — Current Task

> ⚠️ **Reset this file at the start of every Claude Code session.** This is your session contract — the agent will not work outside this scope without asking first.

**Date:** 2026-05-25 (post wave 3)
**Phase:** Pre-MVP launch path. Code-side of host + guest experiences is
substantially complete. Remaining work is operational — credentials,
domain verification, region migration.
**Session Goal (next):** Pick one of the launch-ops items below OR a
deferred polish item if launch-ops are blocked.

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
