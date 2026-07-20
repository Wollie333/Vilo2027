# Wielo — Founding Programme Launch Execution Plan (DRAFT for discussion)

> Compiled 2026-07-20 from the **Founding Programme Strategy v4** + **Master Brand Strategy v1.0**,
> cross-referenced against a four-way read-only audit of the live codebase. **No code written yet.**
> This is the plan to discuss and lock before any build begins. Principle throughout:
> **build on what exists, least code, money/security correctness over speed.**
> Governing memory: `project-founding-programme-strategy`, `reference-master-brand-strategy`.

---

## 0. The shape of the thing

The 8-month programme has **three engines** that must all be true at launch:

1. **Supply engine** — Founding Partners (≤25) refer hosts; hosts get 4 free months, then lock Founding pricing. Runs on the **affiliate system + a new competition layer**.
2. **Demand engine** — the **Looking For** marketplace, fed by guest-side ads + partners. This is the beta's hero feature and its biggest risk (two-sided liquidity).
3. **Trust engine** — the **Build Board + Changelog** make "beta" structurally true, plus honest legal docs and a public leaderboard.

The website CMS is explicitly **out of beta scope** and ships mid-beta as a campaign beat — so it is NOT on this critical path (it continues on its own track).

### The single most important framing for the build
Of everything below, **exactly one item is a genuine rebuild** (the affiliate commission-rate model). Everything else is either **already built and reused**, or a **net-new surface that bolts onto existing tables**. We are not reverting or double-coding the platform — we are extending it.

---

## 1. What already exists (REUSE) vs. what is genuinely NEW

| Area | Already built — reuse as-is | Genuinely new to build |
|---|---|---|
| **Affiliate** | Referral attribution (`/r/[slug]` cookie → `bindAffiliateReferral`), `affiliate_referrals`, accrual/hold/clawback/payout plumbing, admin screens, marketing library, terms gate | **Commission-rate model (rebuild)**; campaign engine; live-query leaderboard data; commission floor; conversion bonus; earnings calculator; co-branded `/partners/[slug]` |
| **Looking For** | Request model (region/lat-lng/**radius**/dates/budget/expiry/public-private), 30-day auto-expiry cron, the full **step-wizard** (step-tabs + health ring + autosave + preview), host respond screen with **pre-filled quote**, real-time alert dispatch (<60s) | Post-first **inversion** of the funnel; **passwordless** step-7 account; **default** regional host alerting (not opt-in only); per-step **instrumentation**; child-ages/pets fields |
| **Accounts / auth** | Magic-link primitive (enquiry leads → `generateLink` → `/auth/confirm` → `/claim`), guest role + permission catalog | Name+email-only signup variant; "Wielo account" **string rename**; "Do you own accommodation?" capture |
| **Build Board** | *(nothing — but `article_votes` one-vote-per-user + count-trigger is the pattern to clone)* | The entire Build Board (submit/vote/status/moderation) |
| **Changelog** | `/change-log` public page (renders repo `CHANGELOG.md` at build) | Data-backed changelog that **credits a host by name** + deep-links "Shipped" items |
| **Legal docs** | Host policies (fully built + immutable-per-booking); platform Terms/Privacy/Affiliate-terms **admin-editable + versioned** via `platform_settings.legal_*` + `RichTextEditor` | Generic `legal_documents` store + `/legal/[slug]` route (competition rules, Founding Host terms, review-disclosure); per-partner **signed** affiliate agreement |
| **Pricing** | One-plan model is a data choice (live `beta` product); feature grants union across active subs (so "future features free" is half-covered) | **Two-price** (list vs Founding) on one plan; **Founding price-lock** on the subscription row; **per-additional-listing** billing calc; partner-profile fields |
| **Instrumentation** | Host-website analytics + Meta/GA pixels (for *host* sites) | Platform-owned funnel-event stream ("logs") for Wielo's own pages |

---

## 2. Workstreams (each: goal · reuse · new · least-code approach · money/security · effort)

