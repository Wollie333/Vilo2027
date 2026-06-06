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

---

## ✅ Previously completed (this session group)
- **Analytics variable-mismatch fix** — 12 RPCs realigned to the real schema; missing tables created.
- **Unified shell theme** — host dashboard, guest portal, super admin all on `ClassicShellFrame` +
  `AppHeader` + `GmailNav` (collapsible 76px rail); founder tweaks (no compose, no plan card, no header
  New-booking, thin scrollbar).
- **New Booking 5-step wizard** — `ManualBookingForm` re-laid into Property → Dates & guests → Guest →
  Price & extras → Payment, real logic preserved.
