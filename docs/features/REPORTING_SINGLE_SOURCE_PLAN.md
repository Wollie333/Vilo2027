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

## PROGRESS (2026-08-05, session pt37)

**✅ Domain 1 (platform revenue, admin) — DONE + LIVE-VERIFIED.**
- `96926cc` — env consistency: `lib/billing/environment.ts` `resolvePlatformEnvironment()`
  is the single source for tagging manual ledger writes AND defaulting the env filter.
  Both admin charge paths (`setUserProductAction` activation + `sellProduct` once-off)
  now tag env; revenue ledger / reporting / customers all default to the current mode.
  The mis-tagged R50 was backfilled to `test` on the linked DB. Verified: R50 shows as
  Collected R50 identically across all three admin windows (Test = current mode).
- `570ca42` — MRR/ARR respect `locked_base_amount`: `lib/billing/mrr.ts` `lockedMonthlyMrr()`
  is the single rule, applied to the revenue-ledger MRR loop, the reporting MRR loop +
  plan mix, and the NRR cohort calc. Verified: MRR R50 / ARR R600 / ARPU R50 on both
  the revenue ledger and reporting (was R999) for the R50-locked host.
- `55123f7` — D1c: the admin user-record "Paid to Wielo" now uses ONE charge-only
  definition in both the detail panel and the Overview headline.

**✅ Domain 2 (host "Collected") — UNIFIED (code) — session pt38.** Founder confirmed
GROSS CASH (DECISION 3). The host Payments board KPI strip (`dashboard/payments/page.tsx`)
now derives **Collected** + **Refunds** from the ONE canonical aggregator
(`fetchHostTransactions` → `txnFlows`/`txnStats`) — the exact source the Ledger
(`txnStats.collected`) and Reports (`periodFlows.collected`) already use — so the number is
identical across all three host money windows by construction. `sumPaidFromRows` is now used
ONLY for per-booking settlement (balance_due / payment_status); confirmed no other reporting
total re-derives cash. The "settled payments" sub-count now counts cash-in entries so it
matches the money above it.
- **Live-verify: ✅ DONE (session pt38).** Seeded one demo booking (guest = registered guest,
  R1200 charge; R1000 cash EFT + R200 applied store credit; R300 completed partial refund) on a
  throwaway demo host (`gerku@gmail.com`; founder created the login — Claude can't) and viewed it
  in that host session. **Payments board: Collected R1000 · Refunds R300**, the R200 credit row
  present but excluded from Collected, "across 1 settled payment". **Ledger: Collected R1000 ·
  Refunded R300 · Net R700** — identical. Under the OLD code the Payments board would have shown
  Collected **R900** (netting the refund + counting the credit); now it matches the Ledger.
  Reports uses the same aggregator (code-verified) but is plan-gated on Free, so not screenshot.
  (Ledger OUTSTANDING showed R1200 not R500 — a cosmetic artifact of the seed inserting all four
  events at the same timestamp so the running-balance order ties; unrelated to Domain 2, real
  bookings have distinct timestamps.)
- **Incidental (pt38):** local dev threw `decryptSecret: PAYMENT_CIPHER_KEY is not set` on any
  billing read — the linked DB's platform Paystack/PayPal secrets are encrypted with the Vercel
  key, absent from `.env.local` (Vercel hides it, unrecoverable). Fix (founder-run, Claude is
  gated from credential ops): NULLed the encrypted `platform_payment_settings` secrets +
  generated a fresh local `PAYMENT_CIPHER_KEY`. Platform billing now reads "not configured"
  locally + on the shared DB until keys are re-entered — pre-launch/test, harmless. See
  [[demo-host-login]].

**✅ Domain 3 (affiliate) — UNIFIED (code) — session pt38.** Founder confirmed NET PAID
(DECISION 4).
- **D3a** `payouts/page.tsx`: "Paid out to date" headline = Σ `affiliate_payouts.net_amount`
  over paid payouts (what actually left), reconciling with the history table's Paid column;
  gross rides as a sub-line only when it differs from net.
- **D3c** `affiliates/page.tsx`: "this month earned" now = `summariseCommissions(monthSlice).lifetime`
  (true net, clawbacks subtract) instead of the old positive-only sum.
- **D3b** tier card relabelled "…cleared · counts to tier" so it isn't misread as total
  lifetime (which stays `balance.lifetime`).
- **Live-verify: RENDER-verified, DATA-not-demonstrable.** Both surfaces render cleanly on the
  founder's affiliate account (partner 24198, @wollie-steenkamp): payouts "Paid out to date"
  R0 · 0 payouts; overview Lifetime earned R0 · "across all time"; no console errors. This
  affiliate has ZERO commissions/payouts, so the net-vs-gross difference + a nonzero this-month
  can't be shown with real numbers — needs a funded affiliate (paid payout with a fee) to prove
  the numeric divergence is gone.

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

## DECISIONS — CONFIRMED (2026-08-05, session pt38) — Domain 2 & 3

**DECISION 3 — host "Collected" → ✅ GROSS CASH (`txnFlows`).** Canonical "Collected"
everywhere (Payments board headline, Ledger, Reports) = real cash received
(`CASH_KINDS` = deposit/balance/addon/payment), refunds shown as a SEPARATE line,
applied store credit NOT counted as collected. The Payments board headline changes to
mirror `txnStats`/`txnFlows`; `sumPaidFromRows` stays ONLY for per-booking settlement
(balance_due / payment_status). 

**DECISION 4 — affiliate "Paid out to date" → ✅ NET PAID.** Canonical headline =
`affiliate_payouts.net_amount` (what actually left after fees), reconciling with the
payout-history rows; gross cleared commission shown as a smaller sub-line. One
"lifetime earned" source (`balance.lifetime`); "this month earned" derived from
`summariseCommissions`, not the ad-hoc positive-only aggregate.

<details><summary>Original decision text (superseded by the above)</summary>

**DECISION 3 — host "Collected" (D2a).** The Payments board and the Ledger/Reports
show different "Collected" numbers because they mean different things:
- Payments board `sumPaidFromRows` (`lib/payments/ledger.ts`): Σ(amount − refunded) over
  inbound payment rows, INCLUDING `kind='credit'` (applied store credit). This is
  "amount settled against bookings" and also drives booking balance/payment_status.
- Ledger + Reports `txnFlows.collected` (`lib/finance/transactions.ts`, the documented
  canonical aggregator): gross cash for `CASH_KINDS=[deposit,balance,addon,payment]`
  (EXCLUDES credit), refunds kept as a SEPARATE line.
  → **Which is the canonical "Collected" the host sees?** Recommendation: make the
  Payments-board headline KPI mirror `txnStats`/`txnFlows` (gross cash, refunds
  separate) — the same the Ledger/Reports use — and keep `sumPaidFromRows` only for
  per-booking settlement. Needs founder confirm of the definition.

**DECISION 4 — affiliate figures (D3a–d).** Canonical source = `getAffiliateBalance` /
`summariseCommissions` (`lib/affiliate/balance.ts`). Proposed canonical labels:
- "Paid out to date" → **net** (`affiliate_payouts.net_amount`, what actually left),
  with gross commission as a sub-line (currently shows gross `balance.paid` beside net
  payout rows — D3a).
- Single "lifetime earned" = `balance.lifetime`; the tier card keep its own "cleared"
  basis but relabel so it's not read as total (D3b).
- "This month earned" derive from `summariseCommissions`, not the ad-hoc positive-only
  aggregate (D3c). Monthly statement definition reconciled with status-split (D3d).
  → Confirm the labels, then unify + live-verify in the affiliate portal.

</details>

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
