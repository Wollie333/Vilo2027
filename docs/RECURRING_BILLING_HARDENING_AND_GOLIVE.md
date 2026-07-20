# Recurring Billing — Hardening + Go-Live Plan

> Compiled 2026-07-20 from a 4-way audit (affiliate, reporting, two-plane finance,
> booking regression) run after the recurring-subscription-billing epic. **No code
> changed yet** — this is the execution plan for the next session. Everything below
> is gated OFF-in-production semantics: both recurring flags are ON but in
> **test/sandbox** (no real money) until go-live. Read
> `docs/lifecycles/recurring-billing.md` first.

## Audit verdict (what's already correct — do NOT re-litigate)
- **No plane leakage.** Every recurring write hits `platform_ledger` + `subscriptions`
  (+ `subscription_history`, `product_orders`, `product_billing_plans`); zero writes
  to `payments`/`bookings`. Booking money (host→guest, host gateway, Wielo 0%) and
  Wielo revenue (user→Wielo, ZAR) never cross.
- **Booking system: no regression.** The shared Paystack webhook routes on
  `metadata.purpose`; booking charges set no purpose → booking branch, which never
  reads `environment` and never touches `platform_ledger`. The Phase-0
  `verifySignatureEnv` change tries the identical key set (accept/reject byte-identical);
  only the derived string is new, and bookings ignore it. New capture blocks are
  locked inside the product/subscription branches.
- **Affiliate scope correct** — accrual reads only `platform_ledger`, so booking
  revenue can never accrue a commission. No over-accrual / double-pay found on any new
  path (declines/cancels write no completed row; idempotent on `provider_reference`).
- **Reporting separation correct** — host booking report reads Plane A only; host
  billing history + admin Wielo revenue read Plane B only. Env tag derived from the
  verifying credential (R1); PayPal ZAR-of-record hardcoded (R2); no upgrade double-count.

## Cross-cutting insight
**Two findings share one root cause:** the renewal / upgrade-delta `platform_ledger`
inserts omit `product_id` (and a good label). Setting `product_id` (+ `reason`) on
those inserts fixes BOTH the affiliate resolution risk (RISK 2) AND the reporting
attribution/label gap (R-3) in one change. Do H1.2 once, bank both wins.

---

## Phase H1 — Financial correctness fixes (code)

