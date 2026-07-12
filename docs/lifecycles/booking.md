# Booking — lifecycle flow

> A real booking from discovery to confirmation, host↔guest. Steps marked ✅ were
> driven end-to-end on the live preview + cloud DB (test host `host@wielotest.com`,
> listing "Karoo Sky Guesthouse", VAT-registered 15%); steps marked 🚚 are shipped
> and DB-verified but not re-driven this pass. Money mechanics live in
> [`payments-ledger.md`](payments-ledger.md).

The ONE persistence tail every creation path funnels through is
`lib/bookings/persist.ts` → `persistBookingAndPay` (app checkout, website
checkout, deal page). Guest checkout entry: `app/[locale]/property/[slug]/book`.

---

### Step 1 — Guest builds + reserves the booking ✅
- Trigger: guest picks rooms/dates, fills details, taps **Reserve** (EFT) or **Pay** (card) · Actor: guest
- Functions/files: `property/[slug]/book/BookingForm.tsx` → `createCheckoutGuestAccountAction`
  (anon → inline guest account, auto-confirmed + signed in) → `createBookingAction` →
  `createBookingCore` → `persistBookingAndPay`.
- Logic: server re-validates availability + **re-prices** (never trusts the client). Host prices are
  ex-VAT; the guest is shown VAT-inclusive (room cards) with an itemised ex-VAT + `VAT (15%)` breakdown.
  `apply_booking_vat` grosses `total_amount`/`deposit_amount`/`balance_due` on insert.
- DB writes: `bookings` (status `pending_eft` for EFT, `pending` for card), `booking_rooms`,
  `payments` (a seeded **pending** placeholder for the expected amount).
- Side-effects: status(∅ → pending_eft/pending) · ledger(pending payment placeholder) ·
  guest account created.
- Verified: BK-0035/BK-0036 — checkout R2,400 + R120 + VAT R378 = **R2,898**, matches the trigger.
- Next: → Step 2 (host notify) + Step 3 (guest EFT email) + the card branch redirects to Paystack.

### Step 2 — Host is notified of the request ✅
- Trigger: booking persisted · Actor: system
- Functions/files: `lib/bookings/notifyHostNewBooking.ts` → `dispatchEvent({ kind: "booking_request_host" })`.
- DB writes: `notification_queue` (email) + push/in-app per the host's prefs.
- Side-effects: notification(`booking_request_host`, email+push+in-app) · host board shows "Awaiting EFT".
- Verified: queued for the host user + drained (`sent_at` set); board row "Awaiting EFT".
- Next: → Step 4 (host acts).

### Step 3 — Guest is emailed their EFT instructions ✅ (fixed CHANGELOG #59)
- Trigger: EFT booking persisted · Actor: system
- Functions/files: `lib/bookings/notifyGuestEftInstructions.ts` → `dispatchEvent({ kind: "eft_instructions_guest" })`
  (resolver `eftInstructionsResolver` hydrates host banking + reference from `booking_id`).
- Logic: fires only for `pending_eft` with a registered `guest_id`; no-op for card / anonymous leads.
- DB writes: `notification_queue` (email) + in-app.
- Side-effects: email(`eft_instructions_guest`) — bank details + booking reference so the guest can pay
  after leaving the success page.
- Next: → Step 4.

