# Affiliate Campaign Layer — Implementation Blueprint

> **Status:** DESIGN LOCKED 2026-07-20 (founder-decided). This is the build spec for **WS-1** of
> `LAUNCH_EXECUTION_PLAN.md`. It supersedes the earlier "ladder replaces tiers globally" idea.
> Nothing here is built yet. Source strategy: Founding Programme v4 §4, §8. Codebase facts verified
> against the live tree + `docs/SCHEMA.md`.
>
> **Guiding rule:** the **existing default affiliate program is untouched**. Everything below is an
> **additive layer**. Money paths change in exactly one gated place (§5.2). Build on what exists.

---

## 1. Architecture — two layers

```
                    ┌─────────────────────────────────────────────┐
   every affiliate  │  DEFAULT PROGRAM  (unchanged, always-on)     │
   has this ───────►│  per-product rates × lifetime tier bonus     │
                    │  plain link  /r/[slug]   →  campaign_id = NULL│
                    └─────────────────────────────────────────────┘
                    ┌─────────────────────────────────────────────┐
   opt-in, 0..N     │  CAMPAIGN LAYER  (additive)                  │
   campaigns ──────►│  1. own attribution  (unique campaign link)  │
                    │  2. own commission structure (ladder/flat/…) │
                    │  3. optional competition overlay (scoring,   │
                    │     leaderboard, prizes, dates)              │
                    │  campaign link  /c/[campaign]/[slug]         │
                    │        →  campaign_id = <that campaign>       │
                    └─────────────────────────────────────────────┘
```

- **Default program** = today's system, verbatim. Any affiliate earns it on any referral that is **not**
  tagged to a campaign. Per-product `affiliate_type/value`, `affiliate_duration`, the lifetime-earnings
  **tier bonus**, accrual/hold/clawback/payout — all unchanged.
- **A campaign** is a config row an affiliate can enrol in. It bundles three facets:
  1. **Attribution** — a unique campaign link; referrals through it are tagged.
  2. **Commission structure** — how *those* referrals earn: `ladder` (revenue bands + floors, the Founding
     Race), `flat` (fixed %/amount), or `inherit` (= default per-product). **Governs for the lifetime of
     the referral**, even after the competition window closes.
  3. **Competition overlay (optional)** — scoring events + weights + `total`/`net_change` mode + public
     leaderboard + prizes + start/end dates + a rules-doc URL. **Time-boxed.**

**Key lifespan distinction:** a campaign's *commission structure* is lifetime-recurring on its attributed
referrals; its *competition overlay* is time-boxed. When the Founding Race ends after 8 months, the
leaderboard freezes and prizes pay out — **but attributed hosts keep earning the partner commission
forever** (Founding Programme §3.3: "their conversion lands after it closes and still pays commission").

---

## 2. The core mechanism — `campaign_id` on the referral

Attribution already binds a referred user to an affiliate **once, forever**
(`affiliate_referrals`, UNIQUE `referred_user_id`; `lib/affiliate/attribution.ts`).
We add **one nullable column**: `affiliate_referrals.campaign_id`.

| Link the host clicked | `campaign_id` | Which rules the referral earns under |
|---|---|---|
| Plain `/r/[slug]` | `NULL` | **Default program** (per-product + tier), unchanged |
| Campaign `/c/[campaign]/[slug]` | `<campaign>` | **That campaign's** commission structure |

**A referral resolves under exactly ONE rule set.** This single fact:
- kills the double-count risk (a referral is never both default *and* campaign),
- leaves the default money-path untouched (the resolver only branches when `campaign_id` is set),
- makes concurrent campaigns trivial (a referral tags at most one campaign),
- dissolves the "ladder vs tiers" tension: **tiers stay in the default program; the ladder lives inside
  the campaign.**

**Binding precedence (decided):** the original referral binding always wins. If a host arrives via a
campaign link but was *already* bound (to any affiliate/campaign), the existing binding stands and the new
campaign tag is ignored — identical to today's first/last-click attribution rule.

