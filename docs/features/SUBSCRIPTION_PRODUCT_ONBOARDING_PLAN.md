# Subscription → Product Onboarding + Admin Overrides — PLAN

> Status: **PLAN — awaiting founder confirmation before build.** (2026-08-05, pt32 follow-on.)
> This is money + access-control. Read it, mark decisions, then we build.

## The founder's ask (verbatim intent)

> "Signup mints a FREE user (correct). Then the user selects a subscription → after a SUCCESSFUL
> subscription (free OR paid), UPGRADE that user to that product AND show it in the admin user record.
> I also want to MANUALLY upgrade a user to any account as super admin, and OVERRIDE price rules — full
> management of that user. Get the onboarding sequence correct so the data/reports/LEDGER/finances work,
> and PERMISSIONS are automatically set via the product's assigned feature-permissions + pricing."

Plus (pt32 loose-thread clarification): **adding a team member mints that account on Wielo**; the invitee
**completes registration → gets their staff account AND a free Wielo guest account automatically.**

---

## Headline finding — most of this already exists

The end-to-end investigation (4 parallel audits: signup/checkout, product/permission model, ledger,
admin controls) found the machinery is **mostly built and mostly correct**. This is a **gap-closing +
reconciliation** job, not a from-scratch build. Concretely:

| Founder requirement | State today | Work needed |
|---|---|---|
| 1. Post-checkout → account upgraded to product, visible in admin | **Mostly DONE** | Close native-rail webhook gap; verify admin display |
| 2. Feature permissions auto-resolve from the product | **DONE mechanically** (product_features tier is authoritative) | Make EVERY product's assigned features flow to `product_features` (only 3 products seeded today) |
| 3. Super-admin: upgrade to any product | **DONE** (`setUserProductAction` + Products tab) | none |
| 3b. Super-admin: override price rules per user | **GAP** | Build arbitrary per-user price override |
| 4. Ledger/finances/reports reflect the upgrade | **DONE for self-serve paid**; gaps for comp/free & reconciliation | Post comp ledger rows; add reconciliation audit; link `subscription_id` |
| 5. Invite mints account → staff + free guest on accept | **GAP** (no register-as-staff path) | Build invite provisioning |

---

## How it works today (the map)

### A. Signup & checkout
- Signup mints a FREE user correctly: `user_profiles.role` guest → host at `finalizeOnboardingAction`
  (`signup/host/actions.ts:356`); baseline `subscriptions` row `plan='free'`, `product_id=null`
  (`:588-611`). "Buy-first" flow links a paid `product_orders` token at finalize ("3b", `:489-529`).
- **The product-order rail is solid.** Every settle path — Paystack (`confirmProductOrderByReference`),
  PayPal (`capturePayPalProductOrder`), EFT (`markProductOrderEftReceived`, admin-gated by design), and
  free (`fulfilFreeProductBySlug`) — calls `activateMappedPlan` + `applyPaidUpgrade`, which write
  `subscriptions.product_id` + `plan`. Dual settle (return-page primary + webhook backstop) with
  compare-and-set guards. **After a successful product purchase, the account IS upgraded.**
- **The weak rail: native subscriptions** (dashboard plan picker → `startSubscriptionCheckout`).
  Its return page does NOT activate — it relies **solely on the Paystack webhook**
  (`processSubscriptionEvent`), and that webhook has historically failed to fire. No return-page fallback.

### B. Product → permission model
- `check_feature_permission` resolves in order: `host_feature_overrides` → **`product_features` via
  `subscription.product_id`** (authoritative) → `plan_features` via `subscription.plan` → free floor →
  default-disabled. So "permissions auto-resolve from the product" = **set `subscription.product_id` +
  seed `product_features` rows** — exactly what activation already does.
- **Catch:** a feature is only granted if a `product_features(product_id, feature_key, is_enabled=true)`
  row EXISTS. Today only 3 products (Founder/Starter/Beta) have those rows seeded (Aug-2 migration). Any
  OTHER product an admin creates grants **nothing** beyond the free floor.
- `PRE_MVP_FEATURES_OPEN = false` (enforcing). Free plan is fully open; paid tiers are real.
- Gotchas: `product_features.is_enabled` defaults **true**; `products.plan_key` has **no FK** (a typo
  silently drops the plan-tier fallback); a `paused`/`cancelled` sub drops to the free floor.

### C. Ledger / finances
- `platform_ledger` is the hub. A completed `charge` row auto-mints a `wielo_invoices` row via DB
  trigger (same transaction). `subscriptions` is written by the settle path independently.
- **Self-serve paid purchase: all four agree** (ledger → invoice → subscription → history), idempotent.
- **Gaps:**
  1. **Admin comp / free activation posts NO ledger row.** `setUserProductAction` with `charge='free'|'none'`
     writes an active, priced subscription but no `platform_ledger` entry → the founder report counts it
     as **MRR but shows R0 collected**. The two report halves diverge.
  2. **Report is accrual-vs-cash by design** — MRR = `subscriptions × products.price`; collected =
     `platform_ledger`. Nothing reconciles them; no query asserts "every active priced sub has matching
     ledger charges."
  3. **`subscription_id` is NULL on the product-order ledger path** (only the native rail sets it) — the
     ledger↔subscription link is indirect (via host/user/product).

### D. Admin user-record controls (`admin/users/[id]`)
- **Already very rich.** `setUserProductAction` + the Products tab catalog do manual upgrade/downgrade to
  ANY product with proration, guest→host provisioning, ledger posting, scheduling, and charge/pay-link/free
  modes. Full subscription management (status, cancel with refund/credit-note, scheduled changes, founding
  lock) and full account management (role, suspend, delete/restore/purge, password, email-confirm) exist.
  Finance tab can post payment/refund/credit/adjustment/pay-link. Every action is audited.
