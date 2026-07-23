# Wielo Affiliate Program — Manager Rework Design Brief

> **Purpose of this document.** A complete, self-contained brief for reworking the **affiliate program
> manager UI** — both the **partner-facing manager** (the portal an affiliate uses) and the
> **admin-facing manager** (the screens Wielo staff use to run the program). Hand this to a fresh Claude
> session as the design brief.
>
> **Scope guardrail — READ FIRST.** This is a **UI / UX / information-architecture rework**, not a
> money-engine rebuild. The commission math, accrual, holds, clawback, ledger integration and payout
> plumbing are **already built and money-verified** — the rework must **surface** them clearly, never
> re-implement or change them. Any change to how money is *calculated* is out of scope for this brief and
> must be raised separately. Treat the "Commission engine" section below as **read-only domain truth the
> UI must faithfully reflect**.
>
> **Also leave alone:** the website builder / host public sites are being built on a separate branch —
> not part of this work.

---

## 1. What the affiliate program is (and why it matters)

Wielo is a **0%-commission direct-booking management platform** for South African accommodation hosts.
It has **no marketplace take-rate**, so its growth engine is a **partner/affiliate referral program**,
not paid acquisition. The affiliate program is the **launch supply engine**: a small set of **Founding
Partners** (accommodation Facebook-group owners, ≤25 capped) recruit hosts, and every host they refer
earns them a **lifetime recurring commission** on that host's subscription.

Layered on top is an **8-month competition** (the "Founding Race") with a **public leaderboard** and cash
prizes, to drive urgency and rank partners by how many active listings they bring on.

**The affiliate manager is therefore two products in one:**
- **Partner manager** — an earnings + growth dashboard a non-technical partner logs into to get their
  links, watch their money, see their rank, and request payouts. Must feel motivating, trustworthy and
  dead simple.
- **Admin manager** — the control room Wielo staff use to configure commission rules, run campaigns,
  approve payouts, award prizes, and audit the whole thing. Must be powerful, safe, and unambiguous.

---

## 2. The two-layer model (the mental model everything hangs off)

Every affiliate always has the **Default Program**. On top of that they can opt into **0..N Campaigns**.

```
DEFAULT PROGRAM  (always-on, every affiliate)
  • Plain referral link  /r/<slug>          → referral.campaign_id = NULL
  • Earns: per-product commission rate  ×  lifetime-earnings TIER BONUS
  • Lifetime/duration per product; holds, clearing, clawback, payouts

CAMPAIGN LAYER  (additive, opt-in)
  • Campaign referral link  /c/<campaign>/<slug>   → referral.campaign_id = <campaign>
  • Earns: THAT campaign's commission structure (ladder | flat | inherit)
  • Optional competition overlay: scoring + public leaderboard + prizes + dates
  • e.g. the "Founding Race" (8-month, revenue-band ladder 10/15/20/25%)
```

**The one mechanism:** `affiliate_referrals.campaign_id` (nullable). A referral resolves under **exactly
one** rule set — plain link → default; campaign link → that campaign. No double-counting. The original
binding always wins (a campaign link for an already-referred host is ignored).

**Key lifespan distinction the UI must communicate:**
- A campaign's **commission structure is lifetime** on its attributed referrals (keeps paying after the
  race ends).
- A campaign's **competition overlay (leaderboard/prizes) is time-boxed** (the race closes, board
  freezes, prizes pay out — but attributed hosts keep earning the partner forever).

---

## 3. Glossary (use these terms consistently in the UI)

