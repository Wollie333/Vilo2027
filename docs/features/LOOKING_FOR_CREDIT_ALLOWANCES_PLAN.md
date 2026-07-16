# Looking-For credit allowances — admin-controlled monthly quotas

**Status:** design locked (founder decisions below), build not started.
**Founder ask (2026-07-16):** *"make sure the admin can also set how many quote
requests a user can receive per month (this is also a credit package — once the
user runs out of monthly quote requests they can buy more credits). I need the
ability to control the default quote request per month as well as quote responses
per month for each host… based on credits."*

---

## 1. What already exists (do NOT rebuild)

`lib/credits/wallet.ts` is a real, working metering layer:

- Per-host wallet keyed by **purpose** (`quote` today, `ai` reserved):
  `wielo_credit_wallet` + `wielo_credit_ledger`.
- **One write path**: the atomic + idempotent `apply_wielo_credit` RPC.
- **Quote responses are already metered**: `spendQuoteCredit` debits
  `LOOKING_FOR_QUOTE_CREDIT_COST = 1` per Looking-For quote sent
  (`dashboard/quotes/actions.ts:913`), blocks at 0, and a DB trigger refunds on
  unaccepted expiry. `LowCreditBanner` warns near zero.
- **Credit packages already exist**: `products.product_type = 'wielo_credits'`
  with `credit_quantity` + `credit_purpose`; `grantCreditsForOrder` credits the
  buyer's wallet idempotently per `product_order`.
- **Recurring plan grants already exist**: `grantSubscriptionCredits` grants a
  product's `credit_quantity` once per billing period (idempotent on
  `product:periodStart`), with an `overrideQty` used at admin activation.

So *"quote responses per month, based on credits, top up when you run out"* is
**built**. What's missing is the **quote-requests-received** meter, and
**admin control of the monthly numbers**.

## 2. ⚠️ The dead system to retire

`looking_for_quotas` (per-plan `guest_posts_per_{day,month,year}`,
`host_quotes_per_{day,month,year}`, `quote_expiry_days`, `public_quote_count_cap`)
+ its admin screen `/admin/looking-for/quotas` is **admin-editable but NEVER
enforced**. Nothing anywhere reads those columns — the only related write is a
`looking_for_usage` log insert (`dashboard/quotes/actions.ts:952`). An admin can
set "Pro = 50 quotes/month" today and it does nothing.

**Founder decision: retire it.** Credits become the single source of truth for
all Looking-For metering. Drop the table + admin screen (pre-MVP policy §
"no backwards-compat shims" makes this a straight drop).

## 3. Founder decisions (locked 2026-07-16)

| Question | Decision |
|---|---|
| Host hits the quote-**request** cap | **Locked until they buy credits** — the lead arrives but is hidden/blurred ("1 new lead — top up to unlock"). Guest is unaffected; no lead is ever dropped. |
| What counts as a "quote request" | **Looking-For only.** Direct request-a-quote on the host's own listing stays unmetered (that's the host's own traffic, not a platform-supplied lead). |
| `looking_for_quotas` | **Retire.** Credits are the SSOT. |
| Where admin sets the numbers | **Plan default + per-host override.** |

## 4. Model

Two credit purposes, both Looking-For, both admin-controlled:

| Purpose | Meters | Spent when | Status |
|---|---|---|---|
| `quote` | quote **responses** sent | host sends an LF quote (1 credit) | ✅ built |
| `quote_request` | quote **requests** received | host **unlocks** an LF lead (1 credit) | 🔨 new |

A host spends `quote_request` to *see* a lead and `quote` to *answer* it. These
are deliberately separate wallets so the founder can price leads and replies
independently (and so a host who unlocks but doesn't quote still consumes a lead).

> **Open nuance to confirm at build time:** unlocking then quoting costs 2 credits
> total (1 of each purpose). That is intended — two different wallets — but if the
> founder wants "unlock includes the reply", make `spendQuoteCredit` a no-op when
> the post was already unlocked by that host.

### Allowance resolution — mirror `check_feature_permission`

The platform already has a canonical precedence for entitlements:
**host override → active/trialing product → active/trialing plan → default**
(`check_feature_permission`, wrapped by `hostHasFeature`, fail-closed).

The numeric allowance resolver MUST mirror it rather than invent a new order:

```
resolve_credit_allowance(p_host_id, p_purpose) -> monthly_qty
  host override (credit_allowances.host_id) → plan default (credit_allowances.plan_id)
  → NULL (= unlimited) / 0 (= none) per the seeded default
```

## 5. Schema (Phase 1)

```sql
-- Monthly allowance per purpose, at plan scope OR host scope (exactly one).
CREATE TABLE credit_allowances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     TEXT,                 -- plan scope (default for everyone on the plan)
  host_id     UUID REFERENCES hosts(id) ON DELETE CASCADE,  -- per-host override
  purpose     TEXT NOT NULL,        -- 'quote' | 'quote_request'
  monthly_qty INT,                  -- NULL = unlimited, 0 = none
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES user_profiles(id),
  CHECK ((plan_id IS NOT NULL) <> (host_id IS NOT NULL)),
  CHECK (monthly_qty IS NULL OR monthly_qty >= 0)
);
CREATE UNIQUE INDEX credit_allowances_plan ON credit_allowances(plan_id, purpose)
  WHERE plan_id IS NOT NULL;
CREATE UNIQUE INDEX credit_allowances_host ON credit_allowances(host_id, purpose)
  WHERE host_id IS NOT NULL;

-- Which LF leads a host has paid to see. UNIQUE => never charged twice.
CREATE TABLE looking_for_post_unlocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES looking_for_posts(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, host_id)
);
```

## 6. Phases

1. **Schema** — the two tables above + `resolve_credit_allowance` RPC + seed plan
   defaults for both purposes. Validate in `BEGIN; … ROLLBACK;` on live first.
2. **Grant engine** — extend `grantSubscriptionCredits` to grant *per purpose*
   from the resolved allowance (not just `products.credit_quantity`, which only
   carries one purpose per product). Idempotent per (host, purpose, period).
3. **Lead locking** — host LF board + respond page: a post with no unlock row is
   **locked/blurred** with "Top up to unlock". Unlock action = spend 1
   `quote_request` credit (idempotent on the unlock row) → reveal. Guest side
   untouched.
4. **Admin UI** — plan defaults screen (replaces the retired quotas screen) +
   per-host override on the admin host/user record. Reuse `withAdminAudit`.
5. **Retire** `looking_for_quotas` + `/admin/looking-for/quotas` (drop table,
   delete route, remove `looking_for_usage` write if it's now dead too).

## 7. Gotchas carried in

- **`PRE_MVP_FEATURES_OPEN = true`** (`lib/products/featureGate.ts`) short-circuits
  every boolean gate. Allowances are **numeric**, not boolean — do NOT route them
  through `hostHasFeature`, and make sure the pre-MVP switch doesn't accidentally
  make leads free. Decide explicitly whether locking is active pre-MVP.
- Credits are **host-scoped** (`wielo_credit_wallet.host_id`). Quote-only accounts
  are hosts and DO hold credits (see `project-quote-system-hardening`).
- `apply_wielo_credit` is the ONLY wallet write path — never UPDATE the wallet
  directly (AGENT_RULES §4.7, "wire into the ledger, never fork the maths").
- Trigger/RPC-only migrations need **no `database.types.ts` regen**; new TABLES do.
