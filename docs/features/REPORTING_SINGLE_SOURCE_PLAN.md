# Reporting — Single Source of Truth (admin / host / affiliate)

**Goal (founder):** one source of truth for every money number, with all other
"windows" a mirror of it, so you check one place and every surface shows the same
true value. Must be correct for **all users** — admins, hosts, affiliates — and
live-tested.

Trigger: a manual R50 charge showed as "collected" in one admin view but "nothing
collected" in the revenue ledger.

---

## The landscape — THREE money domains (each has its own ledger)

These are genuinely different flows of money and must NOT be merged. The fix is
**one canonical aggregator per domain**, and every window calls it.

| Domain | Money flow | Source of truth (table) | Canonical aggregator |
|---|---|---|---|
| **1. Platform revenue** | host → Wielo (subs, products, credits) | `platform_ledger` | `lib/billing/wielo-ledger.ts` (`fetchWieloLedger` + `wieloLedgerStats`) |
| **2. Booking money** | guest → host (bookings) | `payments`/`invoices`/`credit_notes`/`refund_requests`/`forfeit_statements`/`bookings` | `lib/finance/transactions.ts` (`fetchHostTransactions` + `txnStats`/`txnFlows`) |
| **3. Affiliate commission** | Wielo → affiliate | `affiliate_commissions` + `affiliate_payouts` | `lib/affiliate/balance.ts` (`getAffiliateBalance` / `summariseCommissions`) |

Good news: each domain ALREADY has a single read model that most windows use. The
problem is (a) one producer bug and (b) windows applying the aggregator
inconsistently or re-deriving the same number a second way.

---

## Root cause of the R50 bug (Domain 1)

1. **Producer bug:** the admin "Activate product" charge insert
   (`admin/users/[id]/actions.ts:1594`) omits `environment` → stored as the column
   default **`'live'`**. (Migration `20260616000020_transaction_environment.sql` sets
   the default.) The *correct* pattern already exists in `revenue/actions.ts:66-74`,
   which reads `platform_payment_settings.paystack_mode` and tags env — the activation
   path just forgot.
2. **Consumer inconsistency:** the revenue ledger page defaults its env filter to the
   platform's current Paystack mode (**`test`** right now) and hard-filters
   `environment='test'` at `wielo-ledger.ts:132`; the `'live'` R50 is dropped →
   "R0 collected". Meanwhile `/admin/reporting` defaults env `'live'` and DOES show it,
   and Customers / the user Finance tab apply no env filter and also show it. Same
   data, different totals per window — exactly the divergence to kill.

---

## Divergences found (to eliminate)

**Domain 1 (platform revenue):**
- D1a. Manual/activation charges mis-tagged `environment` (R50 bug — producer).
- D1b. Windows disagree on env scope (ledger = current mode, reporting = live, others = none).
- D1c. Admin "Paid to Wielo" computed two ways in the SAME file
  (`UserRecord.tsx` ~1569 "any positive completed row" vs ~1886 "charge-only").

**Domain 2 (booking money):**
- D2a. Host **"Collected"** differs: Payments board (`sumPaidFromRows`, includes
  `kind='credit'`, nets refunds) vs Ledger/Reports (`txnFlows`, excludes credit,
  refunds separate). Same label, two numbers.

**Domain 3 (affiliate):**
- D3a. "Paid out to date" = gross cleared-commission (`balance.paid`) vs payout history
  rows showing **net** (`affiliate_payouts.net_amount`) — don't reconcile with fees.
- D3b. Two "lifetime" numbers (overview `balance.lifetime` vs tier `earnings`).
- D3c. `thisMonthEarned` is an ad-hoc aggregate, not from `summariseCommissions`.
- D3d. Monthly statement (all non-voided) vs status-split balances.

Note: the affiliate accrual RPC keys off `product_id`/`plan`, NOT `subscription_id`,
so the R50's `subscription_id=NULL` does NOT break commission (verified).

---

## Proposed design

**Principle:** one canonical aggregator per domain; every window renders its numbers
from that aggregator. No window re-derives a total inline.

**Phase A — Domain 1 producer + env consistency (fixes the R50 symptom):**
1. Extract a shared `resolvePlatformEnvironment(service)` helper (reads
   `platform_payment_settings.paystack_mode`) and use it in EVERY manual
   `platform_ledger` insert (activation charge in `setUserProductAction`, the once-off
   `sellProduct` path, any other manual insert) so env always matches the platform mode.
2. Backfill the existing R50 row's env to match the current mode (`test`) so it shows now.
3. Make the env-filter DEFAULT identical across all Domain-1 windows (revenue ledger,
   reporting, PDF, customers, Finance tab) — see DECISION 1.

**Phase B — Domain 1 dedup:** make `UserRecord.tsx` "Paid to Wielo" use ONE helper
(charge-only, completed, env-consistent) in both places (D1c).

**Phase C — Domain 2:** pick one `collected` definition and have the Payments board,
Ledger, and Reports all read `txnStats`/`txnFlows` (D2a).

**Phase D — Domain 3:** label/derive consistently — payout "to date" = net (gross as a
sub-line), all "lifetime"/"this month" numbers from `summariseCommissions` (D3a–d).

**Phase E — Live verification** across all three audiences (admin revenue + user
record; host ledger/payments/reports/billing; affiliate overview/payouts) with DB proof.

---

## DECISIONS — CONFIRMED by founder (2026-08-05)

1. **Env scope:** ✅ **Current mode, everywhere.** Every Domain-1 window defaults its
   env filter to the platform's current `paystack_mode` (test now → all show test;
   auto-flips to live-only at launch). One shared helper serves both the write-tag AND
   the read-default so producer + consumer can never drift.
2. **Domains:** ✅ **Keep the 3 domains separate**, one canonical aggregator each; every
   window mirrors its aggregator.

## DECISIONS NEEDED (original)

**DECISION 1 — env scope (the core one).** What should the money windows show while
pre-launch (platform in test mode), and how consistently?
- **A (recommended):** every window defaults to the platform's CURRENT mode (test now →
  all windows show test data; auto-flips to live-only at launch). Consistent + you see
  your smoke-test data now.
- **B:** every window defaults to "all environments" (test + live combined) always.
- **C:** reporting is always live-only (test charges never count as revenue).

**DECISION 2 — domain separation.** Keep the 3 domains separate (recommended — booking
money is the host's, not Wielo's revenue; merging would be wrong), with one canonical
aggregator each? Or does "one place to check" mean a single combined money view?

Phases B–D fixes (which definition is canonical per divergence) I'll propose and apply
with clear labels unless you want to weigh in per item.
