# Recurring billing — lifecycle flow

> How a paid Wielo membership **actually recurs** — the hybrid engine added in the
> recurring-billing epic (phases 0–5). Complements `subscriptions.md` (which covers
> the state machine: guest tier → membership → pause → cancel); this doc is the
> **money over time** view: first charge, auto-renewal, mid-cycle upgrade proration,
> dunning, and drift reconcile, across **both rails**.
>
> **Architecture — HYBRID (founder-locked):**
> - **Paystack** = save the reusable card `authorization_code` from the first
>   charge; a **Wielo cron** re-charges it each cycle. ZAR stays source of truth.
> - **PayPal** = provider-**native** subscriptions (Catalog Product → Billing Plan →
>   Subscription) + the `/api/paypal-webhook` route; PayPal auto-charges + notifies.
>
> **Everything is gated OFF** behind `platform_payment_settings.paystack_recurring_
> enabled` / `paypal_recurring_enabled` (default false, read via
> `lib/billing/recurring.ts`, fails closed). While a rail is OFF, checkout falls back
> to today's state-only / one-time flow and **no scheduled charge can happen** — so
> the whole engine is dormant + safe until the founder flips a flag at go-live.
>
> Steps marked ⚠️ are **not yet verified live** (founder-driven at go-live, one rail
> at a time).

## Correctness invariants (from the architecture pressure-test)

- **R1** — Paystack `environment` is derived from the KEY that verified the webhook
  signature, never from event metadata (`paystack-webhook`), so a native renewal
  can't book test money as live.
- **R2** — the ZAR of record comes from the **charge**, never the current product
  price. Paystack: `amount/100` (already ZAR). PayPal: USD→ZAR at **charge-time** fx.
- **R3** — one `subscriptions` row per membership; the provider handle is rewritten
  in place on a swap. Only the writer that wins the ledger insert/flip extends the
  period (compare-and-set).
- **R4** — PayPal `ACTIVATED` + `SALE.COMPLETED` arrive in any order; both are
  idempotent (keyed by `paypal_subscription_id` / the PayPal sale id).
- **R5** — an upgrade charges the prorated **delta** + rebuilds the sub; never PayPal
  `revise`. (Paystack rail shipped; PayPal proration is a scoped follow-up.)
- **R6** — Wielo owns trials: a trial is state-only (`status='trialing'` +
  `trial_ends_at`, no provider sub / no saved auth). The provider handle is created
  at the **first real charge**, so "no real charge until X" holds.

---

## A · First paid charge → recurring armed

### Step A1 — Host buys a paid membership (checkout)
- Trigger: host confirms an upgrade/purchase · Actor: host
- Functions/files:
  `app/[locale]/dashboard/settings/subscription/actions.ts:switchToProductAction`
  → Paystack: `lib/billing/product-checkout.ts:startProductCheckoutDirect`
  → PayPal: `lib/billing/paypal-subscription.ts:startPayPalSubscriptionCheckout`
- Logic: rail chosen in the confirm dialog (`PlanPicker.tsx`). Paystack = one-time
  `initializeTransaction` (no plan code — the auth capture below makes it recurring).
  PayPal = ensure a Billing Plan (`ensurePayPalPlan`, versioned by ZAR amount, R2) →
  `createPayPalSubscription` (custom_id = `host|product|cycle`).
- DB writes: `platform_ledger` (pending charge, keyed by `provider_reference`) ·
  `product_orders` (Paystack) · `product_billing_plans` (PayPal, on first use).
- Next: → A2 (Paystack) / → B1 (PayPal).

### Step A2 — Paystack charge settles → capture the saved card (R3)
- Trigger: payer returns / `paystack-webhook` `charge.success` · Actor: system
- Functions/files: `supabase/functions/paystack-webhook/index.ts` (auth-code
  capture on subscription `charge.success`) · `product-checkout.ts:activateMappedPlan`
- Logic: on the FIRST subscription charge, encrypt + store the reusable
  `authorization_code` (+ card last4/brand/exp) on the sub; flip the ledger row
  pending→completed (compare-and-set) and extend the period.
- DB writes: `subscriptions.paystack_authorization_code_cipher` (AES-256-GCM,
  `PAYMENT_CIPHER_KEY`) · `paystack_card_last4/brand/exp` · `paystack_customer_code` ·
  `platform_ledger.status='completed'` · `current_period_start/end`.