### H1.1 — Force ZAR on the Paystack recurring ledger writes  *(Medium — MODEL-2)*
The Paystack renewal records `product.currency ?? "ZAR"` and charges/records that
currency. A Wielo product mispriced in a non-ZAR currency would charge that on the
ZAR platform Paystack account AND write a non-ZAR Plane-B row (violates "Wielo revenue
always ZAR"). PayPal path already hardcodes ZAR.
- `apps/web/lib/billing/subscription-renewal.ts` (~L144 `currency`, ~L191 ledger insert,
  ~L219 charge) → force `currency: "ZAR"` on the ledger insert; assert/convert if
  `product.currency !== 'ZAR'`.
- `supabase/functions/paystack-webhook/index.ts` renewal backstop insert (~L839/899,
  `event.data.currency ?? "ZAR"`) → same ZAR force.

### H1.2 — Set `product_id` (+ explicit label) on renewal & upgrade-delta ledger rows  *(fixes affiliate RISK 2 + reporting R-3 together)*
Renewal / `pp_sale` / delta rows omit `product_id`, so affiliate accrual falls back to
`products.slug = subscriptions.plan` — which silently drops the commission if any
membership product's `plan_key != slug`. Same omission leaves the delta row labeled
"Product purchase" with no plan in reports.
- `apps/web/lib/billing/subscription-renewal.ts` renewal insert (~L181–197) → add
  `product_id: sub.product_id` (already in scope).
- `apps/web/lib/billing/paypal-subscription.ts` `recordPayPalSaleCompleted` insert
  (~L609–629) → add `product_id: sub?.product_id ?? null`.
- `supabase/functions/paystack-webhook/index.ts` Deno renewal insert (~L843–860) →
  add `product_id`.
- Upgrade delta: thread an explicit `reason`/label through `createProductOrder`
  (`apps/web/lib/billing/product-checkout.ts` ~L770–783 seeds the ledger with
  `reason:"Product purchase"`) so the delta row reads e.g. **"Upgrade to Starter
  (prorated)"** and carries the product. `upgrade.ts` already passes a `label` to the
  order — extend it to the ledger `reason`.

### H1.3 — Re-link orphaned `pp_sale_*` rows  *(Low/Med)*
`recordPayPalSaleCompleted` records money with `user_id/host_id/subscription_id = null`
when a sale arrives before ACTIVATED and the comment says "reconcile links it later" —
but `reconcilePayPalSubscriptions` only extends/ends subs, it never re-attaches the
orphan row. Such a row counts in the admin ZAR total but is invisible in the host's
billing history forever.
- Add a sweep (in `subscription-reconcile.ts` / `reconcilePayPalSubscriptions`, or the
  ACTIVATED handler) that finds unattributed `pp_sale_*` ledger rows for a now-known
  `paypal_subscription_id` and back-fills `user_id/host_id/subscription_id/plan`.

### H1.4 — Distinguish the PayPal setup-fee (delta) row label  *(Low, cosmetic)*
The PayPal upgrade delta flows through `recordPayPalSaleCompleted` so it's labeled
"Subscription renewal (PayPal)". Correct money, wrong word. Optionally pass a flag so
the setup-fee sale reads "Upgrade (prorated)".

---

## Phase H2 — Affiliate policy on upgrade deltas  *(DECISION NEEDED before coding)*

**RISK 1 (highest money risk = UNDER-pay).** A prorated upgrade delta currently accrues
`kind='subscription'` and **consumes a duration slot**. For a capped affiliate
(`duration='once'` or `months=N`) the tiny delta burns the slot and the subsequent full
first charge is blocked → affiliate earns on the delta instead of the full charge.
`forever` is unaffected. Never over-pays.

**Decision for the founder:** should a prorated upgrade delta earn affiliate commission
at all, and if so should it be **exempt from the once/months duration counter**?
- **Recommended default:** the delta earns commission but does NOT consume a
  `subscription` slot — accrue it under a distinct `kind` (e.g. `upgrade`) or
  `billing_period` the `once`/`months` counter ignores. Apply to `upgrade.ts` (Paystack)
  and the PayPal setup-fee sale.
- **RISK 3 (confirm):** the delta accrues at the *recurring* rate, not the product's
  `setup_fee_affiliate_*` rate. Likely intended (a top-up isn't a catalog setup fee) —
  confirm.

Affiliate RPC of record: `supabase/migrations/20260711120000_affiliate_tiers.sql`
(`accrue_affiliate_commission`, duration counter ~L114–123).

---

## Phase H3 — Unify the reporting permission (two keys → one)

Today there are two feature keys: `analytics_basic` (the **only** live gate, on
`/dashboard/reports`) and `analytics_advanced` (**gates nothing** — dead). Collapse to
one `reporting` key. Pre-MVP (no real users) → destructive reshape is fine.
- **New migration** `supabase/migrations/2026072X_unify_reporting_feature.sql`:
  ```sql
  UPDATE plan_features          SET feature_key='reporting' WHERE feature_key='analytics_basic';
  UPDATE product_features       SET feature_key='reporting' WHERE feature_key='analytics_basic';
  UPDATE host_feature_overrides SET feature_key='reporting' WHERE feature_key='analytics_basic';
  DELETE FROM plan_features          WHERE feature_key='analytics_advanced';
  DELETE FROM product_features       WHERE feature_key='analytics_advanced';
  DELETE FROM host_feature_overrides WHERE feature_key='analytics_advanced';
  ```
  (Tolerate the UNIQUE `(plan|product_id, feature_key)` constraints — delete-then-update
  or `ON CONFLICT`.)
- `apps/web/lib/products/features.ts` (~L84–85) → delete `analytics_advanced`; rename
  `analytics_basic` → `{ key:"reporting", label:"Reporting", ... }`.
- `apps/web/app/[locale]/dashboard/reports/page.tsx` (~L90) → `p_feature_key: "reporting"`.
- `apps/web/scripts/seed-single-host.mjs` (~L177) → `"reporting"`.
- Admin editor needs no component change (it renders from the catalog array).
- Regen `docs/SCHEMA.md`; run `scripts/audit-wiring.mjs` (confirm `reporting` has a live
  caller, no dead `analytics_*`). Update prose refs (`vilo-platform-mvp.md`,
  `HOST_DASHBOARD_CHECKLIST.md`).

---

## Phase H4 — Verifications (RUN before flipping any rail LIVE)

1. **SQL:** every membership/service product has `slug == plan_key` (else renewal
   commissions silently drop until H1.2 lands). `SELECT id,slug,plan_key,product_type
   FROM products WHERE product_type IN ('membership','service') AND coalesce(plan_key,slug) <> slug;`
2. **Clawback:** confirm the subscription refund/cancel-refund path writes a
   `platform_ledger` row `type IN ('refund','credit')` with `reverses_ledger_id` set to
   the renewal/`pp_sale` charge — the only trigger for recurring-charge clawback. If it
   doesn't, commission over-pays on a renewal refund.
3. **Sandbox round-trips (rails already ON in test):** run a REFERRED host through
   (i) Paystack renewal, (ii) PayPal renewal, (iii) Paystack prorated upgrade, (iv)
   PayPal upgrade. Assert per real charge: exactly one correctly-based
   `affiliate_commissions` accrual, correct `billing_period` sequencing, the ledger row
   in admin revenue (test env) + host billing history, and NOT in the host booking report.
4. **Env isolation:** `platform_payment_settings.paystack_mode` and PayPal `creds.env`
   agree during beta so test renewals never tag `live`.
5. **(Doc, optional)** Fix `docs/lifecycles/booking.md:142` — Model-2 card bookings
   settle via the return page + `booking-reconcile-worker`, not the webhook.

---

## Go-Live runbook (founder, step by step)

**State right now:** both recurring flags ON (test/sandbox); Vault has
`subscription_renewal_worker_url` + `subscription_reconcile_worker_url`;
`paystack-webhook` redeployed to **v15** (saved-card capture, incl. the prorated-delta
fix); production endpoints live + fail-closed (renewal/reconcile 401, paypal-webhook
401). Test host **Wollie** is currently on **Starter** (grant-then-collect) with an
**unpaid R513.79 delta** order pending.

**Step 1 — Finish the Paystack proof (test card).**
Open `https://wielo.co.za/pay/product/750853d1bfa843d29c5f66f623623f8b` (R513.79) and pay
with the Paystack **TEST** card **4084 0840 8408 4081**, any future expiry, CVV **408**,
OTP **123456**. Then confirm the card saved:
```sql
SELECT plan,status,(paystack_authorization_code_cipher IS NOT NULL) AS has_saved_card,
       paystack_card_last4
FROM subscriptions s JOIN hosts h ON h.id=s.host_id JOIN user_profiles u ON u.id=h.user_id
WHERE u.email='wollie@manamarketing.co.za' AND s.status='active';
```
`has_saved_card` should flip **true**. To prove renewal now instead of waiting for the
06:00 cron, set that sub's `current_period_end` to the past, then the `renew-subscriptions`
cron (or a worker POST) re-charges the saved test card and extends the period + books a
`renew_*` completed ledger row.

**Step 2 — PayPal webhook (only you have the dashboard).**
In the **sandbox** PayPal app, add a webhook: URL `https://wielo.co.za/api/paypal-webhook`,
events `BILLING.SUBSCRIPTION.ACTIVATED/CANCELLED/SUSPENDED/EXPIRED`,
`BILLING.SUBSCRIPTION.PAYMENT.FAILED`, `PAYMENT.SALE.COMPLETED`. Copy the **Webhook ID**
into Vercel as `PAYPAL_WEBHOOK_ID` and redeploy. Then a PayPal upgrade/renewal settles
end-to-end.

**Step 3 — Go LIVE (after H1–H4 are green + Steps 1–2 verified).**
Swap Paystack to its **live** secret key and PayPal env to **live** (flags already on).
Watch the FIRST live renewal on the test host extend the period + book the correct ZAR +
`environment='live'` before enabling for real hosts. One rail at a time.

---

## Suggested execution order for the next session
1. H1.1 + H1.2 (+ H1.4) — small, high-value, unblock affiliate + reporting accuracy.
2. H2 decision → implement the chosen delta-commission treatment.
3. H1.3 orphan re-link.
4. H3 reporting unification (migration + edits + regen docs).
5. H4 verifications (SQL + sandbox round-trips).
6. Then the founder runs the Go-Live runbook.
Green gates each step: `cd apps/web && pnpm build && pnpm lint`; `supabase db push --linked`
+ regen types/SCHEMA after migrations; redeploy `paystack-webhook` after any webhook edit.
