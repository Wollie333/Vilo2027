# Vilo — Current Task

> ⚠️ **Reset this file at the start of every Claude Code session.** This is your session contract — the agent will not work outside this scope without asking first.

**Date:** 2026-05-24 (autonomous run wrap-up) / next session
**Phase:** Phase 2 + Phase 3 + Phase 4 substantially landed.
**Session Goal (next):** Push 16 local commits to `main`, apply three pending migrations, and do the first end-to-end smoke test of the platform.

---

## What landed in the autonomous run (2026-05-24)

13 feature commits + 1 docs commit, all green build / green lint, sitting on
local `main`:

| # | Commit | What |
|---|--------|------|
| 1 | `feat(legal): site-wide cookie consent banner` (243767e) | POPIA banner in root layout |
| 2 | `feat(reviews): guest-side submission flow at /review/[bookingId]` (cae281e) | Token-gated review form + HMAC helper |
| 3 | `feat(subscription): plan picker, cancel/resume, history feed` (775783b) | Full dashboard at /dashboard/settings/subscription + migration 003 |
| 4 | `feat(refunds): host-side queue + approve/decline + booking-detail refund` (0a01f6e) | /dashboard/refunds + issue-refund on booking detail |
| 5 | `feat(admin): phase B — users, hosts, listings search + detail` (01a1672) | 3 list pages + 2 detail pages + suspend/verify actions |
| 6 | `feat(emails): phase 2/3 react-email templates batch` (694a91c) | 11 templates + shared Button/Heading |
| 7 | `feat(privacy): popia data export + account deletion requests` (e2ef691) | /dashboard/settings/data + migration 004 |
| 8 | `docs(changelog): record 7-commit autonomous mvp push` (e4d5d57) | Mid-run CHANGELOG snapshot |
| 9 | `feat(calendar-sync): ical import — per-listing feeds + sync action` (355d19a) | iCal import end-to-end + migration 005 |
| 10 | `feat(marketing): public about, contact, help pages` (3e21476) | /about, /contact, /help + footer fixes |
| 11 | `feat(admin): phase C — bookings, payments, subscriptions, reviews` (f115fa4) | 4 admin list pages + review moderation actions |
| 12 | `feat(admin): popia data-requests queue under moderation` (5d41338) | /admin/data-requests + 3 audited actions |
| 13 | `feat(guest): /my-trips list + detail + refund request flow` (ca5adf9) | Guest booking surface + guest refund request |
| 14 | `docs(changelog): record wave 2 autonomous run` (pending) | Final CHANGELOG wrap |

---

## Acceptance criteria (this session — the wrap-up)

- [ ] `git push origin main` — sends all 16 commits to origin; Vercel auto-deploys.
- [ ] Apply three migrations to remote:
  ```bash
  supabase db push --linked
  supabase gen types typescript --linked > packages/types/database.types.ts
  git add packages/types/database.types.ts
  git commit -m "chore(types): regenerate after migrations 003/004/005"
  git push origin main
  ```
- [ ] Smoke-test the new surfaces in production:
  - https://vilo2027.vercel.app/cookies — banner shows on first visit
  - /dashboard/settings/subscription — try the plan picker
  - /dashboard/refunds — confirm the empty state renders
  - /dashboard/calendar-sync — add a fake iCal URL, hit Sync (should error gracefully)
  - /dashboard/settings/data — submit a test export request
  - /my-trips — empty state if you have no bookings
  - /admin/users + /admin/hosts + /admin/listings — confirm RBAC works
  - /admin/data-requests — confirm the test request from /dashboard/settings/data shows up

---

## What's still pending for MVP launch

**Provider integration (real money):**
- Paystack live keys + webhook
- PayPal live credentials + webhook
- Resend domain verification + email worker that consumes notification_queue

**Mobile (Track 6):**
- NativeWind wiring (Phase 0 carry-over)
- Mirror web auth + booking flows in Expo

**Infrastructure (Track 5+):**
- Sentry + PostHog wiring (deferred until users exist)
- Supabase region migration: Frankfurt → Cape Town (af-south-1)

**Email worker:**
- Cron job + Edge Function that drains `notification_queue` via Resend
- Wires the 12 templates already in `emails/templates/`

**Track 6 (mobile)** is the only large untouched track. Track 1, 2, 3, 4, 5
are all substantially complete.

---

## Decisions made autonomously this run

- **Refund optimistic completion:** Approve flips through `approved` then
  immediately to `completed` so the v11 status-history + payments.refunded_amount
  triggers fire. Real Paystack/PayPal call replaces this when keys land.
- **Subscription plan switch:** No provider call, just state. Trial of 14 days
  on first paid switch. Auditing via the new INSERT/UPDATE triggers in
  migration 003.
- **iCal export tokens:** Already shipped via HMAC per-listing (no
  `ical_feeds` table needed for export). Import now writes to
  `ical_feeds` so per-feed rotation is possible later.
- **Guest refund insert:** Routes through admin client because the guest
  doesn't have read-permission on the payment row across host scope.
  Authorization stays guest-bound (booking.guest_id === auth.uid()).
- **POPIA fulfilment:** Manual. Admin queue at /admin/data-requests
  shows pending requests; founder processes the JSON export or
  deletes the account by hand. Automated export Edge Function is a
  launch-readiness slice.
- **`users.suspend` permission for data-requests:** Reused an existing
  high-trust permission key rather than adding a `data.requests` key
  and re-running RBAC. Only super_admin grants it by default.

---

## Push command (run this when you return)

```bash
git push origin main
```

If Vercel previously deployed any of the migrations' dependent code (e.g.
`/admin/data-requests` queries the `data_requests` table) before the
migrations applied, those pages will 500 until the migrations land.
Apply migrations first if you can — but the push itself is safe.
