# Vilo — Current Task

> Reset at the start of every session. This is the session contract.

**Active focus:** **Harden each feature to 100% for MVP.** This session:
the **Reviews** feature, end-to-end.

## ✅ Done this session (2026-06-10) — Calendar: manage availability + book from it
- **Wired the calendar's existing-but-unused block actions into the UI.** New
  right-rail **Availability** panel (per listing for the selected day:
  Open/Booked/Blocked) with one-tap **Block**, **Open up** (unblock) and **Book**
  (deep-links the new-booking wizard with listing + check-in prefilled).
- **Block dates** top-bar button → canonical `FormModal` to block/open a whole
  range listing-wide (`setManualBlocksAction`); booked + quote-held nights left
  untouched. Single-day toggle uses `toggleBlockedDateAction`.
- **New-booking prefill** — `/dashboard/bookings/new` honours `?listing=&checkIn=&checkOut=`
  (validated server-side); `ManualBookingForm` seeds listing/dates/picker month.
- Help: `20260610170000_help_calendar_manage.sql` (`managing-your-calendar`).
  `tsc` + `lint` green. Commits `73ae1f9`, `f95a48f`.

## ✅ Done this session (2026-06-10) — Inbox: one chat design (host = guest)
- **Single source of truth for the inbox.** Extracted shared components in
  `components/inbox/` (`ConversationList`/`ConversationRow`, `ChatMessageWall`,
  `ChatComposer`, `ChatThreadHeader`, `InboxAvatar`) used by BOTH the host inbox
  and the guest portal.
- **Host inbox reworked to the guest's two-pane WhatsApp layout.** Removed the
  folder rail, deal **pipeline**, tabs, pagination, assignee, follow-up/snooze and
  internal notes. Kept: quick-reply templates, a slim Booking/Details slide-out,
  archive/un-archive, pin. Deep links (`?c=`, `?f=enquiries`) + full-bleed intact.
- Deleted `PipelineControl.tsx`/`ConversationNotes.tsx` + 4 dead actions. DB
  `pipeline_stage` column + guest auto-advance left in place (harmless).
- Help: `20260610160000_help_inbox_redesign.sql` (new `using-your-inbox`; corrected
  `enquiry-pipeline-inbox`) — **pushed to remote**. `tsc` + `lint` green.

## ✅ Done this session (2026-06-10) — Party guests → guest records + relationships
- **Party members become guest records.** Each named person on a booking's
  `additional_guests` is materialised into `host_contacts` (deduped by email) so
  the host can open/message/tag them individually — they show in the Guests
  directory + have a working record automatically (`_host_guest_rows` UNIONs
  `host_contacts`).
- **`guest_relationships`** table + RLS links each party member ↔ the lead booker
  (one row per direction, tagged with the booking). New **Relationships** tab on
  the guest record; **Guests** tab on the booking record (replaces "Guest")
  showing lead + party with per-member record links + an **Add guest** action.
- **Single-source materialiser** — `_materialize_booking_party()` called by an
  `AFTER UPDATE OF status` confirm trigger AND the ownership-checked
  `materialize_booking_party()` RPC (lazy fallback on the booking record +
  Add-guest). Checkout party manifest now requires name + email; thank-you page
  lists the party. Migrations `20260610150000`, `20260610150001` (help).

## ✅ Done earlier (2026-06-10) — Reviews to MVP
- **Photos on reviews** — public `review-photos` bucket + `review_photos` table;
  token-gated signed upload from the (account-less) submit form; one reusable
  `ReviewPhotoGrid` (lightbox) on listing / dashboard / admin / portal / confirm.
- **Delayed request** — checkout enqueues `review_request_queue(send_at=+5min)`;
  `/api/review-request-worker` + `drain-review-requests` cron drain it via one
  SSOT `lib/reviews/request.ts → sendReviewRequest()` (email + in-app + thread
  card). Old daily queuer → paid-aware 24h backstop.
- **Fixed broken plumbing** — emailed review link had no token (resolver now
  signs it); added the missing in-app builder; fixed tokenless portal CTA.
- **Publish immediately** (was 48h); `protect_review_content()` makes reviews
  immutable (hosts may only respond); host **Review link** card on bookings.
- **Eligibility** — only completed **+ paid** stays (refunded-after-stay still
  counts). Help articles `how-reviews-work` (host) + `leaving-a-review` (guest).
- **Ops TODO (founder, one-time):** Vault `review_request_worker_url`; confirm
  `NEXT_PUBLIC_SITE_URL`. Probe: `scripts/verify-reviews.mjs` (green).

<details><summary>Previous focus — Finances are the spine</summary>

