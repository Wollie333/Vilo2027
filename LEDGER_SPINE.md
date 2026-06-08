# The Ledger Spine — Vilo's financial foundation

> **Read this before touching anything money-related.** The ledger is the core
> of the app. Listings/rooms, bookings/add-ons, guests/CRM are all **layers on
> top** of it. Every layer ultimately writes transactions into this spine and
> must reconcile back to it. Goal: **enterprise-grade CRM booking management.**

---

## 1. The principle

There is **one financial source of truth**: the host's stream of transactions.
Every money view in the app is a *filtered read* of that one stream — never a
parallel calculation, never a second copy.

```
                    ┌─────────────────────────────────────────┐
   layers above ──▶ │  Listings / Rooms  →  pricing            │
                    │  Bookings / Add-ons →  create txns       │
                    │  Guests / CRM       →  read txns         │
                    └───────────────────┬─────────────────────┘
                                        │ writes / reads
                                        ▼
   THE SPINE  ───▶   lib/finance/transactions.ts → fetchHostTransactions()
                     (charges · payments · credit notes · refunds, normalised
                      into one Txn[] with a running per-guest balance)
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                                ▼
   /dashboard/ledger            guest Finances tab              booking Payments tab
   (account-wide)               (gkey-filtered)                 (bookingId-filtered)
        — all render with the ONE shared component: components/finance/LedgerList.tsx
```

If you find yourself computing a money total a second way, stop — read it from
the spine instead.

---

## 2. What already exists (the spine, hardened)

- **`lib/finance/transactions.ts`** — `fetchHostTransactions(admin, {hostId, gkey?, bookingId?, includePending?, includeVoided?})` is the single normaliser. `txnStats()` derives the KPIs. The `Txn` shape is the canonical row.
- **`components/finance/LedgerList.tsx`** — the one table component. Renders the rows, the "For" pill, the running balance, and the per-row ⋯ action menu (gated by `canManage`). Used by the account ledger, the guest Finances tab, and the booking Payments tab.
- **`components/finance/TxnActionModal.tsx`** — the one reusable modal for booking-level money actions: record payment · issue refund · give credit note · add a charge · **void**. Drives the existing server actions. **Use this on any page that needs these actions** — do not re-implement.
- **Per-listing VAT engine** — `listings.vat_number` + `vat_rate` (default 15%). `effective_vat_rate()` SQL fn + `apply_booking_vat` BEFORE INSERT trigger gross every booking up automatically (covers manual, quote-convert, enquiry, guest flow with zero app code). Add-ons VAT via `lib/finance/vat.ts → grossUpVat()`. Documents show "Tax Invoice" + VAT breakdown.
- **Void (audit-safe)** — `lib/finance/void.ts → voidTransaction()` is the ONE void path. Never deletes; stamps `voided_at/by/reason`, reverses per type, hides from the live ledger, surfaces under the "Voided" filter.
- **Money state** — `lib/payments/ledger.ts → recomputeBookingPaymentState()` recomputes `balance_due`/`payment_status` from the payment ledger (ignores voided). `recordBookingPayment()` is the entry point for taking money.

### Canonical server actions (don't bypass these)
| Action | Where |
|---|---|
| Record payment | `recordBookingPaymentAction` / `lib/payments/ledger.ts → recordBookingPayment` |
| Refund | `hostInitiatedRefundAction` (refunds/actions) |
| Credit note | `issueBookingCreditNoteAction` (bookings/[id]/payment-actions) |
| Apply store credit | `applyGuestCreditAction` |
| Add a charge / add-on | `addBookingAddonAction` + `lib/payments/invoicing.ts → createAddonInvoice` |
| Mark received | `markPaymentReceivedAction` |
| Void | `voidTransactionAction` → `lib/finance/void.ts → voidTransaction` |
| Send / email document | `sendDocumentLinkAction` / `emailDocumentToGuestAction` |

---

## 3. The wiring plan — how every layer connects to the spine

**Rule for future work: any money mutation must (a) go through a canonical
action above, (b) be recorded in the finance audit log, and (c) respect period
locks. It then automatically shows in the ledger because the ledger reads the
spine.**

### 3a. Listings / Rooms (pricing layer)
- Define price + VAT (`vat_number`, `vat_rate`) + add-on catalogue.
- They produce **no transactions directly** — they parameterise what bookings cost.

### 3b. Bookings / Add-ons (the layer that writes transactions)
- Booking insert → `apply_booking_vat` trigger sets the VAT-inclusive total → confirm trigger mints the booking invoice (a *charge*).
- Payments → `payments` rows (deposit/balance/addon/payment/credit).
- Add-ons → supplementary `invoices` (kind `addon`) + optional payment.
- Refunds → `refund_requests`. Credit notes → `credit_notes`.
- **All of these are exactly what `fetchHostTransactions` reads.** Nothing else needs to "tell" the ledger.

### 3c. Guests / CRM (read layer)
- Guest record Finances tab = `fetchHostTransactions({gkey})`. Store credit = `guest_credit_ledger`. Pure reads.

### 3d. Audit log  (point 1 — building now)
- New append-only `finance_audit_log` (host-scoped; `admin_audit_log` is super-admin only).
- `lib/finance/audit.ts → logFinanceEvent()` writes one row per money mutation: actor, action, txn/booking/entity, amount, reason, before/after snapshot.
- Wired into every canonical action above. Tamper-evident history for disputes / future SOC2.

### 3e. Period close  (point 2 — building now)
- New `accounting_periods` (per host, per month: open/closed + closed_by/at).
- `assertPeriodOpen(admin, hostId, date)` guard throws if a transaction's date falls in a closed month.
- Wired into the money mutations (and void). Closed months can't be edited — you post a reversing entry in the open period instead. Closing is reversible (reopen, audited).
- UI: "Close month" control on the ledger.

---

## 4. Invariants future agents must preserve

1. **One source of truth.** New money views read `fetchHostTransactions`; new money math lives in `lib/finance/*` once, not per-page.
2. **Never delete posted money.** Void (audit-safe), don't delete. Sequential document numbers stay gap-free (tax/VAT compliance).
3. **Every mutation is audited** (`logFinanceEvent`) and **period-checked** (`assertPeriodOpen`).
4. **VAT is per-listing and frozen per booking.** Don't recompute it from the current rate on historical docs.
5. **Reconcile up→down.** A booking's total, the invoice, the payments and the ledger must always agree. If they can drift, you've duplicated state — collapse it.

---

_Last updated: 2026-06-08 — spine hardened (one source, VAT, void); audit log +
period close in progress (§3d, §3e)._
