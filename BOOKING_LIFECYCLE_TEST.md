# Booking Lifecycle — End-to-End Test Plan

> **Purpose.** Walk a booking through its whole life from **both the guest's and
> the host's point of view**, and at every step assert that ALL the associated
> side-effects fire: booking state, finances (ledger + documents), calendar
> blocks, notifications, inbox messages, and emails. This is the systematic
> counter to the codebase's dominant failure mode — a step that "works" but whose
> side-effect silently no-ops (RULES §8.1).
>
> **How to use.** Drive each event live (founder logged in, Claude verifying via
> DOM + DB). A checkbox flips to ✅ only with **real evidence** — a screenshot, a
> DB row, a ledger/notification record. Anything unproven stays ⬜. Fix on the spot.
>
> **Legend:** ⬜ not tested · 🔄 testing · ✅ verified live+DB · ⚠️ works w/ caveat · 🔴 broken (fix)
>
> **Test host:** `host@wielodemo.com` / `WieloDemo123!` · **Guest:** `guest@wielodemo.com` / `WieloDemo123!`
> **DB truth:** service-role REST via `apps/web/.env.local` (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).

---

## Reference — the moving parts each step can touch

| System | What to check | Where it lives |
|---|---|---|
| **Booking state** | `status`, `payment_status`, `previous_status`, timestamps (`confirmed_at`, `checked_in_at`, …) | `bookings` |
| **Finances — ledger** | one payment row per charge; `status`, `amount`, `refunded_amount`, `kind`, `voided_at` | `payments` |
| **Finances — balance** | `balance_due`/paid derived from COMPLETED payments (`sumPaidFromRows`) — board + record must AGREE | ledger, not the stale column |
| **Documents** | Invoice (INV), Receipt (RPT), Credit note (CN), Refund (REF), Forfeiture (FRF) — numbered per business | `invoices`, `wielo_credit_notes`, doc renderers |
| **Calendar** | `blocked_dates` written on confirm (source `booking`), released on cancel; half-open (checkout night free) | `blocked_dates` + triggers |
| **Policy** | snapshot frozen at booking creation; drives refund math | `policy_snapshots` |
| **Notifications** | in-app (bell) + push (mobile, N/A web) — `booking_request_host`, `booking_confirmed_guest`, … | `notifications`, dispatch registry |
| **Inbox / messages** | conversation created; system cards posted (payment received, confirmed) | `conversations`, `messages` |
| **Email** | Resend via the queue/worker — request, confirmation, EFT instructions, decline, review request | `notification_queue` → worker |
| **Guest CRM** | booking materialises the guest into the host's contacts | `host_contacts` |

---

## PHASE A — Booking arrives (created, not yet paid/confirmed)

**Event A1 — Guest creates a booking** (pick a rail below; each funnels through the one persist tail `persistBookingAndPay`).

Sub-paths to exercise: **A1a** app checkout · **A1b** host website checkout · **A1c** marketplace deal (`/deal/[slug]`) · **A1d** quote → accept · **A1e** host manual booking (`/dashboard/bookings/new`).

Assert at creation (host + guest POV):
- ⬜ Booking row created with **server-recomputed price** (client price never trusted, guest paths)
- ⬜ `status` = `pending` (card/PayPal/instant) or `pending_eft` (EFT) — correct per rail
- ⬜ **Policy snapshot** frozen (`policy_snapshots` row for the booking)
- ⬜ Pending **payment row** created (not completed)
- ⬜ `blocked_dates` **NOT yet written** (dates not locked until confirm)
- ⬜ **Host notified** — `booking_request_host` in-app bell + email (guest still pending) — fires on EVERY path incl. manual/website/deal
- ⬜ Guest sees the right next step (pay / EFT instructions / awaiting host)
- ⬜ Booking appears on host **board** + "Needs your attention"; **quick-panel balance == full-record balance** (ledger-derived, must agree)
- ⬜ Guest **materialised into CRM** (`host_contacts`)
- ⬜ Inbox **conversation** exists (or is created on first message)

---

## PHASE B — Payment / settlement