### WS-1 — Affiliate → Competition Platform  *(the flagship build)*

**Goal.** Turn the existing affiliate system into a competition-capable platform: revenue-banded commission ladder, permanent prize floors, a reusable campaign engine, a public leaderboard, and an enhanced partner portal.

**Reuse.** Attribution spine, `affiliate_referrals`, `affiliate_commissions` (accrual/hold/clawback/payout), admin screens, the `leaderboard/page.tsx` **UI shell**, `computeCommission`.

**New / changed.**
- **1a. Commission-rate model (the one unavoidable rebuild).** Today: per-product rate × lifetime-earnings tier bonus. Needed (§4.4): ONE revenue-banded rate on the partner's **whole book**, recalculated **monthly** on collected revenue, retroactive on band-crossing, drops on churn.
  - *Approach:* add an **effective-rate resolver** instead of reading `products.affiliate_value` at accrual. A monthly cron (`recompute-affiliate-rates`, mirrors existing affiliate crons) sums each partner's trailing-month collected revenue → writes `current_ladder_rate` on `affiliate_accounts`. Accrual uses `MAX(current_ladder_rate, commission_floor_rate)`. Re-rate the month's still-`pending`/`cleared` rows on band change; never touch `paid`.
  - **DECISION NEEDED:** does the ladder **replace** the `affiliate_tiers` bonus, or coexist? Running both double-counts. *(Recommend: ladder replaces tiers for the Founding cohort; retire the tier-bonus multiplier.)*
