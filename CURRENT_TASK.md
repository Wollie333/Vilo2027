# Vilo — Current Task

> ⚠️ **Reset this file at the start of every Claude Code session.** This is your session contract — the agent will not work outside this scope without asking first.

**Date:** 2026-05-25 (post wrap-up)
**Phase:** Phase 2 + Phase 3 + Phase 4 substantially live in prod. Track 6 (mobile) and provider-live integration are the last big slices.
**Session Goal (next):** Pick one of the four open tracks below. Don't broaden scope mid-session.

---

## What's already in prod (as of 2026-05-25)

- All wave 1+2 autonomous-run commits are on `origin/main` (15 commits).
- Remote Supabase (`zlcivjgvtyeaszikqleu`) has migrations applied through
  `20260525000005_ical_feeds`.
- `packages/types/database.types.ts` is in sync with remote.
- Public surfaces (marketing, login, signup) verified 200 on Vercel.
- Auth-gated routes verified 307 → login (no 500s on migration-dependent
  pages).

See `CHANGELOG.md` 2026-05-25 entry for the full wrap-up log.

---

## Pick ONE for the next session

### Option A — UI smoke test from a real logged-in browser
Founder runs through every new surface in `CHANGELOG.md` 2026-05-24
entries to confirm visually + functionally:
- `/dashboard/settings/subscription` plan picker, cancel/resume,
  history feed
- `/dashboard/refunds` queue, approve/decline, issue-refund on
  booking detail
- `/dashboard/calendar-sync` add fake iCal URL, hit Sync (expect
  graceful error since URL is junk), confirm `ical_feeds` row
- `/dashboard/settings/data` submit export + delete-account requests
- `/my-trips` list + detail + refund-request flow as a guest
- `/admin/users`, `/admin/hosts`, `/admin/listings` search + suspend
- `/admin/bookings`, `/admin/payments`, `/admin/subscriptions`,
  `/admin/reviews` list views
- `/admin/data-requests` shows the request submitted from
  `/dashboard/settings/data` above; confirm approve/complete writes
  to `admin_audit_log`

Log any breakage as a Linear / GitHub issue. This is the highest-value
next session — every other track depends on knowing the core flows
work.

### Option B — Email worker (drain `notification_queue` via Resend)
Build the cron + Edge Function that consumes `notification_queue` and
sends each row through Resend using the 12 templates already in
`emails/templates/`. Needs:
- Resend API key in Doppler `dev` (and domain verification on
  vilo.co.za — Wollie has the DNS access).
- `supabase functions deploy email-worker`
- `supabase cron schedule` row (every minute, max 50 per tick).
- Wire the React Email components to the Resend `react` payload
  field.

### Option C — Paystack live integration (cards + subscriptions)
- Paste live keys into Doppler `dev` (test mode keys are fine until
  Paystack approves the account).
- Create the webhook endpoint and register it in the Paystack
  dashboard.
- Replace the optimistic refund completion in
  `apps/web/lib/actions/refunds.ts` with a real `transaction/refund`
  call.

### Option D — Track 6 (mobile) — NativeWind + auth bridge
Carry-over from Phase 0. Wire NativeWind on the Expo side, port the
web `/login` and `/listing/[slug]` screens to mobile to prove the
auth + data path works on both targets.

---

## Pending follow-ups not big enough for their own track

- **POPIA fulfilment automation.** Today the founder hand-runs the
  export. Edge Function that pulls every personal-data row by
  `auth.uid()`, zips the JSON, uploads to a private bucket, emails a
  signed URL.
- **`subscription_history` trigger backfill check.** New trigger fires
  on every UPDATE — historical rows pre-trigger have no audit. Run a
  one-time backfill if any host subscriptions existed pre-2026-05-25
  (unlikely — pre-MVP).
- **Sentry + PostHog.** Defer until Option A reveals real issues
  worth tracking, or until first beta user lands.
- **Frankfurt → Cape Town region migration.** Still owed per
  `project_vilo_phase0_state.md` — do this before public launch, not
  during the build.

---

## Out of scope for this session

Anything outside the chosen Option above. If the picked track reveals
adjacent work (e.g. Option A finds a bug), file it; don't fix in the
same session unless trivial.