**Event B1 — Card (Paystack), guest pays on the HOST's account**
- ⬜ Guest redirected to Paystack, pays test card → returns to `/pay/[token]?reference=…`
- ⬜ `confirmHostCardPaymentByReference` verifies on the **host's** key (not platform); reference scoped to THIS booking (replay-safe)
- ⬜ Payment row → `completed`; ledger recompute sets `payment_status` + `balance_due`
- ⬜ Booking `pending → confirmed`; `blocked_dates` written (trigger); `confirmed_at` set
- ⬜ **Invoice** minted / flipped `issued → paid`
- ⬜ Emails: `booking_confirmed_guest` + host; inbox **"payment received / confirmed"** system card
- ⬜ In-app notification to guest

**Event B2 — PayPal, guest pays on the HOST's account**
- ⬜ Capture on host's PayPal; **replay guard** (a completed order id can't confirm a different booking — regression-locked by `pay-booking.replay.test.ts`)
- ⬜ Same settle side-effects as B1 (payment completed, confirm, blocks, invoice, emails, card)
- ⬜ create→capture gap recovered by `booking-reconcile-worker`

**Event B3 — Manual EFT**
- ⬜ Guest sees **banking details + reference** (host's default account — the last-default guard keeps one always present)
- ⬜ Email `eft_instructions_guest`; host `eft_proof_received` when proof uploaded
- ⬜ Host **"Mark received"** (`markPaymentReceivedAction`) reconciles the pending row → completed (NOT "Record a payment", which adds a second row)
- ⬜ Ledger recompute; booking → confirmed; blocks; invoice paid; confirmation emails + card

**Event B4 — Deposit + balance split**
- ⬜ Deposit due up front; balance owed after; pay page shows split; ledger tracks partial → `payment_status = partial`
- ⬜ Balance payment settles → `completed`; invoice paid in full

---

## PHASE C — Host manages the booking

**Event C1 — Confirm** (manual/pending path): ✅-pattern from today's live test (BK-0085)
- ✅ `status → confirmed` persisted; success toast fires ONLY on a real transition (0-row guard)
- ✅ `blocked_dates` written (`2026-06-10/11/12`, source `booking`, checkout free — no off-by-one)
- ⬜ Guest notified `booking_confirmed_guest` (in-app + email); Activity log entry
**Event C2 — Decline**: ⬜ `status → declined`; dates released; `booking_declined_guest`; no invoice
**Event C3 — Change dates**: ⬜ reprice server-side; old blocks released + new written; guest notified
**Event C4 — Cancel (host)**: ⬜ policy refund calc from the snapshot; **credit note** + **refund request**; dates released; `booking_cancelled_*`; ledger reconciles (never fork — `finalizeCancellation`)
**Event C5 — Message guest**: ⬜ inbox thread; host message persists; guest new-message notification

---

## PHASE D — Stay

**Event D1 — Check-in**: ⬜ `status → checked_in`; `checked_in_at`; appears In-house
**Event D2 — Check-out**: ⬜ `status → completed`; **review request enqueued** (delay); worker re-validates (paid + no existing review) before sending
**Event D3 — No-show / forfeit**: ⬜ `forfeitBookingAction` → `status no_show` + `payment_status forfeited` + `balance_due 0` + **FRF statement** + guest notice + dates released (single money path — never the dead simple duplicate)

---

## PHASE E — Post-stay

**Event E1 — Review**: ⬜ request email/notification (24h after checkout cron); guest submits (token-gated); host notified `new_review_host`; host responds; aggregate rating recalculated (trigger)
**Event E2 — Refund request (guest)**: ⬜ guest requests; host approve → `refund-process` (Paystack/PayPal/EFT) OR decline; REF/CN documents; status history append-only; `payments.refunded_amount` rolled; balance re-derived
**Event E3 — Flag / dispute**: ⬜ host flags a review → admin moderation queue

---

## Cross-cutting invariants (assert they hold at EVERY step)

- **Money is one number.** Board quick-panel balance == full-record balance == ledger (`sumPaidFromRows`). Never the stale `balance_due` column. *(Fixed 2026-08-01: board was reading the column → showed "Paid in full" vs record's real owed.)*
- **No silent no-op.** Every mutation that returns success must have changed a row — re-read it. A 0-row UPDATE is not success (transition guard).
- **No double-book.** A confirmed/held date can never be re-booked; checkout night stays free (half-open).
- **Notifications actually send.** "Fired" = a `notifications` row AND (for email) a `notification_queue` row the worker drains — not just a code path that ran.
- **Documents are immutable + numbered per business.** INV/RPT/CN/REF/FRF sequence never gaps or forks.

---

## Verified live + DB — 2026-08-01 (host@wielodemo.com, BK-0085 Seaview)

- ✅ **Dashboard loads** (the blank screen was a corrupted `.next` dev cache from
  running `next build` alongside `next dev` — cleared; do NOT prod-build against a
  live dev server).
- ✅ **A-board:** booking appears; quick-panel balance now == full-record balance
  (ledger-derived) after the fix below.
- ✅ **C1 Confirm:** pending → `confirmed` persisted (`confirmed_at` set); success
  toast fires only on a real transition; `blocked_dates` written `2026-06-10/11/12`
  (source `booking`, checkout 13th free — no off-by-one). DB-verified.
- ✅ **B3/B-money — record payment:** R4 850 EFT recorded → `payments` row
  `completed`; **receipt RPT-0048** minted; ledger recompute → `payment_status
  completed`, `balance_due 0`, 100% collected; **invoice INV-0203 → `paid`**. All
  DB-verified. (First Save click missed on a page shift — the action itself is not a
  no-op; it settled on the retry.)
- ✅ **Banking last-default guard** (today's fix): unticking the sole default is
  refused with the guard message. Seen live.

## 🟢 SAVE POINT (2026-08-01 pt3) — harness + notifications + code-fixes ALL done; migrations + affiliate next

**Branch `fix/host-launch-hardening` (NOT pushed; 3 new commits `2ba4245`/`5059e57`/`666da90`). Tree clean,
type-check+lint green.** Resume anchor: memory `launch-prep-host-then-affiliate`.

**This session (pt2/pt3/pt4) — punch-list items 1–4 DONE:**
- **Harness (item 1):** `pnpm test:flows` 70/83 → **93/0 + 1 watched known-issue**. 9 stale tests rewritten,
  Q/T test-artefacts fixed, new journeys V/W/X. **X proves C1 double-decrement LIVE** (documented probe).
- **Notifications (item 2):** `booking_dates_changed_guest` + `review_response_guest` wired END-TO-END
  (registry+template+resolver+catalog+admin+dispatch). `notification_events` rows in migration `20260801230000`.
- **Delete (item 3):** `refund_admin_override_host` fully removed (moot in Model 2).
- **Code fixes (item 4):** date-change refreshes `price_breakdown` + invoice `line_items`; pay-page resolves
  rails by the BOOKING's business.
- **⏳ LIVE-VERIFY (founder-driven):** the 3 notification/pay flows above — trigger each in the UI, then Claude
  asserts `notification_delivery_log`/`notification_queue` + invoice PDF + rails via service role.

**▶️ REMAINING (founder order): item 5 migrations (C1 drop-duplicate-trigger + C2 orphan-fn drop + per-business
numbering — batched with the FINAL main-merge + `db push`, founder said "merge & push to main LAST"), then
item 6 AFFILIATE.** When the C1 DROP migration lands, promote harness probe X2 from `documented()` to `check()`.

---

## 🟢 SAVE POINT (2026-08-01) — money-integrity pass done; harness + comms next

**Branch `fix/host-launch-hardening` (NOT pushed). All committed, tree clean, type-check+lint+build green.**
Resume anchor: memory `launch-prep-host-then-affiliate`. Do **harness first, then notifications** (founder's order).

### DONE & committed (this session)
- **Money-integrity cluster** (`819e0cc`) — from the adversarial money-sequence audit: **E** markPaymentReceived
  double-credit guard · **A** void-completed-refund now reverses `payments.refunded_amount` + re-derives
  booking status (`resetBookingRefundStatus` in `void.ts`) · **B** void-CN reversal gated to `origin='manual'` ·
  **C** cancel-manual-CN claws back store credit · **D** forfeit transition-first (was minting 2 CNs on race) ·
  **I** refund-approve from-status guard · **G** stale "refund mints CN" comments corrected · **#5** rail-specific
  refund comms wired (EFT→`eft_refund_sent_guest`, card/PayPal→`refund_approved_guest`, manual→`refund_completed_guest`).
- Earlier commits: 2 blockers (PayPal replay, website specials), 6 host bugs, board-balance ledger fix, PayPal
  replay regression test, dead-cancel-branch, paypal dup-rows/multi-room polish.
- Harness `test:flows` J-fix (`next_quote_number` now takes `p_business_id`) — harness runs end-to-end again.

### Verified LIVE (founder session, host@wielodemo.com): dashboard, banking last-default guard, confirm→blocked_dates (DB), board balance, record-payment→RPT-receipt→invoice paid (DB).

### The three audits (full detail in the agents' reports; key items below)
1. **Notification wiring** — most events correctly dispatch (assert via `notification_delivery_log`). SILENT-COMMS
   GAPS: **date-change → guest** (`changeBookingDatesAction` notifies nothing — no event exists) and **host
   review reply → guest** (`replyToReviewAction` notifies nothing — no event). Dead events: `refund_approved_guest`
   + `eft_refund_sent_guest` (now WIRED via #5) + **`refund_admin_override_host` → FOUNDER DECIDED: DELETE**
   (moot in Model 2 — platform has no refund authority).
2. **Finance/policy/pricing/payment-methods** — ledger spine sound; policy refund snapshot-frozen (host policy
   edits don't touch existing bookings ✅); seasonal via TS `priceStay` ✅; DB `calculate_booking_price` is DEAD
   (only the harness calls it; references pre-rename tables). REAL BUGS: **C1** duplicate `on_booking_cancelled`
   trigger (`trigger_booking_cancelled` + `trigger_on_booking_cancelled`, both identical → cancel double-decrements
   `specials.redemptions_used` + `total_bookings`) → needs a DROP migration; **C2** orphan
   `on_refund_completed_create_credit_note` fn + stale comments (comments fixed; fn drop needs migration);
   date-change leaves stale `price_breakdown`; pay-page shows the DEFAULT business's rails, charge uses the
   BOOKING's business (multi-business mismatch).
3. **Adversarial money-sequence** — card/PayPal capture (§2) + cancellation (§5) are EXEMPLARY. Cluster A–I all
   FIXED above. Numbering (F): CN/RPT/REF use a GLOBAL gap-prone `nextval`, not per-business (low-med).

### 🚧 BLOCKER — cloud DB diverged: migrations `20260801160000`–`220000` are on the shared cloud project but in
NO git branch (the **help & docs agent's** work). `supabase db push` from this branch will refuse. So **C1/C2/
numbering migrations are BLOCKED** until those files land in the repo (coordinate with that agent / reconcile via main).

### Harness `pnpm test:flows` state: **70 passed, 13 failed** (needs `pnpm seed:demo` first; HOST_ID
`0a111111-…`, LISTING_A/B fixtures). The 13 fails categorised:
- **9 STALE TESTS (not app bugs — audits confirmed the app is correct):** G2–G6 + L1–L2 + M4 test the REMOVED
  refund→CN trigger (a standalone refund mints NO CN by design; only cancellation/forfeit do) → rewrite G to
  assert no-CN + `refunded_amount` bumped, rewrite L/M4 to source the CN from a CANCELLATION. **I1** asserts
  insert-as-confirmed makes NO invoice, but the invoice trigger now fires on INSERT OR UPDATE (current-correct) →
  flip the expectation.
- **Q2/Q3 (2):** numbering is global-sequence not per-business (the F finding) — align the test or accept.
- **T1/T3 (2):** the invoice trigger derives `subtotal` from post-discount `total` and does NOT itemise the
  discount into `line_items` (total is correct; a transparency gap, low). Decide: itemise on the invoice, or
  adjust the test.

### ✅ HARNESS DONE (2026-08-01 pt2) — `pnpm test:flows` = **93 passed, 0 failed, 1 known issue watched**
- **9 stale tests rewritten to current-correct behaviour:** **G** now asserts a completed refund mints NO credit
  note + rolls `payments.refunded_amount`/`payment_status`/`balance_due` (refund ≠ credit note); **I1** flipped —
  insert-as-confirmed DOES mint the invoice (INSERT-path fix), calendar block stays UPDATE-only (I2); **L** now
  asserts an over-refund is REFUSED by the DB (`refunded_amount <= amount` CHECK) + a within-capture refund still
  completes (was "cap the credit note"); **M4** sources its CN from a CANCELLATION (via `mintCancellationCN`,
  mirroring `cancel-settlement.ts`) since a refund no longer mints one.
- **Q2/Q3 fixed** (was a test artefact — two confirmed stays on the SAME nights collided on `blocked_dates` and
  rolled back the 2nd invoice; each booking now gets its own dates). **T1/T3 fixed** — the discount IS itemised,
  just under `line_items.stay_discount` (non-coupon); invoice `subtotal` is NET (total − vat). Assertions realigned.
- **New journeys:** **V** decline (no invoice, no block, dates stay free) · **W** no-show/forfeit releases the
  calendar block (room re-sells) · **X** special-redemption release — the **C1 double-decrement is now PROVEN LIVE**
  (cancel drops `redemptions_used` 2→0, should be 2→1) as a non-fatal `documented()` probe that flips to a hard
  `check()` the moment the DROP-duplicate-trigger migration lands. New `documented()` reporter + `specials` cleanup.

### REMAINING PUNCH-LIST (founder order: harness first — HARNESS ✅)
1. ~~**Harness:** rewrite the 9 stale tests → green; add a **C1 double-decrement assertion**; extend journeys.~~
   ✅ DONE (see above). **BLOCKER LIFTED** (founder 2026-08-01): the help/docs + funnel migrations are now pushed
   & live on `origin/main`, so C1/C2/numbering migrations are UNBLOCKED — but this branch is 12 ahead / 13 behind
   `origin/main`; reconciling the migration history (merge main in, or merge this branch to main first) is a
   branch-strategy call to confirm with the founder before pushing the C1 DROP migration.
2. ~~**Notification events (new):** `booking_dates_changed_guest` + `review_response_guest`.~~ ✅ DONE (2026-08-01
   pt2). Both wired END-TO-END: registry + email template (`BookingDatesChangedGuest`/`ReviewResponseGuest`) +
   resolver + catalog + admin sample/refs + **dispatch** (`changeBookingDatesAction` fires dates-changed with
   old→new dates; `replyToReviewAction` fires review-response on the FIRST reply only). `notification_events` rows
   seeded in migration `20260801230000` (staged; dispatch already works w/o the row — no FK). tsc+lint green.
   **⏳ LIVE-VERIFY (founder):** move a booking's dates + reply to a review in the UI, then assert
   `notification_delivery_log` + `notification_queue` rows (Claude queries via service role) + the /admin/emails
   preview renders both.
3. ~~**Delete `refund_admin_override_host`**~~ ✅ DONE (2026-08-01 pt2). Removed from registry + catalog + email
   registry + resolver (refund.ts) + admin sample/refs + template file deleted; `notification_events`/overrides
   row dropped in `20260801230000`. Seed migration + CHANGELOG left intact. Founder-approved (moot in Model 2).
4. ~~**Code fixes:** date-change refresh `price_breakdown`; pay-page resolve rails by the BOOKING's business_id.~~
   ✅ DONE (2026-08-01 pt3). `changeBookingDatesAction` now (a) recomputes + stores a fresh `price_breakdown`
   snapshot for the new dates (was stale — old nights/seasonal split), and (b) refreshes the **invoice
   `line_items`** date-driven fields (`check_in/check_out/nights/base_amount`) — the invoice PDF renders those,
   frozen at issue, so a moved booking previously showed new totals over OLD dates. Pay page
   (`booking/[id]/pay`) resolved rails by `host_id` (default business) → now resolves Paystack/PayPal/**EFT** by
   the BOOKING's `business_id` (new `businessHasValidEft`), falling back to host-default only when unset — the
   charge always uses the booking-business's rails, so the advertised account now matches. tsc+lint green.
   **⏳ LIVE-VERIFY (founder):** move a confirmed multi-business booking's dates → check the invoice PDF shows new
   dates + a `notification_delivery_log` row; open a second-business booking's pay page → rails match that business.
5. **Migrations (BLOCKED on divergence):** C1 drop duplicate trigger; C2 drop orphan fn; per-business numbering.
6. **Then:** affiliate program + competition (second priority) — incl. reconfirm `create/settle_affiliate_payout`
   + prize RPC anon-EXECUTE/IDOR grants (see `docs/WIRING_AUDIT.md` §0).

---

## Findings & fixes log (append as we go)

- **2026-08-01 — Board balance forked from the ledger (FIXED).** The bookings board
  quick-panel read the denormalised `balance_due` column while the full record
  derived from the ledger (`sumPaidFromRows`), so a seed booking with a stale
  column showed "Paid in full" while the record correctly showed R4 850 owed.
  Board now derives balance from completed payments per booking (one query,
  canonical `sumPaidFromRows`). `apps/web/app/[locale]/dashboard/bookings/page.tsx`.