---

## 3. Data model (proposed — all additive; pre-MVP additive-migration policy applies)

> Sketch, not final DDL. Reuses existing tables where possible; new tables are small config/link rows.

**New columns on existing tables**
- `affiliate_referrals.campaign_id uuid NULL REFERENCES affiliate_campaigns(id) ON DELETE SET NULL`
- `affiliate_commissions.campaign_id uuid NULL` — stamped at accrual so a commission row knows its
  campaign (for reporting, payout, and the campaign P&L). Default rows leave it NULL.
- `affiliate_accounts` presentation fields for co-branded pages: `display_headline text`, `bio text`,
  `photo_url text` (nullable).

**New tables**
- **`affiliate_campaigns`** — one config row per campaign:
  - identity: `id`, `slug` (unique, public), `name`, `status` (`draft|active|ended|archived`)
  - window: `starts_at`, `ends_at` (nullable = open-ended commission with no competition)
  - eligibility: `eligible_partners` (`all|tagged|invite`), `eligible_referrals`
    (`all_time|referred_in_window|activated_in_window` — default `activated_in_window`)
  - **commission_structure jsonb** — `{ model: 'ladder'|'flat'|'inherit', bands:[{max, rate}], flat_rate,
    scope:'subscription' }`
  - **competition jsonb** (nullable) — `{ events:{listing_published:1, subscription_started_monthly:0,
    subscription_started_annual:0}, scoring_mode:'total'|'net_change', count_active_only:true,
    each_listing_counts:true, prizes:[…], tie_breaker:'earliest_to_final_score',
    leaderboard_visibility:'public'|'partners'|'hidden' }`
  - `rules_doc_slug text` → `legal_documents.slug` (the CPA fixed-URL rules page)
  - audit: `created_by`, `created_at`, `updated_at`
- **`affiliate_campaign_enrollments`** — `(affiliate_id, campaign_id)` unique, `status`, `enrolled_at`.
  Presence drives the Competitions tab + the affiliate's campaign link.
- **`affiliate_campaign_floors`** — `(affiliate_id, campaign_id)` unique, `floor_rate numeric`,
  `won_via text` (e.g. `'placing_1'`), `awarded_at`. Awarding writes `GREATEST(existing, won)`.
- **`affiliate_campaign_daily_scores`** *(only if `net_change` is used)* — `(campaign_id, affiliate_id,
  score_date, active_listings)`; one snapshot row per day so a window's net change = end − start.

**Reused verbatim (no change):** `affiliate_accounts`, `affiliate_referrals` (spine), `affiliate_commissions`
(accrual/hold/clawback/payout), `affiliate_tiers` (default program only), `affiliate_settings`,
`affiliate_payouts`, the `/r/[slug]` attribution route, `bindAffiliateReferral`.

---

## 4. Attribution flow

1. Affiliate enrols in a campaign → gets their campaign link `/c/[campaignSlug]/[affiliateSlug]`
   (and/or a co-branded `/partners/[slug]?c=[campaign]`).
2. Link route logs the click and drops the existing `vilo_ref` cookie **carrying both** `affiliate_id`
   **and** `campaign_id` (today it carries affiliate only — extend the payload).
