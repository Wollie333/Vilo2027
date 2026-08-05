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

### Phase 2 — Close the native-subscription-rail gap (requirement #1) — ⚠️ CODE COMPLETE, NOT LIVE-VERIFIED (2026-08-05)
Chosen route (confirmed): **return-page activation fallback**. Added
`confirmSubscriptionByReference(reference)` to `lib/billing/product-checkout.ts` — it loads the pending
`platform_ledger` charge the native rail seeded (`startSubscriptionCheckout`), verifies the Paystack
transaction server-side, flips the row pending→completed via **compare-and-set** (so only one of {return
page, webhook} activates), resolves the membership/service product from the plan slug, and activates via the
shared `activateMappedPlan` primitive (retires the baseline membership, sets product_id/plan/period, grants
credits, welcome email). Wired into `subscription/billing/return/page.tsx` on verified success. Mirrors the
webhook's `processSubscriptionEvent` charge.success exactly; idempotent with it. tsc + lint green.

**Verification (founder plan: harness first, then smoke test):**
- ✅ **Harness DONE** — `lib/billing/confirm-subscription.test.ts` (vitest) drives the REAL function with an
  in-memory DB + the injectable `verifyPaid` seam. Proves all 5 cases: unknown-ref no-op; idempotent on a
  completed row (no re-verify); never activates an unverified payment; yields to the webhook on a lost
  compare-and-set (no double-activation); and on a won flip, ledger→completed + subscription upgraded to the
  product (product_id/plan/status active), baseline membership retired, commission+credits+welcome fire
  once. Full suite green (490 passed). The `verifyPaid` param on `confirmSubscriptionByReference` exists
  ONLY for this harness (production passes nothing → real Paystack verify).
- ⏳ **Founder smoke test STILL PENDING** — the real end-to-end proof. **DoD:** with platform Paystack in
  test mode and the webhook disabled/suppressed, complete a subscription purchase via the dashboard plan
  picker → the return page alone upgrades the account. **Blockers:** needs a host account + platform Paystack
  test config (if unconfigured, `startPlanCheckoutAction` uses state-only `switchPlan` and this rail isn't hit).

**Rail coverage — do EFT/PayPal need the same fix? NO (verified in code, 2026-08-05):**
- **Paystack (native subscription):** was the ONLY gap (webhook was sole activator). Fixed by this phase.
- **PayPal (subscription):** already activates on the return page via `activatePayPalSubscription`
  (`paypal-subscription.ts:473`) — sets product_id/plan/status, retires baseline — PLUS the ACTIVATED
  webhook PLUS `reconcilePayPalSubscriptions` cron. Never webhook-only. No gap.
- **PayPal (product/once-off):** `capturePayPalProductOrder` activates on return + webhook. No gap.
- **EFT:** not a webhook rail. Manual bank transfer → admin marks funds received
  (`markProductOrderEftReceived`) → `activateMappedPlan` runs synchronously. Admin-gated BY DESIGN (can't
  auto-confirm before the money lands). No "charged-but-not-upgraded" hole.
So the "successful subscription → account upgraded" guarantee now holds uniformly across all three rails.

### Phase 3 — Admin manual upgrade: price override + trial + reason (requirement #3 / #3b) — ⏳ NOT STARTED
Founder-confirmed scope (2026-08-05, expanded from the original #3b): the admin user-record manual upgrade
must give FULL control over a user's subscription/product. Manual upgrade to any product ALREADY exists
(`setUserProductAction` at `admin/users/[id]/actions.ts:1303` + the Products-tab catalog cards). Extend it:
1. **Reason note** — a free-text note in the controls modal, RECORDED in the user's History tab. `reason`
   already exists on `setProductSchema` (optional); it flows to `admin_audit_log` via `withAdminAudit`. Just
   surface a note field in the UI and pass it (consider making it required for a manual override).
2. **Per-user price override** — an arbitrary recurring price the admin sets; persist as
   `subscriptions.locked_base_amount` (the billing engine reads it via `resolveMembershipAmount`). Use it for
   both the recurring amount AND the immediate charge (`effPrice = priceOverride ?? product.price`).
3. **Trial duration** — a number + unit dropdown (days/weeks/months/years). When set: status `trialing`,
   `current_period_end = now + trial`, and force `charge='none'` (no money collected now).
**Backend plan (was stubbed then reverted for a clean save point):** add `priceOverride`, `trialValue`,
`trialUnit` to `setProductSchema`; in the action compute the trial end, set `status`/`current_period_end`,
add `locked_base_amount` to the subscription `patch` when overridden, and swap `newPrice`→`effPrice` in the
charge block. **UI:** the set-product / managesub modal in `admin/users/[id]/UserRecord.tsx` (a 5984-line
client component — find the set-product dialog that already collects charge/timing/creditOverride and add
the reason textarea + price field + trial value/unit).
**DoD: set a custom price + trial + reason on a user via a product card → sub reflects trialing + the
custom locked amount, the immediate charge (if any) uses the override, and the reason shows in History.**
**Also confirm (requirement #1):** signup already assigns the selected product via `activateMappedPlan`
(Phase 0/1) — spot-check the admin record shows the product the user chose at signup.

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
