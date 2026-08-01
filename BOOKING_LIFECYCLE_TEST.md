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

## Findings & fixes log (append as we go)

- **2026-08-01 — Board balance forked from the ledger (FIXED).** The bookings board
  quick-panel read the denormalised `balance_due` column while the full record
  derived from the ledger (`sumPaidFromRows`), so a seed booking with a stale
  column showed "Paid in full" while the record correctly showed R4 850 owed.
  Board now derives balance from completed payments per booking (one query,
  canonical `sumPaidFromRows`). `apps/web/app/[locale]/dashboard/bookings/page.tsx`.