3. On signup, `bindAffiliateReferral` writes `affiliate_referrals` as today **plus** `campaign_id` from the
   cookie (only if the user isn't already bound — precedence rule §2).
4. Everything downstream (host creation, listing publish, subscription) is unchanged — the referral simply
   now carries a campaign tag.

**Reuse:** the entire attribution spine is reused; the only change is the cookie payload + the one new
column write.

---

## 5. Commission resolution

### 5.1 Default path — UNCHANGED
`accrue_affiliate_commission(ledger_id)` runs exactly as today for any source charge whose referral has
`campaign_id IS NULL`: resolves product → per-product rate × tier bonus → NET commission, split
recurring/setup-fee, duration-capped, idempotent on `(source_ledger_id, kind)`, held `hold_days`, cleared
by cron, clawed back on refund via `reverses_ledger_id`. **No change.**

### 5.2 Campaign path — ONE new branch (the only money-path change)
If the source charge's referral has an active `campaign_id`, resolve under that campaign's
`commission_structure`:
- **`inherit`** → behave like the default (per-product), but stamp `campaign_id` on the row.
- **`flat`** → `commission = flat_rate × NET` (or a fixed amount), stamped with `campaign_id`.
- **`ladder`** (the Founding Race) → `commission = effective_rate × NET_subscription`, where
  `effective_rate = MAX(band_rate, campaign_floor)` (§5.3–5.4).

The branch is gated on `campaign_id`; the default path is byte-identical to today → **lowest possible money
risk**. Same idempotency, hold, clawback, and `kind` discipline as the recent recurring-billing hardening.

### 5.3 The ladder — monthly recompute
- **Book** = the affiliate's trailing-month **collected subscription revenue** (membership + per-listing
  add-ons) from **this campaign's** attributed, currently-active referred hosts. "Collected" = completed
  `platform_ledger` subscription charges (Plane-B, ZAR). One-off products do **not** feed the band
  (`scope:'subscription'`) — keeps the band stable and matches §4.5's maths.
- **Band → rate:** ≤R10k→10%, R10–25k→15%, R25–50k→20%, R50k+→25% (from `commission_structure.bands`).
- **Whole-book + retroactive:** crossing a threshold moves the *entire* book to the new rate, backdated to
  that month. Mechanism: a job (`recompute-affiliate-campaign-rates`, mirrors
  `20260616000014_affiliate_cron.sql`) computes month-to-date book → band → effective rate, and **re-rates
  that month's still-`pending`/`cleared` campaign commission rows** to the new rate. **Never touches
  `paid`.** Runs nightly (and/or on each new campaign charge).
- **Churn-sensitive:** because the band reads *currently-active* collected revenue, a partner whose hosts
  churn drops a band next recompute — the strategy's intended retention pressure.

### 5.4 Floors (prizes) — campaign-scoped
- A won floor is a permanent **minimum** rate on that campaign's ladder: `effective = MAX(band_rate, floor)`.
- Stored per `(affiliate, campaign)` in `affiliate_campaign_floors`.
- Applies **only** where a ladder rate exists (the campaign) — it never touches default per-product
  referrals. Non-transferable (§8.5).

### 5.5 Conversion bonus (R250 / R400)
- Flat cash, paid on conversion, **separate from the ladder**.
- `kind='conversion_bonus'` on `affiliate_commissions` (the enum already carries
  `subscription|setup_fee|upgrade`; add this one), accrued **once** when a campaign-referred host's **first
  paid** subscription activates (R250 monthly / R400 annual).
- **Hold nuance:** the strategy wants it "paid immediately — carries partners through the unpaid beta
  months." Give the conversion bonus its own short/zero hold rather than the default 30-day hold.
  Still clawed back if the activating payment is refunded/charged-back (§8.5) via the existing
  `reverses_ledger_id` path.

---

## 6. Competition scoring & public leaderboard

### 6.1 Score = live nightly query (NO points ledger)
Per §8.7.2, do **not** accumulate points. Recompute nightly:

```
score(affiliate, campaign) =
  Σ over hosts H where H.referral.affiliate_id = affiliate
                   and H.referral.campaign_id = campaign
                   and H satisfies campaign.eligible_referrals window
    ( count of H's currently published + active listings )   -- weight 1 per listing_published
```

- `count_active_only` + `each_listing_counts` are defaults-on → a 15-listing manager scores 15; a churned
  host's listings drop off the next recompute automatically. **No clawback job, no dispute queue.**
- **`total` mode** (the main race): score = all currently-active attributed listings.
- **`net_change` mode** (monthly campaigns, prevents a runaway leader): score within the window = active
  listings at window-end − at window-start, from `affiliate_campaign_daily_scores` snapshots.

