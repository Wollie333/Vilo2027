# Payments & ledger — lifecycle flow

> How money moves on a booking: what it's charged, how VAT is added, how each
> payment reconciles against the total, and when invoices/receipts flip to paid.
> Single source of truth for the maths is **`apps/web/lib/payments/ledger.ts`**.
> Every settlement path (manual EFT, host card-return, Paystack webhook, PayPal
> capture) must produce the **same** booking money state — that parity is the
> whole point of this doc.

Conventions: currency stored in full Rand units. `amount` always has a `currency`
beside it. "Paid" = sum of **completed, non-voided, inbound** payment rows
(`INBOUND_KINDS` = deposit · balance · addon · payment · credit — `ledger.ts`).

---

## The money columns on a booking

| Column | Meaning | Who owns it |
|---|---|---|
| `base_amount` | ex-VAT nightly/line subtotal (host-entered) | caller at INSERT |
| `total_amount` | **VAT-inclusive** grand total the guest pays | `apply_booking_vat` trigger |
| `vat_rate` / `vat_amount` | VAT applied (0 unless listing is VAT-registered) | `apply_booking_vat` trigger |
| `deposit_amount` | VAT-inclusive deposit installment | `apply_booking_vat` trigger |
| `balance_due` | still owed; floored at 0 | ledger recompute / settlement paths |
| `payment_status` | pending → partial → completed (+ terminal: refunded/voided/failed) | settlement paths |

---

### Step 1 — VAT is added "at the end" (every money column) ✅ verified
- Trigger: BEFORE INSERT/UPDATE on `bookings` · Actor: system
- Functions/files: `apply_booking_vat()` (migration `20260712130000_vat_gross_deposit_and_balance.sql`,
  supersedes the earlier total-only version); rate via `effective_vat_rate(property_id)`.
- Logic: host prices are **ex-VAT**. If the listing is VAT-registered (`vat_number`
  set, `vat_rate > 0`) and `vat_amount`/`vat_rate` weren't already set upstream
  (idempotency guard), gross **all three** money columns by the same rate:
  `total += round(total·rate/100)`, `deposit_amount ×= factor`, `balance_due ×= factor`.
  Non-VAT listings (rate 0) are a no-op.
- DB writes: `bookings.total_amount, vat_amount, vat_rate, deposit_amount, balance_due`.
- Why it matters: before this, only `total_amount` was grossed, so a deposit-first
  booking on a VAT listing showed the guest an ex-VAT "balance due" and a deposit
  installment 15% light until a later recompute healed it.
- Verified: DB insert on the VAT-registered test listing (rate 15%) — ex-VAT
  `1000 / dep 300 / bal 700` → grossed `total 1150 / vat 150 / dep 345 / bal 805`
  (345 + 805 = 1150, reconciles). See CHANGELOG #58.
- Next: → Step 2 (guest-facing display) and Step 4 (settlement).

### Step 2 — Guest sees the VAT-inclusive price everywhere ✅ verified
- Trigger: guest opens a quote / booking summary · Actor: guest
- Functions/files: display helpers `lib/pricing/vat.ts` (`effectiveVatRate`,
  `grossVat`, `vatOf`); public quote page `app/[locale]/q/[id]/[token]/page.tsx`;
  quote PDF `app/[locale]/q/[id]/[token]/pdf/route.ts` + `lib/pdf/QuoteDocument.tsx`.
- Logic: a **quote** stores the ex-VAT total; VAT is added only when it converts to
  a booking. So the public quote + PDF compute the same gross for display: show a
  `Subtotal` + `VAT (15%)` line and a `Total (incl. VAT)` grand total, so what the
  guest agrees to == what they'll be charged. Non-VAT listings render exactly as before.
- DB writes: none (display only).
- Verified: live quote on the VAT test listing rendered Subtotal R1,000 · VAT (15%)
  R150 · Total (incl. VAT) R1,150 in **both** the HTML page and the generated PDF.