- **The one real gap: arbitrary per-user price override.** Today the only per-user price persistence is
  `subscriptions.locked_base_amount`, writable ONLY via the founding-lock path at the plan's *fixed*
  founding price. There is no field to set an arbitrary recurring price / discount / comp for one user.

---

## Proposed build — phased, each its own save point

### Phase 0 — Verify the happy path end-to-end (no code; evidence first)
Before touching anything, live-verify on `web-dev`: create a fresh user → buy the Starter product (test
Paystack) → confirm (a) `subscriptions.product_id` set + status active, (b) `product_features` grants a
paid feature via `check_feature_permission`, (c) `platform_ledger` + `wielo_invoices` rows exist, (d) the
admin user record shows the product. This tells us which gaps are theoretical vs real. **DoD: screenshots
+ DB rows for all four.**

### Phase 1 — Every product's features actually grant (requirement #2) — ✅ DONE + LIVE-VERIFIED (2026-08-05)
On investigation the mechanism was already there: the product editor's "Feature permissions" step
persists each toggle to `product_features` via `upsertProductFeatureAction`, and `check_feature_permission`
reads `product_features` off `subscription.product_id` first. The 3 seeded products were just backfilled
because they predated the UI. So the real gaps were two hardening items, both now shipped:
1. **Create-time grants** — a new product could not carry features until saved (each toggle needed the
   product id). `upsertProductAction` now accepts an optional `features[]` batch; the editor buffers the
   permission toggles for an unsaved product and flushes them in the same create operation.
2. **Feature keys pinned to the canonical set** — `featureKey` (both the per-toggle action and the new
   batch) now `refine`s against `CANONICAL_PRODUCT_FEATURES`, so an off-catalog key is rejected at the
   boundary. The admin only ever SELECTS from the fixed toggle list — no free-text path exists (founder
   directive: attribution variables are fixed, never user-typed).
- Also fixed the stale rail hint ("Save the product first" → "Choose what it unlocks").
**Verified live** (`/admin/products/new`, founder's admin session): created a product with 2 buffered
grants (listings_limit + direct_booking) → both persisted at create (rail "2 enabled", reload confirms) →
`limit_value` round-trips (Listings qty 5 saved + reloaded). Test product deleted afterwards; catalog clean.
Files: `admin/products/actions.ts`, `admin/products/ProductEditor.tsx`. tsc + lint green.
**Not yet verified:** the full buy→gate-opens path (needs Phase 0 end-to-end with a real subscription).

### Phase 2 — Close the native-subscription-rail gap (requirement #1)
Make "successful subscription" reliably upgrade the account on the plan-picker rail. Two routes:
- **(Recommended)** Add a return-page activation fallback mirroring the product rail's
  `confirmProductOrderByReference` (verify + compare-and-set + activate), so the webhook becomes a backstop
  not a single point of failure.
- Or: route the dashboard plan picker through the **product rail** (which already has redundancy) and
  retire the fragile native rail. Bigger change; cleaner long-term. **Decision needed** (see below).
**DoD: pay via the plan picker with the webhook disabled → account still upgrades.**

### Phase 3 — Super-admin per-user price override (requirement #3b)
Extend `adminUpdateSubscriptionAction` (+ the managesub dialog) to set an explicit `locked_base_amount`
(any admin-entered amount, not just the founding price), reusing the existing proration + ledger posting.
Add an audit row. Scope decision needed: recurring-price override only, or also a per-user discount %/comp
flag? **DoD: set a custom price on a user, next charge/proration uses it, admin record + ledger reflect it.**

### Phase 4 — Finance reconciliation (requirement #4)
- **Comp/free activations post a ledger row** (a R0 or `type='adjustment'`/comp charge) so MRR and
  collected stop diverging — OR the report explicitly separates "comped" MRR. **Decision needed.**
- **Reconciliation audit**: a query/admin view that flags active priced subscriptions with no matching
  completed ledger charge (and vice versa). Surfaces divergence instead of hiding it.
- Populate `platform_ledger.subscription_id` on the product-order path so ledger↔subscription joins are explicit.
**DoD: reconciliation view is green for the happy path and flags a deliberately-comped host.**

### Phase 5 — Invite → account provisioning (pt32 loose thread)
Adding a team member mints the Wielo account; accepting the invite → completes registration → provisions
the **staff account + a free Wielo guest account** automatically (baseline free `subscriptions` row, same
as normal signup). Build the missing "register as staff" path for brand-new invitees.
**DoD: invite a never-seen email → they register → they have staff access AND a free guest account; live-verified.**

---

## Decisions — CONFIRMED by founder (2026-08-05)

1. **Native subscription rail:** ✅ **Add a return-page activation fallback** (keep both rails; webhook
   becomes a backstop). Converge later if desired.
2. **Price override scope:** ✅ **Arbitrary recurring price per user** first (extend `locked_base_amount`);
   discount %/comp flag deferred.
3. **Comp accounting:** ✅ **Post a comp ledger row** (R0/adjustment) on admin comp/free activations so
   `platform_ledger` + invoices + report reconcile.
4. **Build order:** ✅ **Phase 1 (every product's features grant) FIRST.**

**Locked build order:** Phase 0 (verify happy path) → **Phase 1 (features grant)** → Phase 2 (native-rail
fallback) → Phase 3 (per-user price override) → Phase 4 (finance reconciliation) → Phase 5 (invite provisioning).