The referral graph (`affiliate_referrals → hosts → properties/property_rooms` with published flags) already
supports this query — scoring is **read-only**, zero money risk.

### 6.2 Leaderboard page
- Reuse the existing `portal/affiliates/leaderboard/page.tsx` **UI shell** (ranking, medals), but point it
  at the campaign score and add an **unauthenticated public route per campaign**
  (`/c/[campaignSlug]/leaderboard` or similar) — live day one, `leaderboard_visibility` respected.
- Tie-breaker: `earliest_to_final_score` (must exist before day one, §8.7.3).

---

## 7. Partner portal — the "Competitions" tab

- New tab in the affiliate portal (the standard dashboard is unchanged). Lists campaigns the affiliate is
  **enrolled in** (and campaigns they **can join**).
- Per campaign: the rules (link to the `legal_documents` rules page), the commission structure in plain
  language, **their campaign link** (copy button), and their live panel:
  - **my score · my rank** (from §6),
  - **current rate** and **points/revenue to the next rung**,
  - an **earnings CALCULATOR**: "if all your live hosts convert at R599, your book is RX/mo" — the word
    **"potential"**, conditional framing, CPA-safe (Founding Programme §4.7). Reuse
    `lib/affiliate/commission.ts:computeCommission`.
- The existing tier card in `portal/affiliates/page.tsx` is the UI pattern to clone for the rate/score panel.

---

## 8. Admin

- **Config-in-code for the first run** (§8.7.6 explicitly defers the admin UI). The Founding Race is seeded
  as one `affiliate_campaigns` row via migration/seed with the config in §10.
- A proper campaign builder + concurrent-campaign UI comes later; the schema is designed to allow it.
- Awarding prizes (cash + floor) is an admin action that writes `affiliate_campaign_floors` +
  a `conversion_bonus`-style cash payout row; slots beside the existing `/admin/affiliates` payout queue.

---

## 9. Worked examples

**Ladder + floor (Themba wins 1st = 20% floor):**

| When | Book | Ladder band | Floor | Effective | Note |
|---|---|---|---|---|---|
| During race | R50,316 | 25% | 20% | **25%** | ladder above floor → floor invisible |
| A year later (churn) | R17,970 | 15% | 20% | **20%** | floor catches him — +R898/mo vs no floor, forever |

**Floor is campaign-scoped:** the same partner's *default-link* referral who buys a R500 add-on earns that
product's default rate (say 10% = R50) — the 20% floor does not touch it.

**Concurrent campaigns:** the same affiliate can run the Founding Race link *and* a "December Sprint" link;
each referral is tagged to whichever brought it and earns under that campaign's structure; default-link
referrals keep earning the default commission. All three coexist without interaction.

---

## 10. Locked decisions & the Founding Race seed config

