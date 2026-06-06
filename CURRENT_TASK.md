# Vilo — Current Task

> Reset at the start of every session. This is the session contract.

**Next task:** Build the **Guest Record (CRM)** feature.
**Plan:** see **`GUEST_RECORD_PLAN.md`** (repo root) — full, buildable, phased.
**Design:** `C:\Users\Wollie\Downloads\Guest Record.html` (match exactly).

## Start here
1. Read `GUEST_RECORD_PLAN.md` end-to-end.
2. Confirm the 5 **Open decisions** in §9 with the founder before Phase 1.
3. Build phase-by-phase (§6), committing + pushing after each; `pnpm build` + `pnpm lint` green every time.

## One-line summary
Add a **Guests** sidebar item (after Bookings); a Guests list (`/dashboard/guests`); a CRM **Guest
Record** page (`/dashboard/guests/[gkey]`) — identity + verifications, lifetime stat band, tabs
Overview/Bookings/Messages/Payments/Notes; two-way linked with Booking Details. New tables:
`guest_notes`, `guest_tags`, + `user_profiles` verification columns. Guests are keyed by a unified
`gkey` (user_profiles.id, or `e_<base64url(email)>` for email-only manual-booking contacts).

> **ARCHITECTURE CHANGE (2026-06-06):** founder chose to **reuse & extend** the
> existing `host_contacts` (tags/notes/blocked, deduped by email) + `message_templates`
> (full CRUD in `inbox/actions.ts`, `{{guest_name}}` tokens) instead of the plan's
> parallel `guest_contacts`/`guest_tags`/`guest_flags`/new-templates tables. Only
> `guest_notes` is genuinely new. `gkey` is a URL/resolution scheme, not a stored
> column. Inbox **Contacts tab + page removed** (Guests supersedes it). Keep it lean.

## Progress (Guest CRM build)
- ✅ **Phase 1** schema — extended host_contacts (+country/email_consent/blocked_*),
  new `guest_notes`, user_profiles verify cols, seeded message_templates. (commit 59856e8)
- ✅ Inbox Contacts tab + page removed. (632aa71)
- ✅ **Phase 2** RPCs — `_host_guest_rows`, `fetch_host_guests`(+`_summary`),
  `fetch_guest_record`; demo-host probe green. (e627e55)
- ✅ **Phase 3** sidebar entry + badge + `/dashboard/guests` list (KPI strip, segments,
  search, density, sort, pagination, rows). (06f0f76)
- ✅ **Phase 4** Add guest modal + filters + selection/bulk Tag·Export + CSV/vCard
  actions on host_contacts (lazy upsert). (d2d9092)
- ✅ **Phase 5** Guest Record shell — identity + stat band + Overview/Bookings/Payments + prev/next. (5a332e0)
- ✅ **Phase 6** Messages + Notes tabs (+ template picker) + Templates manager. (6aebc9b)
- ✅ **Phase 7** Booking↔record link + record More-menu (tag/block/export/new-booking). (cc8c089)
- ✅ **Phase 8** Help article (`guests-crm`) + CHANGELOG.
- ⏳ **Phase 9** Bulk mailer — guest_marketing + guest_broadcasts, send-guest-broadcast
  Edge Function, /unsubscribe route, BroadcastModal + per-guest subscription toggle.

Probes: `scripts/verify-guest-crm-p1.mjs`, `verify-guest-crm-p2.mjs` (run from apps/web).

---

## ✅ Previously completed (this session group)
- **Analytics variable-mismatch fix** — 12 RPCs realigned to the real schema; missing tables created.
- **Unified shell theme** — host dashboard, guest portal, super admin all on `ClassicShellFrame` +
  `AppHeader` + `GmailNav` (collapsible 76px rail); founder tweaks (no compose, no plan card, no header
  New-booking, thin scrollbar).
- **New Booking 5-step wizard** — `ManualBookingForm` re-laid into Property → Dates & guests → Guest →
  Price & extras → Payment, real logic preserved.