- Next: → Step 3 (accept/convert).

### Step 3 — Quote → booking seeds the deposit ledger entry ✅ verified (path)
- Trigger: guest accepts a quote · Actor: guest
- Functions/files: `lib/quotes/accept-convert.ts` → `acceptAndConvertQuote`.
- Logic: insert the booking from the quote (status `pending`), read back the
  **DB** `deposit_amount` (already grossed by Step 1), and seed the first
  `payments` row (`kind='deposit'`, `status='pending'`) for that grossed amount —
  so a VAT-registered listing's deposit installment is VAT-inclusive and matches
  what the guest pays. `reserve` quotes (deposit 0) seed nothing.
- DB writes: `bookings` (INSERT), `payments` (deposit, pending).
- Side-effects: status(none → pending). Ledger seeded.
- Next: → Step 4.

### Step 4 — A payment settles (any channel) → recompute money state
- Trigger: manual EFT "mark received" · host card-return · Paystack webhook ·
  PayPal capture · Actor: host / system(webhook)
- Functions/files:
  - manual EFT + card-return + PayPal: `lib/payments/ledger.ts`
    (`recomputeBookingPaymentState`, `sumCompletedPaid`) + `markBookingInvoicesPaidIfSettled`,
    called from `lib/payments/pay-booking.ts` (`confirmHostCardPaymentByReference`,
    `capturePayPalOrderForBooking`).
  - card (Paystack) async: `supabase/functions/paystack-webhook/index.ts`.
  - manual booking recorded-as-paid: `app/[locale]/dashboard/bookings/new/actions.ts`
    (`recordBookingPayment` against the **DB** post-VAT `total_amount`).
- Logic (identical across channels): paid = Σ completed inbound rows;
  `balance_due = max(0, total − paid)`; `payment_status = completed` if `paid ≥ total`
  else `partial`. **Never** clobber a terminal money state (refunded / partially_refunded
  / voided / failed) — the refund flow owns those. Overpayment floors the balance at 0
  and posts the excess to `guest_credit_ledger` (per-host store credit).
- DB writes: `bookings.balance_due, payment_status`; `payments` (settled row);
  possibly `guest_credit_ledger` (overpay).