**Locked (founder, 2026-07-20):**
1. Default program stays as-is (per-product + tier bonus), always-on for every affiliate.
2. Campaigns are an additive layer: attribution + commission structure + optional competition overlay.
3. A referral earns under exactly one rule set (`campaign_id` or default). No double-count.
4. Affiliates may hold **multiple** concurrent campaign links.
5. Original referral binding always wins; a campaign link for an already-bound host is ignored.
6. Campaign earnings **count toward the affiliate's lifetime totals** (which drive the default-program tier).
7. Floors are **campaign-scoped** (lift that campaign's ladder only).
8. Ladder band scope = **subscription revenue only** (membership + per-listing); conversion bonus separate.

**Seed: the Founding Race campaign**
```
slug: founding-race
commission_structure: { model:'ladder', scope:'subscription',
  bands:[{max:10000,rate:0.10},{max:25000,rate:0.15},{max:50000,rate:0.20},{max:null,rate:0.25}] }
competition: { events:{listing_published:1}, scoring_mode:'total', count_active_only:true,
  each_listing_counts:true,
  prizes:[ {placing:1, cash:15000, floor:0.20}, {placing:2, cash:7000, floor:0.15},
           {placing:3, cash:3000, floor:0.12},
           {milestone:'first_to_10', cash:2000}, {milestone:'any_reaching_5_in_30d', cash:1000},
           {monthly_top_net_change: 1000} ],
  tie_breaker:'earliest_to_final_score', leaderboard_visibility:'public' }
starts_at / ends_at: 8-month window
rules_doc_slug: 'founding-race-rules'   // legal_documents (CPA fixed URL, 3-yr retention)
```
Monthly leaderboard + Fast Start + First-to-10 can be **separate campaign rows** reusing the same engine
(§8.7.5), or milestone entries on the main campaign — decide at build time; the schema supports both.

---

## 11. Money-safety & correctness rules (non-negotiable)

1. **Default accrual path is byte-identical to today.** The campaign resolver is one branch gated on
   `campaign_id`. Prove the default path is unchanged before touching the campaign branch.
2. **Idempotent accrual** preserved: unique `(source_ledger_id, kind)`; campaign rows stamp `campaign_id`
   but keep the same idempotency guard.
3. **Clawback** reuses `reverses_ledger_id` (already kind-agnostic) → campaign + conversion-bonus rows claw
   back correctly on refund/chargeback.
4. **Re-rating never touches `paid` rows** — only `pending`/`cleared` within the current month.
5. **Scoring is read-only** — never writes money; a scoring bug can misrank a leaderboard but cannot mis-pay.
6. **Sandbox round-trips before go-live:** a referred host through Paystack + PayPal renewal/upgrade under a
   campaign, asserting exactly one correctly-rated accrual per real charge (mirrors the recent H4 checks).
7. Anti-gaming (§8.5): verified activations (address + photos), no self-referral, floors non-transferable,
   fake accounts forfeit points + prizes + commission.

---

## 12. Reuse vs. new — inventory

| Reused verbatim | New (additive) |
|---|---|
| `/r/[slug]` attribution + `vilo_ref` cookie + `bindAffiliateReferral` | cookie payload gains `campaign_id`; `/c/[campaign]/[slug]` link route |
| `affiliate_referrals` spine | `+ campaign_id` column |
| `affiliate_commissions` accrual/hold/clawback/payout | `+ campaign_id` column; `kind='conversion_bonus'`; campaign branch in the resolver |
| `affiliate_tiers` (default program) | untouched |
| `accrue_affiliate_commission` default logic | one gated campaign branch + ladder recompute cron |
| leaderboard UI shell, `computeCommission`, tier-card UI | public per-campaign leaderboard route; Competitions tab; earnings calculator |
| `/admin/affiliates` payout queue + nav | campaign config (config-in-code first); prize-award action |
| `legal_documents` store (WS-6) | the CPA rules page per campaign |

---

## 13. Build order within WS-1

1. **Schema (additive):** `campaign_id` columns + `affiliate_campaigns` / `_enrollments` / `_floors`
   (+ `_daily_scores` if `net_change`). Seed the Founding Race row.
2. **Attribution:** campaign link route + cookie payload + `bindAffiliateReferral` writes `campaign_id`.
   *(Read-only-ish; no money.)*
3. **Scoring + public leaderboard:** nightly recompute + public page. *(Read-only; zero money risk — safe
   to ship first and validate the whole spine.)*
4. **Competitions tab** in the portal (score/rank/rate/calculator).
5. **Commission resolver branch** (`inherit`/`flat`/`ladder`) + monthly recompute + floors. *(Money — build
   last, behind the gate, with sandbox round-trips.)*
6. **Conversion bonus** (`kind='conversion_bonus'`, short hold).
7. **Co-branded `/partners/[slug]`** + presentation fields.

Steps 1–4 carry no financial risk and can proceed while the pricing (WS-5) and legal (WS-6) work lands;
step 5 is the single money-touching change and ships only after the default path is proven unchanged.

---

*Blueprint — WS-1 of the Launch Execution Plan. Default program untouched; campaigns additive. No code yet.*
