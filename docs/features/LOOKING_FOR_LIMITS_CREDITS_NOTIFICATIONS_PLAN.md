# Looking-For — limits, Wielo Credits, notifications, records & email system

Founder batch captured 2026-07-15 (mid Feature-3). This supersedes the tail of
`LOOKING_FOR_NEXT_PHASE_PLAN.md` as the active roadmap for Looking-For. Every
workstream ships as its own verified-live commit (Principle #9); schema changes
are flagged for founder sign-off before building (CLAUDE.md "When Unsure").

---

## 0. Where we are (in flight)

- **Feature 3 — Guest Looking-For CRM record + archive** (BUILT, verifying):
  `[id]/page.tsx` → `record-data.ts` loader + `RequestRecord.tsx` (tabbed:
  Overview / Quotes / Messages / Timeline, using shared `RecordTabs`) +
  `RequestMessages.tsx` (host-thread switcher reusing the inbox chat wall/
  composer). List page is now an archive (status filter + unread + last-activity).
- **Latent bug fixed in-task:** `hosts.logo_url` does not exist (the column is
  `avatar_url`) — the old detail + compare pages selected it, so the join errored
  and **every guest-side quote silently vanished**. Also fixed the compare page's
  non-existent `quotes.adults/children/infants/notes_to_guest/expires_at`
  (correct: `headcount` / `notes` / `valid_until`). Both are latent-prod bugs the
  moment a real quote arrives.

---

## 1. CRM records mirror the guest-record convention (guest + host)

**Founder directive:** both the guest AND host Looking-For "post record" must
mirror `admin/users/[id]/UserRecord.tsx` — tabbed record, identity band,
consistent look (shared `RecordTabs`, sticky identity/dossier styling).

- **Guest record** (Feature 3) — already tabbed; finish aligning to the
  convention (identity band ✓, tabs ✓; match spacing/typography, consider the
  360px sticky dossier pattern for the request summary).
- **Host record** — when a host opens a request from Browse Requests, it should
  be a **tabbed record** too, not a single scroll:
  - **Overview** (the request — reuse the improved horizontal info card from §2),
  - **Quote** (the quote builder — the existing respond flow, unchanged logic),
  - **Messages** (the thread with this guest),
  - (later) **Guest** trust/history.
  The quote-form-opens-on-quote flow is confirmed correct — we're re-housing it
  in the record shell + improving the info card, not changing the mechanic.

---

## 2. Respond-page info card → compact horizontal card (host)

The green "Responding to request" card + "What the guest needs" block take too
much vertical space. Rebuild as a **horizontal card**: request image (left),
title + key facts (location, dates + flex, guests, budget) middle, requirement
chips condensed, CTA/step context right. Less space, same signal. (Ref image
supplied.) Shared component so the guest record + public search (Feature 2) can
reuse it.

---

## 3. Looking-For limits & quotas

### 3.1 Guest side
- **Admin can suspend / pause an individual Looking-For post** (moderation) —
  post gets a `paused`/`suspended` status; hidden from public + host browse; guest
  sees the state on their record; admin action is audit-logged.
- **Guest post quantity limit** — cap active posts per guest ("x" at a time).
  Partly exists: `check_guest_post_quota` RPC (returns `{allowed, remaining_*,
  limit_hit}`) + `looking_for_usage`. Wire the limit value to admin config
  (global and/or plan) and surface remaining to the guest.

### 3.2 Host side
- **Host quote quantity limit.** A host can only have **"x" outstanding quotes**
  at once; once at the cap it **locks** until a quote **expires or is accepted**,
  then frees up. Partly exists: `looking_for_usage` (`action='host_quote'`).
  → **OPEN QUESTION (see §4):** is the cap a *concurrent outstanding-quote* cap,
  or a *consumable* balance, or both?

### 3.3 Where limits live
Reuse the existing gate infra: `check_feature_permission` (plan) + a global admin
config for base numbers. Admin UI to set the numbers.

---

## 4. Wielo Credits (scaffold now, purchase phased)

**Founder:** prepare a credit system so hosts can (future) buy credits that
increase how many quotes they can send; also opens future AI-feature credits
(NOT now). This is a **new product category** with **qty + permission fields**.

- **New product category `wielo_credits`** (or a `credit_grant` product type) in
  the products/subscription-product catalog, with fields for **credit quantity**
  granted and **what the credits unlock** (permission/purpose — `quote`, later
  `ai`). Ties into the existing commerce model (`product_type`, ledger, buyer txn
  history — see memory `project-wielo-commerce-model`).
- **Host credit balance** — a ledger/balance of Wielo Credits per host, credited
  on purchase, debited/held by the quota engine.
- **Purpose-scoped** so the same credit system later powers AI features.

### 4.1 The mechanic — DECIDED (founder, 2026-07-15)

**Consumable credits.** Each quote **sent** burns 1 quote-credit; **refunded if
the quote expires unaccepted** (so "you're out of credits, a refunded expiry
gives one back" expresses the "locks until it expires or is accepted" behaviour).
Plans grant a monthly allotment; hosts buy Wielo Credits to top up.

### 4.2 Direction — credits as the platform metering layer (founder vision)

Founder: *"migrate the whole system to this credit-based system — nothing really
changes for the user, they still subscribe to a product but this allocates
credits."* Agreed, with one important boundary so it stays clean:

- **Entitlements stay boolean.** `check_feature_permission` (plan gating) keeps
  answering *"does this plan unlock feature X at all?"* — access is not metered.
  (You don't hold "4,200 credits of website-builder"; you either have it or not.)
- **Credits meter the countable.** A per-purpose **credit wallet** meters
  everything *countable* — `quote` now, `ai` later, potentially
  broadcasts/SMS/etc. Each metered action defines a **credit cost**.
- **A subscription does both.** A plan/product = `permissions{…}` **plus** a
  recurring **credit grant** per purpose (`{quote: N, ai: M, …}`). Subscribing is
  unchanged for the user; it now also tops up the wallet each cycle.
- **Incrementally adoptable.** Wire **quotes first**; every future metered
  feature just registers a purpose + cost. No big-bang migration; the existing
  permission gates are untouched.

This is the standard wallet-plus-entitlements SaaS pattern (Twilio/OpenAI-style)
and is what §4's schema targets:
- `wielo_credit_wallet` (host_id, purpose, balance) or a per-host balance keyed
  by purpose;
- `wielo_credit_ledger` (grant / debit / refund / purchase, purpose, ref, running
  balance) — mirrors the existing `platform_ledger`/`wielo_credit_notes` style;
- products of category `wielo_credits` carry **credit qty + purpose** (and plans
  carry a per-cycle grant); the quota engine debits/holds/refunds on the ledger.

### 4.3 Credit packages = a product category; top-up reuses commerce (founder)

Founder detail (2026-07-15) — build credits so they **buy exactly like every
other service** today:

- **Credit packages are a new product CATEGORY in the Products feature.** Admin
  creates credit packages there (e.g. "50 quote credits", "200 quote credits")
  with **credit qty + credit purpose + price** as product fields. Bought through
  the **existing commerce infrastructure** (product order → pay → ledger → the
  same buyer-txn history), no bespoke checkout.
- **Admin controls credit COST + QTY** from the Products feature: the price and
  the granted credit quantity per package, plus the **per-action credit cost**
  (how many credits a quote send costs) in admin config.
- **Header credit-balance pill** (host shell header) showing the current balance.
  Clicking it opens a **summary modal**: balance by purpose, recent
  grants/debits (from the ledger), and a **"Top up" button** that routes to the
  internal top-up = the credit-package products (select a package → buy via the
  existing product purchase flow → webhook/return settles → ledger credits the
  wallet). On successful top-up the pill updates.
- **Settlement wiring:** the credit-package product's `onProductOrderPaid`
  handler grants credits to the buyer's wallet (idempotent, like the existing
  product purchase lifecycle — see memory `project-product-purchase-lifecycle`).

Net: subscribing to a plan grants recurring credits (§4.2); buying a credit
package is a one-off top-up through the normal Products purchase path. Same UX
the founder already uses for every service.

---

## 5. Looking-For notifications — both sides, every stage

Wire email **and** inbox/in-app notifications across the whole lifecycle, and add
them to the flowchart (`docs/lifecycles/looking-for.md`).

Stages to cover (recipient):
- Guest posts a request → matching **hosts** get "new matching request" (host
  alerts — matcher exists via `notifyMatchingAlerts`; region digest/expiry
  drainers still UNBUILT per memory `project-looking-for-audit`).
- Host sends a quote → **guest**: "quote received" (email `QuoteSentGuest` via
  `looking_for_quote_received` + inbox card — exists; verify end-to-end).
- Guest views quote → **host**: "quote viewed" (`looking_for_quote_viewed` —
  exists).
- Guest accepts quote → **host**: "quote accepted".
- Guest declines quote → **host**: "quote declined".
- Quote about to expire → **host** and/or **guest**.
- Request about to expire → **guest** ("extend?"); request expired → **guest**.
- Request fulfilled/cancelled → the other party where relevant.

Deliverable: a stage→event→(email template + inbox builder)→recipient matrix in
the lifecycle doc, then wire each missing `dispatchEvent` + `EMAIL_REGISTRY`
entry + inbox builder. Build the region-digest / expiry drainers that fill the
existing queues.

---

## 6. Email template STYLE — Wielo-scoped redesign

Founder likes the supplied table-based HTML email (B10 Biochar). Adopt that
structure — dark header band with eyebrow + title + status pill, green accent
line, label→value detail table, left-accent message block, pill CTA, divider,
footer — **re-skinned to Wielo** (logo, brand colours `--brand-primary` etc.).
Build it as the **shared Wielo email shell** so every system email inherits it;
migrate templates onto it (starting with the Looking-For ones from §5).

---

## 7. Admin Email Templates section — categorised system (SEPARATE, big)

**Founder directive:** the admin email-templates area is today "just a table with
a bunch of emails." Re-architect it so emails are **organised by category**, each
tagged with **where it fits and when it fires** (trigger/event, recipient,
lifecycle stage). This is **separate work needing detailed planning** — it gets
its own plan doc + phased build. It is a **tracked step we must finish**; it is
mentioned now because §5 (Looking-For notifications) needs the registry wired.

Scope to plan later: category taxonomy (transactional / booking / quote /
looking-for / payments / account / marketing / platform), per-template metadata
(event key, recipient, fires-when, variables), preview with sample data, the
Wielo shell from §6, and mapping every existing `EMAIL_REGISTRY` entry into it.

---

## Suggested sequence (confirm)

1. **Finish Feature 3** guest CRM record (verify live) — in flight.
2. **§2 respond-page horizontal info card** + **§1 host record shell** (quick,
   isolated, visible).
3. **§5 Looking-For notifications** (both sides/stages; flowchart + wire) — needed
   now; uses current email system.
4. **§3 limits/quotas** (admin suspend/pause · guest post cap · host quote cap).
5. **§4 Wielo Credits** product category + capacity wiring (scaffold; purchase
   phased) — after the §4.1 mechanic is chosen.
6. **§6 email style** Wielo shell + migrate Looking-For emails onto it.
7. **§7 admin email-templates categorisation** — own detailed plan + build.

(§6 can move earlier if we want the §5 emails to ship already re-skinned.)