## ✅ Done (2026-06-08)
- **Reporting wired to the ledger** — new **Cash position** panel on Analytics
  (Collected/Outstanding/Refunded/Net cash + lifetime collection bar) sourced
  from `fetchHostTransactions`, so Reports, Ledger and Finances agree. Added
  canonical `txnFlows` (SSOT for collected/refunded/credits/charged); `txnStats`
  builds on it. Booked-value (accrual) vs cash explainer added; refund-rate
  labels disambiguated. Help article `reports-cash-position` (live). All 12
  analytics RPCs probed green against the real schema.
- **Booking-flow follow-ups** — live per-room availability + whole-place toggle
  (`b063d76`).
- **Host-Paystack spine fix** — guest card payments now charge the **host's own**
  connected Paystack (not the platform key); success-page verify uses the host
  key. `getHostPaystack` is the SSOT (`8a83d31`).
- **Pay-now link** — `bookings.pay_token` + public **`/pay/[token]`** page (card
  on host Paystack or EFT) + host **Payment link** card (Copy / WhatsApp /
  Email) on the Payments tab. Shared `startBookingPayment` core
  (`d6cffe3`, `3cd1134`). Help article `send-a-payment-link` applied.
- **Guardrails added** — AGENT_RULES **§4.7** (wire into the ledger, never fork
  the maths) + **§4.8** (booking card → host gateway). See
  `[[feedback_ledger_single_source_of_truth]]`.

</details>

## ▶ Next
1. **Test bookings end-to-end** with the host's connected Paystack test account
   (guest checkout card path + the `/pay/[token]` link). Founder-driven.
2. **Pay-link in the guest message thread** — deferred fast-follow (needs
   conversation lookup/creation; Copy/WhatsApp/Email cover resend today).
3. ✅ **Single-source-of-truth consolidation pass** (founder request) — DONE for
   the payments/finance audit: one `round2` (lib/format), one `INBOUND_KINDS` +
   `sumPaidFromRows`, success page via `confirmHostCardPaymentByReference`, one
   `requireHost()` adopted across ~14 action files, `getHostPaystack` in the
   banking link action, one `nightsBetween`. _Deliberately left:_ per-page
   `fmtDate` formatters (intentionally divergent — not forced).

---

<details><summary>Previous task — Booking Redesign — COMPLETE</summary>

**Plan:** see **`BOOKING_REDESIGN_PLAN.md`** (repo root) — full, buildable, phased.
**Designs:** `C:\Users\Wollie\Downloads\Listing 3.0.html` (listing) +
`C:\Users\Wollie\Downloads\Booking Flow.html` (checkout).

## Start here
1. Read `BOOKING_REDESIGN_PLAN.md` end-to-end.
2. Build phase-by-phase (§4), committing + pushing after each; `pnpm build` +
   `pnpm lint` green every time; tick the §5 Progress box.
3. Resolve the §3 flags (add-on units, in-flow availability, listing cleanup)
   in-phase — flag the founder before any schema change.

> Goal: listing page is **display-only** with **two CTAs** — **Reserve**
> (→ self-contained 3-step Rooms→Details→Payment flow) and **Request a quote**
> (→ existing modal). Guests cannot select rooms or book on the listing itself.

</details>

<details><summary>Previous task — Guest Record (CRM) — COMPLETE</summary>

**Plan:** `GUEST_RECORD_PLAN.md` · **Design:** `Guest Record.html`. Feature
complete (see Progress below).
</details>

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
- ✅ **Phase 9** Bulk mailer — guest_marketing + guest_broadcasts + RPCs;
  lib/guests/broadcast.ts (Resend, server-side); sendBroadcastAction (monthly cap);
  BroadcastModal ("Email guests"); public /unsubscribe/[token]; per-guest opt-out.
  **Build-only — not deployed/sent.** Uses existing RESEND_API_KEY +
  EMAIL_FROM_ADDRESS + NEXT_PUBLIC_SITE_URL (no new env, no edge fn — sends from a
  Server Action like the rest of the app). Founder to do the first live-send test.
- ✅ **Extra (founder request):** record **Reviews** + **Finances** (invoices/
  quotes/refunds/credit-notes) tabs; POPIA marketing-consent control (locked,
  opt-out only); per-host isolation confirmed (already enforced by RLS).

**Feature complete.** Remaining before real email use: set a verified Resend
sender domain and run a live-send smoke test; consider AAL2/MFA restore (separate).

Probes: `scripts/verify-guest-crm-p1.mjs`, `verify-guest-crm-p2.mjs` (run from apps/web).

---

## ✅ Previously completed (this session group)
- **Analytics variable-mismatch fix** — 12 RPCs realigned to the real schema; missing tables created.
- **Unified shell theme** — host dashboard, guest portal, super admin all on `ClassicShellFrame` +
  `AppHeader` + `GmailNav` (collapsible 76px rail); founder tweaks (no compose, no plan card, no header
  New-booking, thin scrollbar).
- **New Booking 5-step wizard** — `ManualBookingForm` re-laid into Property → Dates & guests → Guest →
  Price & extras → Payment, real logic preserved.