- Webhook specifics (`paystack-webhook`, fixed CHANGELOG #58): the money-state update
  runs for **every** settlement — including a balance payment that lands on an
  already-**confirmed** booking (guest didn't return to the pay page). It was gated on
  `status='pending'`, which left such a booking stuck at `partial` with a stale balance.
  The pending→confirmed flip (Step 5) keeps its `status='pending'` guard, so it fires
  exactly once and confirmation emails never re-send. ⚠️ logic-verified (mirrors
  `recomputeBookingPaymentState`); not driven with a live Paystack event.
- Next: → Step 5 (first confirmation) and Step 6 (invoice flip).

### Step 5 — First full/deposit payment confirms the booking
- Trigger: the settling payment transitions the booking · Actor: system
- Functions/files: settlement path flips `status pending → confirmed`; DB trigger
  `trigger_booking_confirmed` (`20260501000013_create_triggers.sql`).
- Logic: only a `status='pending'` row transitions (idempotency guard). On confirm the
  trigger **mints the booking invoice** and **blocks the calendar** (`blocked_dates`).
  Because Step 4 set `payment_status` first, a paid-in-full booking's invoice is minted
  already-`paid`.
- DB writes: `bookings.status, confirmed_at`; `invoices` (INSERT); `blocked_dates` (INSERT).
- Side-effects: calendar(blocked_dates) · invoice mint · email(booking_confirmed_guest /
  _host, enqueued to `notification_queue`, gated on the transition) · status(pending → confirmed).
- Next: → Step 6.

### Step 6 — Deposit-first booking's balance lands → invoice flips paid
- Trigger: the balance payment settles (any channel) · Actor: host / system
- Functions/files: `markBookingInvoicesPaidIfSettled` (`ledger.ts`) on the EFT / card /
  PayPal paths; inline `invoices` update in `paystack-webhook`.
- Logic: once `paid ≥ total`, flip every still-`issued` invoice for the booking to
  `paid` (`paid_at` stamped). The confirm trigger only marks the invoice paid when the
  booking was paid **in full up front**; a deposit-first booking whose balance arrives
  later would otherwise leave an `issued` invoice. All four settlement paths now do this
  (parity — CHANGELOG #58).
- DB writes: `invoices.status='paid', paid_at`.
- Next: → refund / credit-note flows (separate accounting events; not covered here).

---

## Deposits, partial payments & receipts ✅ verified

A booking may be settled in installments — a **deposit** up front, then the **balance**. This is
driven by the host recording each receipt, and it must stay clean at every stage.

- **Seeded placeholder.** An EFT reserve (or a deposit-quote convert) seeds ONE `pending` payment for
  the expected transfer (`method='eft'`; `kind='payment'` for a full EFT, `kind='deposit'` for a quote
  deposit). It's a UI hint ("Awaiting EFT"), never real money — `sumCompletedPaid` ignores it.
- **Recording reconciles it.** Two settle paths: the per-row **"Mark received"**
  (`markPaymentReceivedAction`) flips the placeholder in place → completed; **"Record a payment"**
  (`recordBookingPaymentAction`) inserts a fresh completed row AND voids any leftover seeded pending
  placeholder — on partial OR full (CHANGELOG #60) — so no stale "awaiting" row ever orphans beside the
  real receipts. From then on `balance_due` is the single source of truth for what's still owed.
- **Each payment is its own receipt.** The `trg_assign_receipt_number` trigger fires
  `BEFORE INSERT OR UPDATE … WHEN status='completed'`, so the deposit AND the balance each get their own
  **RPT-####** — whether recorded (insert) or marked-received (update). Verified: deposit RPT-0019 +
  balance RPT-0020 on the same booking.
- **State transitions.** `payment_status`: pending → **partial** (deposit paid, balance > 0) →
  **completed**; `balance_due` = `total − Σ completed inbound`, floored at 0. The FIRST completed payment
  (any amount) **confirms** the booking (a deposit secures it) → invoice minted, calendar blocked;
  `markBookingInvoicesPaidIfSettled` flips the invoice paid only once fully settled.
- **Deposit is VAT-inclusive.** `apply_booking_vat` grosses `deposit_amount` too (Step 1), so the
  guest's "Deposit due now" == the deposit installment they actually pay. Verified: net 3000/1000 →
  gross total 3450 / deposit 1150; guest pay page shows Deposit R1,150 · Balance R2,300 · Total R3,450.
- **Surfaces.** Guest **pay page** (`/pay/[token]`) offers "Pay deposit / Pay in full" (wired to the
  `startBookingPayment` `amount:"deposit"|"full"` engine) + the deposit/balance breakdown; host
  **Payments tab** shows a "Deposit due → Deposit ✓ Paid" stat + a receipt per payment row.

## Invariants (cross-checks for the deep financial sweep)

- `deposit_amount + balance_due == total_amount` at INSERT on a VAT listing (rounding
  to the cent). VAT: `net → vat = round(net·rate/100) → gross = net + vat`; charge ==
  shown == invoice total.
- Σ(completed inbound payments) == `total − balance_due` (== `total` when completed).
- One invoice per booking transition; no duplicate `blocked_dates` (trigger owns them,
  webhook does **not** re-insert — AGENT_RULES §4.2).
- Refund and credit note are **separate** events — a refund does **not** auto-mint a
  credit note (migration `20260607000004`).

## Known-not-yet-driven-live
- Paystack webhook money-state + invoice-flip changes are logic-verified only (no live
  Paystack settlement event driven). Redeploy `paystack-webhook` before relying on it in
  production (listed in `NEXT_STEPS.md` ops config).
