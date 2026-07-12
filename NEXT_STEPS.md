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

## A. ✅ Onboarding wizard — DONE + verified live 2026-07-12 (session #67).

All six founder fixes shipped and driven live (wizard canvas + resulting listing/DB): (1) new optional
**Seasons** step; (2) room pricing-model badge + model-aware price; (3) delete rooms (with active-booking
guard); (4) migration `20260712170000` seeds default booking_terms at host-create + auto-assigns all 4
policy types active-by-default; (5) real email-verified publish gate on directory + website channels;
(6) `ListingPublishedHost` email on first publish (summary + link). Flow recorded in
`docs/lifecycles/onboarding.md`. Details below kept for reference.

## A(orig). 🔴 Onboarding wizard — test end-to-end + make it work 100% (founder, 2026-07-12). NOT STARTED.

**The flow to prove:** a user signs up + pays → is redirected to the **host dashboard** → (1) verifies
their email (believed already working — confirm) → (2) completes the **onboarding wizard**. Drive it live
end-to-end and record the lifecycle in `docs/lifecycles/onboarding.md` (Principle #12).

**Founder-specified shortcomings to FIX (all must work):**
1. **Add a Seasonal Pricing setup step** to the wizard (see Job B — it must also work with the booking system).
2. **Room pricing must pull through to the UI**, and each room's **pricing model** (per-person / per-room /
   any other model) must be **indicated on the UI AND wired into the price calc** so the price computes
   correctly for that model.
3. The **add-rooms step** must let the host **delete rooms** from the UI (not just add), and pull through
   each room's pricing/details on the UI.
4. **Policies:** the policy page has **no default booking-terms policy** — the system must **create default
   booking terms** for the host (editable/updatable). The existing policies should be **active by default**
   for **all 4 policy types** (cancellation, check_in_out, house_rules, booking_terms), while still letting
   the host create new ones per type.
5. **Publish gates (verify correct):** a host **cannot publish** to the **directory** (as a live/public
   listing) **or to their website** unless BOTH: (a) email is **verified**, AND (b) they have an **active
   subscription whose permissions == the features they want to use** (`check_feature_permission` RPC — but
   note the pre-MVP short-circuit in AGENT_RULES §3.4). Confirm both gates are enforced at the UI AND the
   server/publish action.
6. **Onboarding-complete email:** once onboarding is 100% successful, **auto-send an email to the host** with
   a **summary of their new active listing** + a **link to it** (public listing URL). New Resend template.

**Approach:** (i) map the current wizard end-to-end (steps/components/state/completion detection, post-pay
redirect, email-verify gate, room step, policy step, publish action) — an Explore pass; (ii) drive it live
on a FRESH host (sign up + pay path, or seed a new host) noting every gap; (iii) fix 1–6; (iv) verify each
live in BOTH the wizard AND the resulting listing/publish; (v) write `docs/lifecycles/onboarding.md`.
Test host `host@wielotest.com` is already onboarded — use a NEW throwaway host to see the wizard fresh.

## B. ✅ Seasonal pricing ↔ booking system — DONE + verified live 2026-07-12 (session #67).

No code change needed — seasonal already prices per-night through the SSOT engine `priceStay` on every
guest-facing charge path (checkout/createBooking, quotes, change-dates, both previews, site checkout).
Verified live: a Klein Cottage stay 26 Jun–02 Jul showed "1 season-priced night" (rooms subtotal R5 850 =
5×R1000 + 1×R850 winter −15%) + cleaning + VAT; real bookings BK-0037/BK-0036 froze 2/3 seasonal nights
server-side. Manual host bookings + specials deliberately bypass seasonal (documented). Flow recorded in
`docs/lifecycles/pricing-seasonal.md`. Original spec kept below.

## B(orig). 🔴 Seasonal pricing ↔ booking system (must work seamlessly). NOT STARTED.

