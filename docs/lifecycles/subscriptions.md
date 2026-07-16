# Subscriptions — lifecycle flow

> How a host comes to hold a plan, and what happens to it. The founder's rule is
> **"one subscription product, many services, many packages"**: a host holds **at
> most ONE active membership**, alongside any number of service / product / credit
> subscriptions. Since `20260716240000` that is enforced in the DB, not just by
> convention — see [The one-membership rule](#the-one-membership-rule).
>
> Steps marked ✅ were driven end-to-end; ⚠️ marks what has NOT been proven.

**The model in one line:** every account starts on a **product-less baseline
subscription** (`plan='free'`, `product_id=NULL`) — that IS the guest tier — and
buying a membership *retires the baseline and replaces it*, rather than adding to it.

---

## Vocabulary (get this wrong and you will ship a bug)

| Term | Means |
|---|---|
| **Membership** | `product_id IS NULL` (the baseline) **OR** `products.product_type = 'membership'`. At most one may be *held* per host. |
| **Service / package** | `product_type` of `service`, `product` or `wielo_credits`. **Unlimited** per host; never counted against the membership rule. |
| **Held** | `status IN ('trialing','active','past_due')`. **`paused` does NOT hold the slot** — a paused host may buy another membership (founder call). |
| **The baseline** | The row signup inserts: `plan='free'`, `product_id=NULL`, `status='active'`. **It is the guest tier, not junk. NEVER prune product-less subscriptions.** |

🔴 **The recurring bug in this feature has one shape:** treating a product-less row
as "not a membership". It has been shipped twice — once in both retire paths
(`s.product_id && …`, fixed `39e17078`) and once in the UI selector
(`productType !== 'membership'`, fixed alongside `20260716240000`). Both times the
baseline survived an upgrade and the host ended up holding two active memberships.
**Any new code that asks "is this a membership?" must treat `product_id IS NULL` as
yes.**

---

### Step 1 — Signup creates the guest tier ✅
- Trigger: a visitor completes signup step 1 · Actor: guest
- Functions/files: `app/[locale]/signup/host/actions.ts` §4 (~line 438).
- Logic: after inserting the `hosts` row, insert a subscription with the resolved
  plan (`free` unless a purchase maps to a paid plan) and `product_id =
  resolvedProductId` (**NULL** when there was no purchase). Non-blocking on failure.
- DB writes: `subscriptions` (host_id, plan, product_id, status='active').
- Why a host row exists for a "guest": `subscriptions.host_id` is **NOT NULL** → FK
  `hosts`. A pure guest cannot hold a subscription, so signup creates the host row
  at step 1.
- Next: → Step 2 (buy a membership) or the account simply stays on the guest tier.

### Step 2 — Buying a membership (self-serve checkout) ✅
- Trigger: the buyer pays a membership product · Actor: guest/host → gateway webhook
- Functions/files: `lib/billing/product-checkout.ts` → `activateMappedPlan()`.
- Logic, in this order — **the order is the contract**:
  1. Find **this product's** subscription (renew it) rather than "the host's sub".
  2. Resolve `plan` from `products.plan_key ?? slug` against the `plans` catalog.
  3. **If the product is a membership: retire every OTHER held membership first**
     — including the product-less baseline — else the DB trigger rejects the write.
  4. Update the existing row, or insert a new one.
  5. `grantSubscriptionCredits()` — the per-cycle Wielo credit allotment.
- DB writes: `subscriptions` (status, plan, product_id, billing_cycle, period),
  `wielo_credit_wallet` / ledger via the grant.
- Next: → Step 5 (renew) / Step 6 (change) / Step 7 (pause) / Step 8 (cancel).

### Step 3 — Admin activates a membership ✅
- Trigger: admin *Change membership → Activate* · Actor: admin
- Functions/files: `app/[locale]/admin/users/[id]/actions.ts` →
  `retireOtherMemberships(service, hostId, keepProductId)` **before** the
  update/insert. `charge: "paylink"` DEFERS activation — the settle path (Step 2)
  activates it once the buyer pays.
- Next: → same as Step 2.

### Step 4 — Self-serve plan switch ✅
- Trigger: Settings → Subscription → pick a plan · Actor: host
- Functions/files: `app/[locale]/dashboard/settings/subscription/actions.ts` →
  `membershipSubId()` → `pickCurrentMembershipIndex()`
  (`lib/subscriptions/currentMembership.ts`).
- Logic: acts on the host's **current membership row** — the live one, preferred
  over an older cancelled one — and **updates** it rather than inserting a second.
  That is why this path does not need to retire anything.
- ⚠️ The selector is load-bearing for the one-membership rule: if it returns the
  wrong row, a switch updates a stale row and leaves the real membership held →
  two held memberships → the trigger blocks the host. It is unit-tested
  (`currentMembership.test.ts`, 17 tests) precisely because of this.

### Step 5 — Renewal / expiry warnings (system) ⚠️ not verified
- Trigger: cron · Actor: system
- `subscription-expiry-warnings` — daily `0 8 * * *`: queues a
  `subscription_expiring` notification (`days_remaining: 7`) for every `active` sub
  whose `current_period_end` is within 7 days and which is **not** already set to
  `cancel_at_period_end`.
- DB writes: `notification_queue`.
- ⚠️ There is **no auto-renew charge**. Renewal happens when a payment settles
  through Step 2 (which re-opens the period), not on a timer.

### Step 6 — Scheduled changes (system) ⚠️ not verified
- Trigger: cron `apply-subscription-changes`, hourly `0 * * * *` · Actor: system
- Functions/files: `apply_due_subscription_changes()`
  (`20260709160000_subscription_scheduled_changes.sql`).
- Logic: applies plan changes that were scheduled for the period boundary
  (e.g. an admin downgrade that must not take effect mid-period).

### Step 7 — Overdue → restricted (system) ⚠️ not verified
- Trigger: cron `restrict-overdue-subscriptions`, hourly · Actor: system
- Logic: `UPDATE subscriptions SET status='restricted' WHERE status='past_due' AND
  grace_period_ends_at < now()`.
- Note: `past_due` **still holds** the membership slot; `restricted` does not.

### Step 8 — Pause ✅
- Trigger: Settings → Subscription → Pause · Actor: host
- Functions/files: `pauseSubscriptionAction` / the cancel-request action →
  `status='paused'` + a card posted to the host's Wielo support thread
  (`hostPostToWieloThread`).
- 🔑 **Pausing frees the membership slot** — the host may buy a new membership
  while paused. The consequence is Step 9.

### Step 9 — Resume ✅
- Trigger: Settings → Subscription → Resume · Actor: host
- Functions/files: `reactivateSubscriptionAction`.
- Logic: allowed only when the row is `paused` or `cancel_at_period_end`. Because
  pause frees the slot, a host can pause → buy another → then try to resume the
  paused one, which would hit `trg_one_active_membership` as a raw DB error. The
  action therefore checks for another **held** membership first and refuses with
  *"You already have an active membership. Cancel that one first, then resume this."*
- Side-effects: clears `cancel_at_period_end`, `cancelled_at`, `cancellation_reason`.

### Step 10 — Cancel ✅
- Trigger: Settings → Subscription → Cancel · Actor: host → admin
- Logic: self-serve **cannot** hard-cancel. The host's request sets the sub to
  `paused` and posts to the Wielo support thread; **an admin performs the real
  cancellation** (and any credit note). Downgrades are admin-only.
- See [[project-host-membership-pause-cancel]] and `payments-ledger.md`.

---

## The one-membership rule

**Enforced by `trg_one_active_membership`** on `subscriptions`
(`20260716240000_one_active_membership_per_host.sql`), BEFORE INSERT OR UPDATE OF
`status`, `product_id`, `host_id` → `forbid_second_active_membership()`.

```
raise unique_violation  when  another subscription of the same host
                              has status IN (trialing, active, past_due)
                        and   (product_id IS NULL OR product_type = 'membership')
```

- Writes that cannot break the rule short-circuit: a row moving to
  `cancelled`/`paused`/`expired` returns immediately, and a non-membership sub is
  never counted. The row being written is excluded via `s.id <> NEW.id`, so
  renewing/re-activating the *same* membership is always fine.
- **A partial unique index cannot express this** — "membership" requires a join to
  `products`, and index predicates must be immutable. Hence a trigger.
- **Max only — there is deliberately no minimum.** Requiring ≥1 active membership
  would make admin *cancel membership* impossible (cancelling the last one would
  raise). "No membership → no account" is true by construction anyway, because
  signup always inserts the baseline.

**Why it matters (not cosmetic):** `check_feature_permission` resolves allowances
with `max(limit_value)` across **every active subscription**, so a second held
membership out-votes the plan the host actually pays for. Seen live: a host on
Starter (`pro` = 50 credits) resolving **200** from a leftover `business` baseline —
four times their entitlement, on a paid meter.

⚠️ **Three definitions of "held" must stay in step.** If you change one, change all:
1. the trigger's status list (`20260716240000`),
2. `isLiveMembershipStatus()` (`lib/subscriptions/currentMembership.ts`),
3. the retire filters (`retireOtherMemberships` + `activateMappedPlan`).

---

## Statuses

`trialing` · `active` · `past_due` · `restricted` · `paused` · `cancelled` ·
`expired` (`subscriptions_status_check`). **Held** = the first three.

## Credits

A membership's per-cycle Wielo credit allowance is **not** on `products` — it is the
`wielo_credits_per_month` **product feature**, which is what the grant engine reads.
The admin sets it in one place: the product form's **Wielo credits** step. Blank/0
deletes the row so the plan default applies. `products.credit_quantity` means a
one-off credit package's on-purchase grant, nothing else. See
[[project-lf-credit-allowances]].

## Related

`onboarding.md` (signup) · `payments-ledger.md` (charges, credit notes) ·
`account-deletion.md` (erasure) · `coupons.md`.