- **1b. Commission floor (prize).** Add `affiliate_accounts.commission_floor_rate`; awarding a prize floor writes `GREATEST(existing, won)`. Effective rate = `MAX(ladder, floor)`.
- **1c. Conversion bonus (R250/R400).** Add `kind='conversion_bonus'` to `affiliate_commissions`; accrue a flat amount the first time a referred host's paid subscription activates. Reuses the entire hold/clear/payout/clawback pipeline.
- **1d. Campaign engine.** New `affiliate_campaigns` config row (slug, window, eligibility, **scoring_mode `total|net_change`**, weights, prizes, tie-breaker, visibility) + `affiliate_campaign_prizes_awarded`. **Score = nightly live query** over `affiliate_referrals → hosts → properties (published/active)` — **no points ledger** (churn auto-decrements; this is the strategy's explicit design and it removes all clawback/dispute machinery). `net_change` mode snapshots daily standings.
- **1e. Public leaderboard.** Clone the existing leaderboard UI; point it at campaign score; add an **unauthenticated** public route (live day one).
- **1f. Enhanced partner portal.** Extend the overview (the existing tier card is the pattern): my score · rank · current rate · **points-to-next-rate-rung** · an **earnings CALCULATOR** ("if all my live hosts convert at R599 = RX/mo" — word "potential", conditional framing, CPA-safe). Reuse `computeCommission`.
- **1g. Co-branded `/partners/[slug]`.** New public route; add `display_headline/bio/photo_url` to `affiliate_accounts`; page drops the same `vilo_ref` cookie as `/r/[slug]` so attribution is unchanged.

**Money/security.** The rate rebuild touches money — build it behind the effective-rate resolver so accrual stays idempotent and clawback logic is untouched; the `is_prorated_upgrade`/`kind` discipline from the recent hardening applies. Campaign scoring is **read-only** (no money), so it carries near-zero financial risk. Anti-gaming (§8.5): activations verified (address+photos), no self-referral, floors non-transferable.

**Effort.** Largest workstream. Rate model + campaign engine + leaderboard + portal ≈ the bulk of the platform work. Admin campaign UI can be **config-in-code** for the first run (§8.7.6).

---

### WS-2 — Looking For: post-first funnel + host quote loop  *(highest-ROI, largest demand risk)*

**Goal.** Invert the funnel to post-first (do the thing, account as a byproduct) and guarantee every published request reaches matching hosts instantly — the metric that decides everything is **% of requests getting ≥2 quotes in 24h**.

**Reuse (the hard parts are done).** The 7-step wizard (`RequestForm.tsx`: step-tabs, `ProgressRing`, `useAutosaveDraft`, review step), `LocationPicker` + radius, the host-preview `ShowcaseCard`, the host respond screen with pre-filled quote, the <60s `notification_queue` → `drain-email-queue` path, 30-day expiry cron, public/private masking.

**New / changed.**
- **2a. Invert to post-first.** Make `/looking-for/start` the wizard itself (public, unauthenticated); repoint every CTA away from `/signup/guest`; add **anonymous localStorage draft persistence** (current autosave is keyed to `userId`).
- **2b. Silent passwordless step-7.** New server action: name+email → mint account via the **enquiry-style** `findOrCreateLeadIdentity` + `generateLink` → session → `createRequestAction` → redirect to the live request. (Reuses the proven `/auth/confirm` + `/claim` path.)
- **2c. Default regional host alerting.** Today instant alerts only fire for hosts who manually created a saved search; the province digest is up to 24h late. **Make instant regional matching the default on publish** for any host with a published property in range (collapse the digest's targeting into the real-time path). Matching math, email template, and respond screen already exist — only the default trigger is new.
- **2d. "N hosts preparing offers"** waiting-state surface on the guest's own request.
- **2e. Small field additions** if taken literally: child-ages array + pets on the post; budget range **slider** + live implied per-night/total; an "I'm not sure yet" destination option.

**Money/security.** No money here. POPIA: keep first-name/region/dates/budget public, never PII; add explicit **consent-before-submit** on the request (today it's captured at signup). Magic-link TTL → 24h single-use; SPF/DKIM/DMARC must be verified before launch (infra, not code).

**Effort.** Medium. Mostly composition + inversion, not greenfield. **Ships with 2c or not at all** — a request with no quote damages the brand.

---

### WS-3 — Build Board + Changelog  *(the "beta is real" trust engine; ship PRE-launch)*

**Goal.** Public roadmap voting (5 statuses incl. honest "Not doing") + a changelog that credits the host who asked, by name.

**Reuse.** `article_votes` uniqueness+count-trigger pattern (perfect for one-vote-per-user + sort-by-votes); `guest` role for submit/vote gating; `admin_notifications` for the 7-day SLA; the `/change-log` public page shell.

**New.**
- **3a. Build Board:** `feature_requests` + `feature_request_votes` (clone `article_votes`), 5-status enum, **role-tagged votes** (host vs guest so guest volume doesn't drown host signal), merge-duplicates admin action, moderation queue. Public read; account to submit/vote. Seed 20-30 items across all statuses before launch.
- **3b. Changelog → data-backed:** `changelog_entries` (title, body, `credited_host_id`/property, `shipped_at`, slug) so entries credit a host and a "Shipped" Build Board item deep-links to its release. Keep the file-parse as fallback.

**Money/security.** None. Pure content + gating.

**Effort.** Medium-small. The vote pattern is a direct clone.

---

### WS-4 — Wielo account rename + passwordless  *(small, in the funnel's critical path)*

**Goal.** Rename user-facing "guest" → "Wielo account" (role stays `guest` internally); add "Do you own accommodation?" at signup to turn the guest funnel into a host lead source; make magic-link the funnel default.

**Reuse.** Existing role/permissions; magic-link primitive.

**New.** A contained string pass (signup, portal header/nav, emails, Looking For page, "Guest dashboard"→"Your Wielo account"); one new signup field + lead flag; the name+email magic-link variant (shared with WS-2b).

**Money/security.** None. No schema change for the rename.

**Effort.** Small.

---

### WS-5 — Pricing: one plan · Founding lock · per-listing add-on  *(money-correct before any charge)*

**Goal.** R999 list / R599 Founding / R499 annual on ONE plan; additional listings R299 (Founding R179); a real price-lock that survives list-price changes.

**Reuse.** One-plan data model; the prorated-`amountOverride` top-up primitive (built in the recent recurring work); the listing-count query already used by `assertWithinTotalCap`.

**New (all additive).**
- **5a. Founding price-lock:** add nullable `subscriptions` columns — `locked_base_amount`, `locked_per_listing_amount`, `locked_currency`, `is_founding`, `price_locked_at`. Change **one path**: renewal/checkout bill the locked amount when set, else current product price. This *is* the lock — the row becomes the source of truth; product-price edits stop leaking into Founding hosts.
- **5b. Per-listing add-on:** `renewal_amount = base + max(0, listingCount − 1) × per_listing`, computed in the two billing sites (checkout + renewal) from the locked columns. One subscription, one invoice; optional line-item breakdown on the invoice renderer.
- **5c. Two-price expression:** a way to hold "list R999 / Founding R599" for the same plan (the locked columns capture the Founding price at provisioning; list price stays on the product).

**Money/security.** This is money — highest care. Reuse the ledger/idempotency discipline from the recent hardening; the locked-amount read is a single well-tested branch. **DECISION:** mid-cycle listing-add → prorate on the spot (reuse `amountOverride`) or re-price at next renewal (cheaper, recommended MVP).

**Effort.** Small-medium, but must be tested hard (money).

---

### WS-6 — Legal docs: customise + save (attorney copy-paste)  *(founder's explicit ask)*

**Goal.** Your attorney can paste final legal text and have it take effect live + version-retained, for **every** legal doc — not just the three that work today.

**Reuse.** The proven `platform_settings.legal_*` + `RichTextEditor` + `LegalDocsForm` + sanitise-on-write/read + version-bump-on-change pipeline (already powers Terms, Privacy, Affiliate-terms). Host-level policy customization is fully built + immutable-per-booking — leave it.

**New.**
- **6a. Generic `legal_documents` store:** `slug` (unique), `title`, `body_html`, `version`, `published_at`, `updated_by`; one admin list-editor reusing `RichTextEditor`; a catch-all public route `/legal/[slug]`. This one build covers **competition rules** (the CPA-required fixed retained URL), **Founding Host terms** (with the lifetime-lock sentence), **review-disclosure**, and **Looking-For POPIA notices** at once.
- **6b. Signed affiliate agreement:** `affiliate_agreement_acceptances` (affiliate_id, version, accepted_at, IP) — CPA-grade per-partner acceptance, separate from editable body text.

**Money/security.** Legal correctness. Version stamping + retention (3 yrs for competition rules) is the compliance requirement. Attorney reviews all three legal instruments (§8.6) — the platform just needs to store + serve + retain them.

**Effort.** Small — it's an extension of an existing pattern, not a new mechanism.

---

### WS-7 — Instrumentation ("logs")  *(you can't manage the funnel you can't see)*

**Goal.** A platform-owned funnel-event stream for Wielo's own pages (the strategy demands per-step Looking For instrumentation + the 2-quotes-in-24h metric; today only *host-website* analytics exist).

**Reuse.** The existing event-insert + worker-drain patterns.

**New.** A lightweight `funnel_events` capture (page view → step started → each step → preview → account created → request published) + an admin read-out of the key ratios (landing→step1, step1→published, cost-per-request, published→2-quotes-24h). Keep it minimal — enough to decide ad spend.

**Money/security.** None (anonymised event telemetry; no PII in events).

**Effort.** Small-medium.

---

### WS-8 — Marketing surfaces (partner landing pages, calculator, marketing pack hooks)

Mostly covered by WS-1g (co-branded pages) + WS-1f (calculator). The **commission-maths calculator** (host enters revenue → sees annual loss) is a shareable public tool the partners' pack links to — small standalone build. Marketing-pack *content* (copy, images, video) is non-code and out of scope here.

---

## 3. Sequencing — mapped to the strategy's Critical Path (§14)

> Order is driven by §14 gates. Money-correctness (WS-5) can trail recruitment because no host is charged until ~month 5 (Decision Window) — but the **commission ladder model + calculator (WS-1a/1f)** must exist at recruitment because partners are pitched on them from day one.

**PHASE 0 — Decisions & config (blocks everything).**
- Lock: per-listing price (proposed R299/R179), the **lifetime-lock boundary sentence**, the **pilot region** (Drakensberg recommended), the **reviews-for-exit number** (25 suggested), ladder-vs-tiers decision (WS-1a), competitor-pricing sanity-check on R999.

**PHASE 1 — Pre-launch builds (§14 gate 2: before ANY partner is approached).**
Parallelisable:
- WS-2 Looking For post-first funnel **+ host quote loop** (2c is non-negotiable).
- WS-3 Build Board (seeded) + Changelog (data-backed).
- WS-4 Wielo account rename + magic link.
- WS-1d/1e Campaign engine MVP + **live public leaderboard**.
- WS-6a legal store (so competition rules + Founding Host terms have a home).

**PHASE 2 — Partner enablement (before conversions land, ~month 1-4).**
- WS-1a/1b/1c commission ladder + floor + conversion bonus.
- WS-1f enhanced portal (calculator) + WS-1g co-branded pages.
- WS-5 pricing (Founding lock + per-listing add-on) — must be green before the first Decision Window (~month 5).
- WS-6b signed affiliate agreement.
- WS-7 instrumentation (before ad spend).

**PHASE 3 — Launch ops (§14 gates 3-4).**
- 20-30 hosts live in the pilot region → then guest ad spend (WS-7 metrics gate it; 2-quotes-24h >70% before scaling).
- 12 partners signed · marketing pack · competition rules published at fixed URL · agreements signed → **beta launch**.

**ONGOING / PARALLEL (not blocking launch).**
- WhatsApp alerts (month 2-3, Meta Cloud API, after email conversion measured).
- Website CMS ships mid-beta as a campaign beat.

---

## 4. Open decisions for the founder (consolidated — these gate the build)

| # | Decision | Recommendation | Why it matters now |
|---|---|---|---|
| D1 | **Ladder vs tiers** — does the revenue-banded ladder replace the lifetime-earnings tier bonus? | Replace, for the Founding cohort | Running both double-counts commission (money bug) |
| D2 | **Lifetime-lock boundary sentence** (Founding Host terms) | Write it now | Cannot be retrofitted; §13 open blocker |
| D3 | **Per-listing price** R299 / Founding R179 | Confirm | Gates WS-5 + partner pitch to Thandi |
| D4 | **Pilot region** | Drakensberg | Gates host recruitment + ad geo (§14 gate 1) |
| D5 | **Mid-cycle listing-add billing** — prorate on the spot vs re-price at renewal | Re-price at renewal (MVP) | Cheapest correct path; reuse `amountOverride` later |
| D6 | **Reviews-for-exit** number | 25 | Published beta-exit gate |
| D7 | **Competition admin** — config-in-code vs admin UI for first run | Config-in-code first | §8.7.6 says defer the UI |
| D8 | **Strategy docs in-repo?** — commit v4 + brand v1.0 into `docs/strategy/`? | Your call (confidential) | Keeps the source-of-truth versioned with the code |

---

## 5. What I recommend we lock before writing any code

1. **The eight decisions above** (especially D1 — it's a money-correctness fork).
2. **Workstream order** — I propose starting with **WS-1 campaign engine + leaderboard (read-only, zero money risk)** and **WS-2 Looking For inversion** in parallel, because they're the §14 gate-2 blockers and the campaign scoring path carries no financial risk while we get the pattern right.
3. **A money-correctness rule for WS-1a and WS-5:** every rate/price change ships behind a resolver/locked-column with the same idempotency + clawback discipline as the recent recurring-billing hardening, verified with sandbox round-trips before going near a real charge.

---

*Draft — for discussion. Nothing here is built yet. Source strategy: Founding Programme v4 · Master Brand Strategy v1.0.*