### Step 4 — Host confirms the money landed ✅
- Trigger: host sees the EFT in their bank, records it · Actor: host
- Functions/files: booking **Payments** tab → either the per-row **"Mark received"** on the placeholder
  (`markPaymentReceivedAction` — flips pending → completed in place) OR **"Record a payment"**
  (`recordBookingPaymentAction` — inserts a completed row, then voids the leftover pending EFT
  placeholder on full settlement so it doesn't orphan — CHANGELOG #60). Card/PayPal settle async via
  `paystack-webhook` / `capturePayPalOrderForBooking` instead.
- Logic: `recomputeBookingPaymentState` owns `balance_due` + `payment_status`; overpayment → `guest_credit_ledger`.
- DB writes: `payments` (completed; placeholder voided), `bookings.payment_status`/`balance_due`.
- Verified: BK-0035/BK-0036 — one clean completed payment, 100% collected, balance R0, no orphan.
- Next: → Step 5.

### Step 5 — Booking confirms → calendar + invoice ✅
- Trigger: first settlement on a still-pending booking · Actor: system
- Functions/files: `confirmBookingIfPending` (flips `pending_eft` → `confirmed`) → DB trigger
  `trigger_booking_confirmed` mints the invoice + inserts `blocked_dates`; `markBookingInvoicesPaidIfSettled`
  flips the invoice `issued → paid` when fully settled.
- DB writes: `bookings.status='confirmed', confirmed_at`; `invoices` (INSERT, paid); `blocked_dates` (INSERT).
- Side-effects: status(pending_eft → confirmed) · calendar(blocked_dates for each stay night; checkout day
  stays free) · invoice mint + paid.
- Verified: BK-0035 → INV-0063 paid, blocked 10–11 Dec (checkout 12 free).
- Next: → Step 6.

### Step 6 — Guest is told it's confirmed ✅
- Trigger: pending → confirmed transition · Actor: system
- Functions/files: settlement path enqueues `booking_confirmed_guest` (+ `_host`); resolver
  `bookingResolver` hydrates from `booking_id`.
- DB writes: `notification_queue`.
- Side-effects: email(`booking_confirmed_guest`) + in-app; guest sees the trip under `/portal/trips`.
- Verified: `booking_confirmed_guest` queued on settle.
- Next: → the stay tail.

### Step 7 — The stay tail 🚚 (shipped; DB-verified in #56/#57, not re-driven here)
- **Check-in reminder** to host AND guest the day before — `checkin-reminder-worker`
  (`check_in_reminder_host` / `_guest`).
- **Access card + stay-details email** at the host's configured lead before check-in
  (`property_access.send_lead_minutes`, default 60) — `send_due_access_cards()` posts the inbox card +
  enqueues `stay_details_guest` (gate/door/Wi-Fi).
- **Check-in → checkout → review request** — `review_request_queue` → `review-request-cron` →
  `review_request_guest` (see [`reviews.md`](reviews.md); post-checkout delay is a separate audit item).

### Messaging (parallel, any time) 🚚
- Guest↔host inbox thread is created **lazily** on the first message (guest "Message host" / host "Message"
  on the booking), tied to the booking. Not seeded at booking time by design.

---

## Guest-facing surfaces (parity — what the guest sees at each stage)
Shipped 2026-07-12 (CHANGELOG #64) so the guest sees the same booking/money state the host does:
- **Trips list** (`portal/trips/TripsClient.tsx`, `page.tsx` `derivePayState`): status pill corrected —
  a pending/EFT booking the guest still owes reads **"Payment needed"** (not "Awaiting host"); each card
  shows a payment chip (Paid / Balance / Pay now / Partially refunded / Refunded) and a Pay-now/Pay-balance
  action → `/booking/[id]/pay`.
- **Trip detail** (`portal/trips/[id]/page.tsx`): a **"Payment needed"** card (amount + "Get bank details &
  pay" for EFT) when money is owed; a **Trip timeline** (requested → payment received → confirmed → checked
  in/out → cancelled) from the booking timestamps + first captured payment; the receipt shows refunded
  state (see [`policy-refunds.md`](policy-refunds.md) Step 7). `owesMoney` excludes refunded states.
- **Overview "Up next"** (`portal/page.tsx`): styled status pill + "Complete your payment to confirm →"
  when owed. ⚠️ still filters `check_in >= today` (a past-due unpaid booking won't surface — open item).

## Branch summary
- **EFT**: Steps 1(pending_eft) → 3 (guest instructions) → 4 (host records) → 5/6. ✅ driven.
- **Card (Paystack)**: Step 1(pending) → redirect to Paystack → `paystack-webhook` settles → 5/6.
  ⚠️ webhook logic-verified, not driven with a live Paystack event (test host has no connected gateway).
- **PayPal**: same shape as card via `capturePayPalOrderForBooking`. ⚠️ not driven (no sandbox creds).
- **Host "send payment link"**: booking Payments tab → pay link (`/pay/<token>`) → guest pays → same settle path.