- Side-effects: ledger(charge) · credits(`grantSubscriptionCredits`) · affiliate accrual.
- Next: → C1 (the renewal cron now owns this sub).
- ⚠️ the `paystack-webhook` edge fn carrying the R1 + capture changes is **not yet
  redeployed** — batched into go-live. Until then no auth code is captured, so the
  renewal cron is a safe no-op even if the flag were flipped.

---

## B · PayPal native subscription

### Step B1 — Payer approves → activate the row (R4, either order)
- Trigger: payer returns (`billing/return?subscription_id`) OR the
  `BILLING.SUBSCRIPTION.ACTIVATED` webhook · Actor: system
- Functions/files: `paypal-subscription.ts:activatePayPalSubscription` ·
  `app/api/paypal-webhook/route.ts`
- Logic: read the live PayPal sub, confirm `ACTIVE`, resolve host/product from
  custom_id, upsert the ONE membership row (R3). Idempotent — return page + webhook
  race safely. Does NOT record money (that's B2).
- DB writes: `subscriptions.paypal_subscription_id/paypal_plan_id` · status/period.
- Next: → B2 / → C2.

### Step B2 — PayPal auto-charges each cycle → record the money (R2)
- Trigger: `PAYMENT.SALE.COMPLETED` webhook · Actor: system(PayPal)
- Functions/files: `paypal-subscription.ts:recordPayPalSaleCompleted`
- Logic: idempotent on the PayPal **sale id** (`platform_ledger.provider_reference =
  pp_sale_{id}`, UNIQUE). ZAR = the USD charged, converted at charge-time fx (R2).
  Insert-wins → extend the period.
- DB writes: `platform_ledger`(charge) · `subscriptions` period · `subscription_history` ·
  credits · affiliate accrual.
- Next: → C2 (renews until cancelled) / → D on a failed charge.

---

## C · Auto-renewal

### Step C1 — Paystack renewal cron re-charges the saved card
- Trigger: `renew-subscriptions` pg_cron (daily 06:00) → `/api/subscription-renewal
  -worker` · Actor: system(cron)
- Functions/files: `lib/billing/subscription-renewal.ts:runPaystackRenewals` →
  `renewOne` · `lib/paystack.ts:chargeAuthorization`
- Logic: due = live status + saved auth + product-backed + within a day of lapsing.
  Claim `(sub, period, attempt)` via a UNIQUE `renew_{sub}_{ymd}_a{n}` ledger ref
  (idempotency latch) → charge the CURRENT ZAR price (R2) → settle. A null charge
  result (HTTP/parse failure) rolls the claim back and retries — NEVER a false decline.
- DB writes: `platform_ledger`(renewal) · `subscriptions` period · history · credits.
- Side-effects: `MAX_ATTEMPTS=4`; decline → Step D.
- Next: → C1 next cycle · ⚠️ not verified live.

### Step C2 — PayPal renews itself
- Same as B2 — PayPal drives the cycle; Wielo only records + extends. ⚠️ not verified live.

---

## D · Dunning (a renewal charge fails)

### Step D1 — Decline → past_due + grace + notify
- Trigger: Paystack decline (`renewOne`) / `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
  (`markPayPalPaymentFailed`) · Actor: system
- Logic: bump `failed_payment_count`; from active/trialing → `past_due` + a 5-day
  `grace_period_ends_at` (an already-past_due sub keeps its ORIGINAL deadline — a
  failing card can't perpetually reset grace). Notify host + admin (deduped per attempt).
- DB writes: `subscriptions.status='past_due'` · `grace_period_ends_at` ·
  `failed_payment_count` · history · `notify_subscription_event`.
- Next: recovery on a later successful charge → active; else the existing
  `restrict-overdue-subscriptions` cron restricts at grace end.

---

## E · Mid-cycle UPGRADE proration (Paystack rail, R5)

### Step E1 — Preview the delta (server-authoritative)
- Trigger: host clicks "Upgrade" on a paid plan · Actor: host
- Functions/files: `PlanPicker.tsx` → `actions.ts:previewUpgradeAction` →
  `lib/billing/upgrade.ts:getUpgradeQuote`
- Logic: `prorated` only when `paystack_recurring_enabled` + host on a paid plan +
  unused period + new>old. `amountNow = membershipSwitchAmount(new, old, periodStart,
  periodEnd)`; else the full new price (today's behaviour). The confirm dialog shows it.
- Next: → E2 on confirm.

### Step E2 — Charge the delta + rewrite in place (preserve the period)
- Trigger: host confirms · Actor: host → system
- Functions/files: `upgrade.ts:runProratedPaystackUpgrade`
- Logic: create the delta top-up order + Paystack checkout FIRST (so a failed order
  never leaves a host upgraded unpaid), THEN rewrite the ONE membership row to the new
  tier **preserving `current_period_start/end`** (R3 — the saved card carries; the
  renewal cron re-charges the NEW price at period_end). Grant the higher tier's credits
  for the current period; write a `plan_change` history row. Falls through to a normal
  full-price checkout when there's no unused period to prorate.
- DB writes: `subscriptions`(product_id/plan/cycle, period preserved) ·
  `product_orders`(amountOverride=delta, `activate_on_pay:false`) · `platform_ledger`(pending) ·
  `subscription_history`.
- Next: delta settles via the normal product-order settle (collect only). ⚠️ not verified live.
- PayPal rail: routes to a fresh native sub (full charge) — **PayPal proration is a
  scoped follow-up**; `cancelHostPayPalSubscription` is built but dormant until then.

---

## F · Drift reconcile (missed webhook / crashed worker)

### Step F1 — Hourly reconcile, both rails
- Trigger: `reconcile-subscriptions` pg_cron (hourly :20) → `/api/subscription
  -reconcile-worker` · Actor: system(cron)
- Functions/files: `lib/billing/subscription-reconcile.ts:runSubscriptionReconcile`
  → `subscription-renewal.ts:reconcilePaystackPendingRenewals` +
  `paypal-subscription.ts:reconcilePayPalSubscriptions`
- Logic:
  - **Paystack**: verify stuck `renew_…` claims (pending 15 min–3 days) against
    Paystack — `success` → extend (compare-and-set; recovers the charged-but-not-
    extended crash window); `failed/abandoned/reversed` → dunning; a transient verify
    failure LEAVES the claim (never deletes an unproven claim → no double-charge risk).
  - **PayPal**: cross-check live handle subs vs provider state — `ACTIVE` with a later
    next-billing → extend ACCESS only (money settles solely from the redelivered
    SALE.COMPLETED, R2/R4 — never fabricated); `CANCELLED/EXPIRED` → end (guarded to
    the matching id); `SUSPENDED` → left to the PAYMENT.FAILED dunning path.
- DB writes: as per the settle helpers each rail reuses (idempotent).
- Next: → C on the next cycle. ⚠️ not verified live.

---

## Go-live checklist (Phase 5 — founder-driven, ONE RAIL AT A TIME)

1. **Deploy** the `paystack-webhook` edge fn (carries the R1 + auth-capture changes —
   currently in git but NOT redeployed).
2. **PayPal:** register the `/api/paypal-webhook` URL in the PayPal app; set
   `PAYPAL_WEBHOOK_ID` in Vercel **and** Supabase edge secrets.
3. **Vault secrets** (SQL Editor, per env):
   `subscription_renewal_worker_url` → `…/api/subscription-renewal-worker`;
   `subscription_reconcile_worker_url` → `…/api/subscription-reconcile-worker`.
   (Both crons are Vault-gated + fail-soft until set — they show as red flags in
   `docs/SCHEMA.md` "Automated red flags" until then, by design.)
4. **Flip ONE flag** (`paystack_recurring_enabled` first) on the test host; watch the
   first live renewal extend the period + book the correct ZAR + environment before
   enabling for real hosts. Repeat for `paypal_recurring_enabled`.

## Files

| Concern | File |
|---|---|
| Gates (fail closed) | `lib/billing/recurring.ts` |
| Paystack renewal + reconcile | `lib/billing/subscription-renewal.ts` |
| Pure period/idempotency math (unit-tested) | `lib/billing/renewal-schedule.ts` |
| PayPal native subs + reconcile | `lib/billing/paypal-subscription.ts` |
| Upgrade proration | `lib/billing/upgrade.ts` · `proration.ts` (+ tests) |
| Reconcile orchestrator | `lib/billing/subscription-reconcile.ts` |
| Workers | `app/api/subscription-renewal-worker` · `app/api/subscription-reconcile-worker` |
| Webhooks | `supabase/functions/paystack-webhook` · `app/api/paypal-webhook` |
| Crons | `renew-subscriptions` · `reconcile-subscriptions` (migrations `202607200[24]0000`) |
