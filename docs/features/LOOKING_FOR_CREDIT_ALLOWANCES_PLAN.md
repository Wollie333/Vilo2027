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

### ⚠️ Allowance resolution — REUSE the entitlement system, don't mirror it

**Superseded during Phase 1 (2026-07-16).** The first draft proposed a new
`credit_allowances` table mirroring `check_feature_permission`'s precedence.
Dumping the live function showed that is unnecessary — **the entitlement system
already carries a numeric `limit_value` at all three levels**:

```
check_feature_permission(p_host_id, p_feature_key) -> jsonb
  1. host_feature_overrides (host_id, feature_key, is_enabled, limit_value, expires_at)
  2. product_features JOIN subscriptions (status in trialing|active)   -- "plan default"
  3. plan_features     JOIN subscriptions ON s.plan = pf.plan          -- legacy fallback
  4. default { is_enabled:false, limit_value:null, source:'default' }
```

…and **the admin UI for both already exists**:

| Founder's ask | Already-built home |
|---|---|
| "control the **default** … per month" | `/admin/products` → `ProductEditor` (`product_features.limit_value`) — **10 rows on live already have limits** |
| "… as well as **for each host**" | `/admin/platform/features` → `HostOverrideForm` (`host_feature_overrides.limit_value`) — **3 rows on live already have limits** |

Any feature in `CANONICAL_PRODUCT_FEATURES` (`lib/products/features.ts`) with
`scope: "total"` automatically gets a quantity input in the product editor. So
adding two catalog entries delivers the entire admin surface with **no new table
and no new admin UI**.

**`limit_value` is set by admins but read by nothing** — `hostHasFeature`
resolves the RPC then discards it, keeping only `is_enabled`. That is the *same
"admin can set it, nothing enforces it" trap* as `looking_for_quotas` (§2). Phase 1
closes it with a reader.

`credit_allowances` is therefore **NOT built**. Only `looking_for_post_unlocks` is
genuinely new.

## 5. Schema (Phase 1)

```sql
-- Which LF leads a host has paid to see. UNIQUE => never charged twice for the
-- same lead, which also makes the unlock action safely idempotent.
CREATE TABLE looking_for_post_unlocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES looking_for_posts(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, host_id)
);
```

Plus two catalog entries (`scope: "total"`) and a `hostFeatureLimit()` reader:

| Feature key | Meters |
|---|---|
| `looking_for_quote_requests_per_month` | leads a host may unlock per month |
| `looking_for_quote_responses_per_month` | quotes a host may send per month |

### Why `hostFeatureLimit` must NOT honour `PRE_MVP_FEATURES_OPEN`

`hostHasFeature` short-circuits to `true` pre-MVP so the founder can smoke-test
(AGENT_RULES §3.4). A **limit is a quantity, not an entitlement**, and credits
already meter for real pre-MVP (`spendQuoteCredit` blocks at 0 today, switch or
no switch). Short-circuiting limits to "unlimited" would make the very feature the
founder asked to control untestable. So the reader resolves honestly; the pre-MVP
switch keeps governing *access* to Looking-For (`looking_for_access`), not the size
of the allowance.

## 6. Phases

1. **Schema** — the two tables above + `resolve_credit_allowance` RPC + seed plan
   defaults for both purposes. Validate in `BEGIN; … ROLLBACK;` on live first.
2. ✅ **Grant engine — DONE.** `grantSubscriptionCredits` now loops
   `ALLOWANCE_FEATURE_BY_PURPOSE` and grants each purpose from the resolved
   allowance. `resolveFeatureLimit(client, …)` split out of `hostFeatureLimit`
   because the grant runs from webhooks/settle/admin with a service-role client
   and no user session.

   🔴 **`apply_wielo_credit`'s idempotency key does NOT include `purpose`** —
   it is `(host_id, ref_type, ref_id, kind)`. Granting two purposes under one
   ref makes the **second a silent no-op**: proven on live in a ROLLBACK — the
   `quote_request` wallet was not merely under-funded, it was **never created**.
   Every host would have had 0 leads and every lead would have locked, silently.
   Mitigated by encoding the purpose in `ref_id`
   (`{productId}:{periodKey}:{purpose}`) rather than altering a shared money RPC.
   **Anything adding a second purpose must do the same.**

   Decisions taken here: `null` limit (unlimited) → grant nothing, and the spend
   path must bypass metering (a 0 wallet would read as "blocked"). Credits
   **accumulate, not reset** — pre-existing engine behaviour, and the only safe
   option while one wallet holds both the plan allowance and purchased top-ups
   (a reset would destroy paid credits), so unused allowance rolls over —
   **founder to confirm**. `overrideQty` applies to the `quote` purpose only,
   matching its historical meaning.

   ⚠️ **Two competing sources of "credits per cycle" — must be resolved here.**
   The product editor already exposes **"Credit grant (per cycle)"**
   (`products.credit_quantity`) + **"Credit purpose"** (`products.credit_purpose`,
   a Quote/AI dropdown). That is what `grantSubscriptionCredits` reads today. It
   can only express **one** purpose per product, which is exactly why it can't
   satisfy the founder's ask (two allowances on one plan).

   Proposed: the two `*_per_month` feature limits become the SSOT for
   subscription grants (they're per-purpose and already have plan/product/host
   precedence). `products.credit_quantity` stays ONLY for one-off **credit
   package** products (`product_type='wielo_credits'`, e.g. the live "50 Quote
   Credits"), which `grantCreditsForOrder` reads — that path is unaffected.
   Leaving both live for subscriptions would double-grant. Confirm with the
   founder, then hide/retire the per-cycle field on membership products.
3. ✅ **Lead locking — DONE.** SSOT `lib/looking-for/leadAccess.ts`
   (`loadLeadAccess` / `loadUnlockedPostIds` / `unlockLead`); surfaces stay dumb.
   `unlockLeadAction` does auth only. `LeadLocked.tsx` is the paywall.

   **What a lead credit buys — masked SERVER-SIDE, not blurred.** The board action
   already returned `description` + `guest_name` + `guest_avatar`; a CSS blur would
   still ship them in the payload. `fetchLookingForPostsAction` now nulls them for
   locked posts and returns `is_unlocked`. The teaser (category · location+radius ·
   dates · guests · budget) always shows, so a host can judge before spending, and
   the lead is never dropped. The respond page always renders the request card but
   gates the quote form — which carries the guest's name/email/phone and the full
   brief — behind `LeadLocked`.

   Spend-then-record ordering, so a failed spend can't leave a free unlock; the
   unlock row's UNIQUE is the idempotency key; a duplicate-key race is treated as
   success because the credit was already deduped. Unlimited (`limit === null`)
   bypasses the wallet entirely.

   Verified live as the test host: board listed both leads with the guest masked
   ("Guest") + "Unlock & Quote"; respond page showed "Costs 1 lead credit — you
   have 200" with the form hidden; unlocking spent **exactly one** credit
   (200 → 199, one debit, one unlock row) and revealed the form; a repeat spend on
   the same ref left the balance at 199. Board then showed the unlocked lead with
   the real guest name + brief + "Send Quote", beside a still-locked one.
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