| Term | Meaning |
|---|---|
| **Affiliate / Partner** | A user enrolled in the program. "Partner" is the friendly public word; "affiliate" is the system word. |
| **Referral** | The permanent binding of a referred user (a host) to the affiliate who introduced them. One per user, forever. |
| **Attribution** | How a click on a referral link becomes a referral (last-click; a cookie carries affiliate + optional campaign; binds once at signup). |
| **Commission** | Money an affiliate earns from a referred host's payment. Accrues per qualifying charge. |
| **Base / NET** | Commission is computed on the **net** amount of the source charge (ZAR), never a client-supplied figure. |
| **Tier bonus** | Default-program reward: a % bonus **on top of** the per-product base rate, earned by lifetime **cleared** earnings (e.g. Silver/Gold). |
| **Campaign** | An opt-in layer with its own link, commission structure, and optional competition. |
| **Ladder** | A campaign commission model: revenue **bands** → rates (Founding Race = ≤R10k→10%, R10–25k→15%, R25–50k→20%, R50k+→25%). Whole-book, retroactive within the month, churn-sensitive. |
| **Floor** | A prize-won permanent **minimum** rate on a campaign's ladder (`effective = MAX(band_rate, floor)`). Campaign-scoped. |
| **Conversion bonus** | Flat cash (R250 monthly / R400 annual) paid once when a campaign-referred host's first paid subscription activates. Separate from the ladder; short/zero hold. |
| **Duration** | How long a referral keeps earning: `once` / `recurring(N periods)` / `lifetime`. Per product (default) or per campaign. |
| **Hold** | Newly-accrued commission is **pending** for a hold window, then **cleared** (available to pay). Protects against early refunds. |
| **Clawback** | If the source charge is refunded/charged back, the commission is reversed (proportional for partial refunds) via the ledger. |
| **Payout** | An affiliate withdraws cleared balance (minus fees, above a minimum threshold). Emits a remittance document. |
| **Leaderboard** | Public per-campaign ranking by score (live nightly query on active referred listings — NOT a points ledger). |
| **Score** | For a campaign: count of the affiliate's currently-published, active referred listings (each listing counts; churn auto-decrements). |

---

## 4. The commission engine — domain truth the UI must reflect (do NOT change it)

This is already built, money-verified, and integrated with the real `platform_ledger`. The UI **reads and
displays** this; it must not re-implement any of it.

- **Per-product config is the SSOT.** Each product carries `affiliate_type/value/duration` (+ setup-fee
  affiliate fields). The DB function `accrue_affiliate_commission(ledger_id)` is the single accrual
  authority; never fork or override its math.
- **Accrual fires on every settle path** (Paystack, PayPal, manual/EFT, and webhook renewals) — one
  idempotent row per `(source_ledger_id, kind)`. `kind` ∈ `subscription | setup_fee | upgrade`
  (+ `conversion_bonus` for campaigns).
- **Default rate = per-product base × tier bonus** (tier bonus = a multiplier from lifetime **cleared**
  earnings; `lib/affiliate/tiers.ts`).
- **Campaign rate** (one gated branch, only when `campaign_id` is set):
  - `inherit` → behaves like default, stamped with the campaign.
  - `flat` → fixed %/amount of NET.
  - `ladder` → `effective_rate = MAX(band_rate, won_floor)` on trailing-month collected **subscription**
    revenue for that campaign's active referred hosts; whole-book, retroactive within the month, never
    re-rates `paid` rows.
- **Holds & clearing:** accrued → `pending` for `hold_days` → cron clears to `cleared`.
- **Clawback:** proportional on refund/chargeback via `reverses_ledger_id` (kind-agnostic).
- **Ledger integration:** affiliate money is **real** `platform_ledger` rows (`type` `commission` /
  `payout`) that auto-mint numbered documents (`wielo_credit_notes`, CN- numbers) — a commission
  statement per earning and a remittance per payout. These are excluded from customer-revenue KPIs.
- **Payouts:** cleared balance − fees, gated by a **minimum threshold** (`GREATEST(personal, admin_min)`),
  request → admin settles → `paid` emits the remittance document + notification.
- **Notifications:** "commission earned" (DB trigger, fires on every accrual regardless of runtime) and
  "payout paid" → in-app + push + email.

**The UI's job:** turn all of the above into numbers a partner trusts and an admin can act on — without
ever letting the user think they can change the math from a screen they shouldn't.

---

## 5. The partner journey (what the manager wraps)

1. **Become a partner.** Sign up via `/signup/partner` (or a campaign variant `/signup/partner/[campaign]`).
   Account starts **`pending`**; it activates only after the **activation checklist** clears:
   agreement signed + platform terms accepted + **email confirmed** + (if a campaign) campaign rules
   accepted. Activation is re-evaluated at every gate (signup, email-confirm, agreement, admin action).
2. **Get links.** A base referral link `/r/<slug>`, plus a **link builder** (any Wielo page/path or a
   specific product, each with copy + QR + stats), plus **campaign links** `/c/<campaign>/<slug>` for
   campaigns they've joined.
