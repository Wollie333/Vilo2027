# Next steps — big work to start in fresh sessions

> **Save point: 2026-07-12.** The host-dashboard functional sweep (all 35 tabs) is
> complete and the access-details / notification work below the line is shipped.
> This file lists the **large, outstanding pieces the founder asked for** so a new
> session can pick any one up cleanly. Each is scoped to be its own session.
> New standard in play: **BUSINESS_PRINCIPLES.md → Principle #12** (every feature
> gets a detailed lifecycle flow in `docs/lifecycles/`).

Test host: `host@wielotest.com` / `WieloTest123!` (host_id `0b111111-1111-4111-8111-111111111111`,
property `0b222222-2222-4222-8222-222222222221`). DB truth via `scratchpad/sbenv.sh`.
Driving gotchas are in memory `host-dashboard-sweep` (esp. `preview_resize` → pass explicit `width:1536`).

---

## 0. 🟡 Policy enforcement, add-ons & refunds (booking safety) — P0 + Phase 1 DONE; Phase 2/3 remain.

**Full grounded plan: `docs/features/POLICY_ENFORCEMENT_ADDONS_REFUNDS_PLAN.md`** (audited live 2026-07-12).

**✅ DONE & verified live (session #62, 2026-07-12):**
- **P0/G1** — `snapshot_booking_policies` `min(uuid)` crash fixed (migration `20260712140000`,
  count-then-select room derivation) + backfilled every booking. `policy_snapshots` was EMPTY for every
  booking (0% refund for all); now populated. Verified a NEW real booking (BK-0037) freezes all 4 policy
  types via the live guest checkout, and `calculate_policy_refund_amount` returns correct tiers (100/50/0%).
- **G2** — snapshot write in `persist.ts` no longer silent: on RPC failure it alerts admins
  (`policy_snapshot_failed`) so a no-policy booking can be healed.
- **G3** — `policy_snapshots` immutability trigger (migration `20260712150000`): blocks UPDATE always +
  DELETE except the GDPR purge (which sets a txn-local flag). Verified service-role UPDATE/DELETE rejected.
- **G4** — refund completion now flips `bookings.payment_status` → `refunded`/`partially_refunded`
  (extended the v11 completion trigger). Verified live: a R2 000 partial refund on BK-0027 → the UI shows
  a "partially refunded" pill; a full refund on BK-0036 → `refunded`.

**⏳ REMAINING (Phase 2/3):**
- **G5 (P2)** — refund base = amount actually **paid**, not `total_amount`; fix `total_paid` label for
  deposit-only/partial bookings.
- **G6 (P2)** — **"Policies (as booked)" panel** on host `dashboard/bookings/[id]` AND guest
  `portal/trips/[id]`, reading `policy_snapshots` + accepted Wielo terms/privacy versions.
- **G7 (P2)** — add-on refundability decision (flag refundable/non-refundable; exclude or per-line).
- **G8/G9 (P3)** — freeze the accepted platform-T&C **text** (not just the version stamp); split the one
  combined checkout acceptance into distinct host-legal vs Wielo-terms acknowledgements.
- **⚠️ Ledger quirk found (belongs to §1 sweep):** after a **partial** refund the Payments panel shows
  `PAID R0` / full balance due, because `sumCompletedPaid` filters `status='completed'` and the refund
  trigger flips the payment to `partially_refunded` — so a partially-refunded payment stops counting as
  paid at all. Pre-existing (not caused by G4). Net paid should be `captured − refunded`.

**Also fold in (card-path proof):** provide **Paystack test/sandbox** keys + connect a test host so the
card checkout, `/pay` deposit toggle, and `paystack-webhook` can be driven end-to-end (the current test
host has no gateway, so the whole card rail is unexercised).

---

## 1. Deep financial sweep (audit every calculation + ledger entry)

The Finances tabs were verified to **render correctly and produce real PDF documents**, but the
**numbers themselves were not exhaustively re-derived**. Do that:

- **Ledger running balances** — for each guest, walk the ledger rows in order and confirm the
  running "owed / credit / paid" balance is arithmetically correct after every entry (host ledger
  `/dashboard/ledger` and admin/Wielo ledger `/admin/subscriptions/revenue` — Principle: they must match).
- **VAT** — host prices are EX-VAT; the `apply_booking_vat` trigger grosses `total_amount` up; the guest
  is charged VAT-inclusive; invoices/receipts show the VAT line. Re-derive on a VAT-registered listing:
  net → VAT (15%) → gross, and confirm charge == shown == invoice total. Non-VAT listing = no-op.
- **Documents** — invoice / receipt (RPT) / credit-note (CN) / refund (REF) amounts + the unified
  doc-numbering scheme (`INV/RPT/REF/CN/Q/BK-####`, globally sequential — see memory `reference-doc-numbering-scheme`).
- **Payment reconciliation** — pending → completed (card webhook + EFT "Mark received"); confirm the
  pending row is reconciled (not duplicated), and the ledger + booking `payment_status` agree.
- **Refunds & credit notes** — issuing a refund/credit mints the right `wielo_credit_notes` doc and the
  ledger REFUNDED/CREDITS KPIs update; math matches the cancellation policy's refund %.
- **Commission-saved** (`/dashboard/reports/savings`) — the "vs OTA 18%" figure math.
- **Cross-checks** — sum(payments) vs ledger COLLECTED; sum(charges) vs bookings; no orphan/duplicate rows.
  (NB the test fixture has some prior-sweep artifacts: MVP Deal Retest / MVP Sweep Test bookings, and a
  **duplicate active subscription row** on the test host — prune at the pre-launch wipe.)

Deliverable: findings + fixes, and fold the money mechanics into `docs/lifecycles/payments-ledger.md`.

---

## 2. Real live booking lifecycle — verify end-to-end AND record it (Principle #12)

Drive a **real booking** on the live preview + DB, from discovery to review, and at **every step**
confirm the guest notification, host notification, calendar block, ledger entry, email, inbox card, and
status transition all fire correctly on **both ends**. Cover the branches: **EFT vs card (Paystack) vs
PayPal**, **pending vs confirmed**, and the **host "send payment link" → guest pays** path.

Then **record the verified flow** in `docs/lifecycles/booking.md` using the Principle #12 step skeleton —
each step names the functions/files, DB writes, and side-effects. Founder's example shape:
`guest books room → guest gets confirmation → host ledger charge row → host gets booking-request
notification (with next step) → host sends payment link → guest gets email w/ link → guest clicks →
guest pays → success returns booking → booking blocks the host calendar → …`.

**The tail must include** (these are shipped — verify + document them):
- Day-before **check-in reminder** to host AND guest (push + in-app) — `checkin-reminder-worker`.
- **Access card (inbox) + stay-details email** at the host's configured lead before check-in
  (`property_access.send_lead_minutes`, default 60 — `send_due_access_cards()` + `stay_details_guest`).
- Check-in → checkout → **review request** (see item 3 — currently checkout **+5 min**, founder wants **60 min**).

Deliverable: `docs/lifecycles/booking.md` (verified), plus any bugs found + fixed along the way.

---

## 3. Reviews feature — deep audit + lifecycle (`docs/lifecycles/reviews.md`)

Audit the whole reviews chain with functions + logic, and **change the post-checkout review-request
delay from 5 min → 60 min** (founder default; consider making it configurable):

- Eligibility (completed stay) → `review_request_queue.send_at` (**currently checkout + 5 min** —
  `20260610000001_reviews_mvp_hardening.sql`; change to 60 min) → `review-request-cron` →
  `/api/review-request-worker` → `review_request_guest` email (`ReviewRequestGuest`) with a 30-day token
  link → guest submits (no account required) → publish → host **reply / feature / flag**
  (verified in the sweep) → rating aggregation on the listing/host.
- Verify each step live (seed a completed stay), fix gaps, and record the flow.

---

## 4. Backfill core feature lifecycle docs (Principle #12, ongoing)

Write `docs/lifecycles/<feature>.md` for each core feature, most-load-bearing first:
**booking → payments-ledger → reviews**, then quotes, subscriptions, specials, access-details,
calendar-sync. Index is `docs/lifecycles/README.md`. From here on, **write/update the lifecycle doc as
part of building or auditing any feature** — it's a Principle now.

---

## Smaller carried-over follow-ups

- **Duplicate active subscription row** on the test host (2 rows, both `business`; the profile-header
  query is now robust but the data is messy) — prune at the pre-launch user-data wipe.
- **Founder ops config before production** (from admin memory): VAT number, SWIFT, `PAYMENT_CIPHER_KEY`,
  Turnstile keys, Vault worker URLs/secrets (`checkin_reminder_worker_url`, `ical_sync_worker_*`),
  redeploy the paystack-webhook (has the `activate_on_pay` guard), and set the email-worker cron.