Seasonal pricing must flow **through the whole booking system**, not just the rates UI: when a guest books
dates that fall in a seasonal period, the **server-side price recalculation** (the SSOT that ignores
client prices) must apply the **seasonal rate** for those nights — across checkout (`createBooking`/
`persist`), quotes, the `/pay` link, and any price preview — and combine correctly with the room's pricing
model (per-person/per-room, from Job A #2), cleaning fees, VAT, add-ons, and specials/coupons. Verify a
booking spanning in-season and out-of-season nights prices each night correctly. Record the flow in
`docs/lifecycles/pricing-seasonal.md` (or fold into `payments-ledger.md`/`booking.md`). Related memory:
`rates-blocks-default-live` (rates blocks default to live host rates).

> **Save point 2026-07-12:** Jobs A + B recorded here for a fresh session. Do them together (B is Job A's
> seasonal step + the booking-side wiring). Both need a `docs/lifecycles/*` flow per Principle #12.

---

## F. 🔴 Founder feature batch (2026-07-12) — larger features queued after the #68 quick-fix cluster.

The quick-fix cluster (invoice NaN · amenities batch-save · policy-picker green · listing "Things to know"
rework) shipped in #68. These four bigger features remain — each its own focused build + live verify.

### F1 — ✅ Flagged Listings — DONE + verified live 2026-07-12 (#70).
Shipped: the "Report this listing" button opens a modal (name/email/phone/reason/message) →
`reportListingAction` inserts into `listing_reports` + `notifyAdmins` → admin **Moderation → Flagged
Listings** (`/admin/flagged-listings`, `listings.moderate`) with tabs + status actions (audited). Migration
`20260712190000`. Original spec kept below.

### F1(orig) — Flagged Listings (report a listing → admin moderation)
- Replace the dead "Report this listing" button on `/property/[slug]` (page.tsx ~L1005) with a client modal
  (`FormModal`) + form: **name, email, phone, reason (preset dropdown), short message**.
- New table `listing_reports` (listing_id, reporter name/email/phone, reason, message, status
  open|reviewing|actioned|dismissed, created_at). Server action inserts + `notifyAdmins`
  (`lib/admin/notify.ts`) so admins get a follow-up notification.
- New admin page **Moderation → Flagged Listings** (next to Data Requests) listing reports with
  status + actions. Model on the existing admin moderation/data-request pages.

### F2 — ✅ Deleted accounts tab — DONE + verified live 2026-07-12.
Shipped: self-service **Delete account** now SOFT-deletes (was a hard purge) — sets `deleted_at`,
deactivates, bans the auth user (blocks sign-in), retains every row for a 30-day hold. Admin **Users →
Deleted** tab lists soft-deleted accounts (deletion date + days left in hold); the dossier shows
**Restore** (clears `deleted_at` + un-bans → fully recoverable) and **Delete forever** (manual hard purge,
DISABLED until the 30-day hold elapses — no cron, admin-only). Shared helper
`lib/users/accountLifecycle.ts` (soft-delete / restore / hard-purge) used by BOTH the self-service and admin
paths; the admin soft-delete no longer anonymises (retain-and-hide, so restore is clean). New audited
actions `user.restore` / `user.purge`. Lifecycle doc `docs/lifecycles/account-deletion.md`. Verified live:
soft-delete → Deleted tab → Restore round-trip (DB + auth ban + audit + UI). Original spec kept below.

### F2(orig) — Deleted accounts tab (self-deleted users, reinstate or 30-day purge)
- When a user deletes their account via Settings → soft-delete (set `deleted_at`, hide all data from them
  and the world). Add a **Deleted** tab in the admin Users section (next to Suspended) listing these users.
- Actions: **Reinstate** (clear deleted_at, restore visibility) OR **Delete completely** after 30 days
  (hard purge). Data is retained + hidden until then so reactivation restores everything. Founder decision
  (2026-07-12): the hard delete is a **manual admin-only** action after the hold — NO auto-purge cron.

### F3 — ✅ Vanishing-guest accounting — DONE + verified live 2026-07-12 (#69).
Shipped: `No-show` on a booking now force-forfeits — voids the invoice, writes off the outstanding, keeps
what was paid as revenue (NO refund/credit note), mints an immutable `FRF-####` Forfeit statement, notifies
the guest (`booking_forfeited_guest`). Ledger nets the booking to R0. Migration `20260712180000`; core
`lib/bookings/forfeit.ts`; flow in `docs/lifecycles/booking.md`. Original spec kept below for reference.

### F3(orig) — 🔴 Vanishing-guest accounting (partial-paid guest disappears).
Scenario: guest books, pays a deposit/part, then vanishes. Host cancels. TODAY the host-cancel path
auto-mints a **credit note** → the system says the host OWES the vanished guest — WRONG when policy = no
refund. Founder wants: (1) handle gracefully, (2) record in the ledger, (3) paper trail, (4) notify guest;
recorded on BOTH guest + host records; besides the active policies; with a way to FORCE-FORFEIT so the host
owes nothing.

**Proposed design (confirm before building):**
- New host action on the booking: **"Cancel — guest no-show / abandoned"** (distinct from a normal cancel).
  It runs the cancellation policy to compute the guest's refund entitlement, but adds a **"forfeit"** toggle
  that overrides entitlement to R0 (retain everything paid as the host's, per policy/liquidated damages).
- **Ledger entries (so the host sees exactly what happened):**
  1. **Reverse the OUTSTANDING (unpaid) balance** — a `write_off` row that zeroes what the host will never
     collect, so the guest no longer shows as owing and the host isn't shown a phantom receivable.
  2. **Retain the PAID amount as forfeited revenue** — NO credit note (host owes nothing); the deposit stays
     recognised as the host's (a `forfeiture` note doc, not a `wielo_credit_note` refund doc).
  3. Only when the policy DOES grant a partial refund (and the host chooses not to force-forfeit) is a
     credit note minted — for that refund amount only.
- **Paper trail:** a new document type (e.g. **Forfeiture / Cancellation statement**, `FRF-####` in the
  unified numbering) capturing: amount paid, amount forfeited, outstanding written off, policy applied,
  reason (no-show/abandoned), date. INSERT-only, immutable.
- **Notify guest:** email + guest-record entry: "Your booking was cancelled (no-show/abandoned); per the
  cancellation policy R{x} was retained and R{y} refunded (if any)." Tracked on the guest's history AND the
  host's records.
- Booking `payment_status` → a terminal state (e.g. `forfeited` / `written_off`); status → cancelled.
- **Founder decisions (2026-07-12):** (a) forfeited deposit = **REVENUE** (recognised as the host's income
  in ledger KPIs, not a neutral write-off); (b) **ASK EACH TIME** — do NOT default force-forfeit ON;
  (c) doc name = **"Forfeit statement"** (prefix `FRF-####`). Build accordingly + record the cancellation
  branch in `docs/lifecycles/booking.md`.

### F4 — ✅ Statement function — DONE + verified live 2026-07-12.
Shipped: a bank-style **Statement of account** — a running ledger (opening brought-forward → signed
charges/payments → closing carried-forward + VAT summary) between two parties. **Ephemeral by design**
(founder decision: like a bank download statement): it mints NO doc number and stores NO row — the shareable
link carries a signed HMAC payload (`lib/finance/statement-token.ts`) describing the slice, and the page
re-derives every figure live from the ledger. Two flavours, one engine (`lib/finance/statement.ts`):
**host → guest** (Finances tab → Statement) off `fetchHostTransactions`, and **Wielo → host** (admin Ledger
panel → Statement) off `fetchWieloLedger` (paid charges synthesised as charge+payment so it reads like a bank
statement while the closing == the ledger's outstanding). Shared `components/finance/StatementDialog.tsx`
(period presets + Open&download + Send). Hosted page `/statement/[token]` + PDF (`StatementDocument.tsx`).
Delivery: download + email + inbox. Doc `docs/lifecycles/statement.md`. Verified live: both flavours rendered
in web + PDF, running balance reconciles with the ledgers. Original spec kept below.

### F4(orig) — Statement function (host → guest; admin/Wielo → host)
- A "generate statement" action: the host creates a **statement for a guest** (a period/booking summary of
  charges, payments, refunds, balance) as a downloadable doc; reuse the SAME statement generator in admin so
  **Wielo can send a statement to a host**. Important for financials — pairs with the deep financial sweep
  (§1) and F3's paper trail. (Founder decision: bank-style ephemeral statement, mints no global doc number.)

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

**✅ ALSO DONE (session #63):**
- **G6** — **"Policies (as booked)" panel** live on host `dashboard/bookings/[id]` (Overview tab) AND
  guest `portal/trips/[id]`. Shared reader `lib/bookings/policiesAsBooked.ts` + component
  `components/bookings/PoliciesAsBooked.tsx`. Shows frozen cancellation schedule + check-in/out + house
  rules + T&C + accepted Wielo terms/privacy versions. Both ends verified live.
- **Guest money/refund parity** — the guest trip view now surfaces `refunded`/`partially_refunded` +
  "Refunded to you − R{n}" (was paid-in-full vs due only), matching the host. Verified live on BK-0027.

**⏳ REMAINING (Phase 2/3):**
- **G5 (P2)** — refund base = amount actually **paid**, not `total_amount`; fix `total_paid` label for
  deposit-only/partial bookings.
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