3. **Share & attribute.** A click drops a cookie (affiliate + optional campaign); on a referred host's
   signup the referral binds once, forever (last-click; original binding wins).
4. **Earn.** When a referred host pays, commission accrues (default or campaign structure), holds, then
   clears. Campaign-referred hosts may also trigger a conversion bonus.
5. **Compete.** For a campaign with a competition, the partner sees their **score, rank, current ladder
   rate, and distance to the next rung**, plus the **public leaderboard**.
6. **Get paid.** Above the payout threshold, request a payout; admin settles; a remittance document is
   generated; the partner is notified.

---

## 6. The PARTNER-facing manager — current surfaces + rework goals

> The affiliate manager currently exists under **`/portal/affiliates/*`** (guest/partner context) **and a
> parallel `/dashboard/affiliates/*`** (host context — hosts can also be affiliates). **A key rework
> decision: consolidate these into one coherent, consistent experience** (shared components, identical
> data, one mental model) rather than two drifting trees.

### Current partner surfaces (grounded in the codebase)
- **Overview / dashboard** — `portal/affiliates/page.tsx` (+ `dashboard/affiliates/page.tsx`). Today shows
  the referral link card, earnings/balance, tier card, and entry points to the sub-pages.
- **Products** — `portal/affiliates/products/page.tsx` + `ProductLinkRow.tsx`. Per-product commission
  rates and per-product deep links.
- **Link builder** — `_components/AffiliateLinkBuilder.tsx`, `ReferralLinkCard.tsx`, `AffiliateBaseLink.tsx`
  — build a link off any page/path/product with copy + QR + stats.
- **Marketing library** — `portal/affiliates/marketing/page.tsx` + `MarketingLibrary.tsx` — shareable
  creative/assets supplied by admin.
- **Leaderboard** — `portal/affiliates/leaderboard/page.tsx` — ranking UI shell (medals/positions).
- **Competitions** — `portal/affiliates/competitions/page.tsx` + `CampaignCard.tsx`, and a per-race page
  `portal/affiliates/race/[slug]/page.tsx` — campaigns the partner is in / can join, plus the live race
  panel.
- **Payouts** — `portal/affiliates/payouts/page.tsx` + `PayoutPanel.tsx` — balance, threshold, request,
  history, remittance docs.
- **Profile** — `PartnerProfileCard.tsx`, `LandingPageCard.tsx` — presentation fields for a co-branded
  partner page (`/partners/[slug]` / `/c/[slug]`).
- **Nav / gating** — `AffiliateNav.tsx`, `AffiliateTermsGate.tsx`, `layout.tsx`.

### Rework goals for the partner manager
1. **One clear "Am I earning?" answer above the fold.** Real cleared earnings in rands first; pending
   second; a **calculator** ("if all your live hosts convert at R599, your book is R{X}/mo") clearly
   labelled **"potential"** — never "pending/estimated". CPA-safe income framing (illustrative).
2. **Make the two-layer model legible.** The partner should instantly understand: my default link vs my
   campaign link, and which referrals earn under which rule. Don't hide campaigns behind a tab nobody
   finds — the Founding Race is the headline for launch.
3. **Rate/score status panel.** Current rate, distance to the next ladder rung (rands of book), my score,
   my rank, any won floor. Clone the existing tier-card pattern.
4. **Links that are trivial to grab and share.** Copy + QR + short stats (clicks → signups → active
   listings → earnings) on every link. Mobile-first — partners share from their phones.
5. **Payouts that feel safe.** Clear threshold, what's available now vs held, fees shown, one-tap request,
   downloadable statements/remittances.
6. **Motivating, trustworthy tone.** This audience is non-technical FB-group owners. Plain language,
   rands everywhere, no jargon, no dark patterns. Compliance language (CPA / POPIA) where income is shown.
7. **Consolidate portal vs dashboard** into shared components so a host-affiliate and a pure partner see
   the same, correct thing.

---

## 7. The ADMIN-facing manager — current surfaces + rework goals

### Current admin surfaces (grounded in the codebase, under `/admin/affiliates/*`)
- **Affiliates list / panel** — `admin/affiliates/page.tsx` + `AffiliateAdminPanel.tsx` + `actions.ts` —
  all affiliates, statuses (`pending/active/suspended`), activate/suspend, drill-in.
- **Per-affiliate drill-down** — `admin/affiliates/[id]/page.tsx` — one partner's funnel: referrals,
  commissions, payouts, campaign enrolments. (Also links to the generic user record's Finance/History
  tabs where affiliate ledger rows appear.)
- **Campaigns** — `admin/affiliates/campaigns/` — **CampaignBuilder.tsx**, `CampaignsList.tsx`,
  `CampaignRulesEditor.tsx`, `[id]/page.tsx`, `EnrollmentPauseButton.tsx`, `FieldHelp.tsx`, `actions.ts`.
  Create/configure campaigns: dates, eligibility, commission structure (ladder/flat/inherit), competition
  overlay (events, scoring mode, prizes, tie-breaker, leaderboard visibility), rules-doc slug.
- **Payouts queue** — `admin/affiliates/payouts/page.tsx` + `PayoutsManager.tsx` — approve/settle payout
  requests; settling emits the remittance + notification.
- **Settings** — `admin/affiliates/settings/page.tsx` + `AffiliateSettingsClient.tsx` +
  **`AffiliateTiersEditor.tsx`** — global program settings (attribution model, hold days, min payout,
  terms version) and the default-program **tier** editor.
- **Marketing** — `admin/affiliates/marketing/` + `MarketingManager.tsx` — manage the creative library
  partners see.
- **Terms** — `admin/affiliates/terms/` + `AffiliateTermsEditor.tsx` — edit the affiliate agreement
  (versioned; drives the activation gate).
- **Nav / gating** — `AffiliateAdminNav.tsx`, `layout.tsx` (admin gate = active `platform_staff` +
  per-role permission).

### Rework goals for the admin manager
1. **One control room, clear IA.** Affiliates · Campaigns · Payouts · Tiers/Settings · Marketing · Terms —
   navigable, each screen answering one question. Reduce hunting.
2. **Per-affiliate = a real funnel.** clicks → signups → active listings → commissions (pending/cleared/
   paid) → payouts, with the money reconciling to the ledger. Make anomalies (e.g. payouts without
   commissions — there is orphaned demo data today) obvious.
3. **Campaign builder that's safe to use.** The commission-structure + competition config is powerful and
   money-adjacent — the builder must make the resulting rules unambiguous (plain-language preview of
   "a referral through this earns X"), validate ladders/prizes, and never silently change live rules.
   Prize-awarding (cash + floor) is an explicit, audited admin action.
4. **Payout queue that's auditable.** Who requested, what's owed vs held, fees, one clear settle action,
   remittance generated, every action written to `admin_audit_log`.
5. **Everything admin-editable is config, never hardcoded** (rates, thresholds, tiers, campaign params) —
   the founder adjusts later without code changes.
6. **Respect permissions.** Money/settings actions gated to the right roles; audit every mutation.

---

## 8. Data model the manager reads (key tables/columns)

> Additive schema; pre-MVP additive-migration policy. Confirm exact columns against `docs/SCHEMA.md`
> (generated from the live DB) before wiring — do not trust this list as final DDL.

- **`affiliate_accounts`** — one per partner: `id`, `user_id`, `slug` (public), `status`
  (`pending|active|suspended`), `signup_campaign_id`, presentation fields (`display_headline`, `bio`,
  `photo_url`), payout settings.
- **`affiliate_referrals`** — the spine: referred user ↔ affiliate, `UNIQUE(referred_user_id)`,
  **`campaign_id` (nullable)** = the layer selector, landing/attribution metadata.
- **`affiliate_commissions`** — accrued money: amount, `kind`, status (`pending|cleared|paid|void`),
  `hold_until`, `source_ledger_id`, `reverses_ledger_id` (clawback), **`campaign_id`** (stamped for
  campaign rows).
- **`affiliate_payouts`** — payout requests + settlement, fees, remittance doc link.
- **`affiliate_settings`** — global program config (attribution model, hold days, min payout, terms
  version).
- **`affiliate_tiers`** — default-program tiers (qualify by lifetime cleared earnings → bonus %).
- **`affiliate_campaigns`** — campaign config: `slug`, `name`, `status` (`draft|active|ended|archived`),
  `starts_at/ends_at`, eligibility, **`commission_structure` jsonb** (model/bands/flat_rate/scope/
  duration), **`competition` jsonb** (events/scoring_mode/prizes/tie_breaker/leaderboard_visibility),
  `rules_doc_slug`.
- **`affiliate_campaign_enrollments`** — `(affiliate_id, campaign_id)`, status → drives the partner's
  Competitions tab + campaign link.
- **`affiliate_campaign_floors`** — won prize floors per `(affiliate, campaign)`.
- **`affiliate_campaign_rule_acceptances`** — CPA rules acceptance per campaign (activation gate).
- **`affiliate_campaign_daily_scores`** — daily active-listing snapshots (only for `net_change` scoring).
- **Marketing assets**, **`affiliate_clicks`** (hashed-visitor click log), and **`legal_documents`** (the
  CPA fixed-URL rules page) round it out.
- Affiliate money also lands in **`platform_ledger`** (`commission`/`payout`) + **`wielo_credit_notes`**
  (CN- documents).

---

## 9. Design principles & non-negotiable constraints

- **Money-safety:** the UI never changes commission math. Screens read and display; the only money
  *mutations* an admin performs are the existing, audited actions (activate, settle payout, award prize).
  Prove no default-program money path is affected by any rework.
- **CPA / income claims:** any earnings projection is labelled **"potential"**, conditional, illustrative —
  never "guaranteed/estimated/pending" for a forecast. Competition rules live at a **fixed URL**
  (`legal_documents`, 3-yr retention), free to entrants.
- **POPIA:** no PII in URLs; partner sees only their own data; hashed visitor IDs for click logging.
- **Mobile-first:** partners are non-technical and share from phones. Every partner surface must be
  excellent at 375px. (~95% of the broader platform's usage is mobile.)
- **Design system:** use the existing Wielo brand + shadcn/ui components + tokens (see `DESIGN_SYSTEM.md`).
  Theme-aware. Do not hand-roll what shadcn provides.
- **Permissions:** admin surfaces gated by active `platform_staff` + per-role permission; every mutation
  writes `admin_audit_log`.
- **Consolidation over duplication:** unify `/portal/affiliates` and `/dashboard/affiliates` behind shared
  components; one source of truth per widget.
- **Plain rands, plain language.** Talk in ZAR. No jargon on the partner side.

---

## 10. Current state & known gaps (so the rework starts from truth)

- The system is **substantially built** (not greenfield): default program (per-product rates, tiers,
  accrual/holds/clawback/payout, ledger docs, notifications, statement PDFs, link builder) **and** a large
  part of the campaign layer (campaign builder, `/c/[slug]` links, competitions tab, race pages,
  leaderboard, `campaignConfig` with tests). **Verify each surface against the live code before assuming
  it's complete or that it's missing.**
- **Demo/test data is messy in the DB** (e.g. payouts with no matching commissions; leftover CN- docs on
  the `wollie-steenkamp` test partner). A clean wipe of affiliate test data is needed before launch —
  don't design around the current row anomalies; design for the correct model.
- **Portal vs dashboard duplication** (two affiliate trees) needs a consolidation decision.
- Some launch-critical polish (leaderboard public route, competitions clarity, the earnings calculator's
  framing, admin campaign-builder safety) is exactly what this rework should sharpen.
- Governing specs to read alongside this brief: `docs/strategy/AFFILIATE_CAMPAIGN_BLUEPRINT.md` (the
  campaign-layer spec), `docs/strategy/Wielo_Founding_Programme_Strategy_v4.md` (§4 partner dashboard =
  calculator, §8 competition/legal), and `docs/strategy/LAUNCH_EXECUTION_PLAN.md` (WS-1).

---

## 11. What a great rework delivers

- **A partner opens the manager and, in five seconds, knows:** what they've earned (real rands), what's
  coming, their rank and rate in the Founding Race, and how to grab a link to share. It feels motivating
  and honest.
- **An admin opens the control room and can:** see every partner's funnel and money reconciled to the
  ledger, configure a campaign without fear of breaking the default program, approve payouts with a full
  audit trail, and award prizes cleanly.
- **Both sides share one consistent design language, one data source, and one mental model** (default
  program + campaign layer), with the money engine untouched underneath.

---

*Brief prepared 2026-07-23. UI/UX rework of the affiliate manager (partner + admin). Money engine is
read-only domain truth — surface it, don't rebuild it.*
