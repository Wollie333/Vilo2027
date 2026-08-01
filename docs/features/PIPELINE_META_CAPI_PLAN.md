# Pipeline → Meta Conversions API (server-side, stage-driven) — Build Plan

Status: **APPROVED 2026-08-01 — implementing.** Founder-driven. Fires Wielo's OWN Meta ad
conversion events server-side, driven by real conversions in the admin lead pipeline, so Meta can
optimise spend and build audiences off high-quality, ad-blocker-proof, hashed-PII signals.

Read alongside: [[TRACKING_EVENTS_PLAN]] (host micro-site tracking — a DIFFERENT surface),
`docs/features/FUNNEL_MANAGER_PLAN.md` (the pipeline this rides on).

---

## 1. Goal (founder's words, distilled)

Automatically fire "hidden" server-side Meta events as a lead progresses through the pipeline, so
the right ad audiences update themselves:

- Lead reaches **Qualified** → a qualified-lead signal.
- Lead **starts a trial** → a trial signal + the card moves to a new **Trial** stage.
- Lead **becomes a paying customer** (real money) → the conversion signal with the **real value**, and
  the card auto-moves to **Won** and locks (they're a customer — cannot be deleted).
- Same machinery must extend to **future pipelines/offers** (more landing pages, more audiences).

Per-pipeline conversion differs:
- **Host** pipeline: Won = a real subscription/product **purchase** → `Subscribe` (subs) / `Purchase`
  (one-off products), value = real ZAR.
- **Affiliate** pipeline: Won = the affiliate **registering/joining** → `CompleteRegistration`, no value.

---

## 2. Core principle

**Conversions are system-driven, not admin-driven.** A card cannot be dragged into Won — it *becomes*
Won when the real conversion lands, and the matching Meta event fires from that same moment with real
data. The board is the CRM view; **the Meta events are the audience mechanism** (you build Custom
Audiences / Lookalikes in Ads Manager off these events — CAPI does not push people into a named
audience directly; a Custom Audiences API sync is an optional later phase).

### Decisions (locked 2026-08-01)
| # | Decision | Choice |
|---|----------|--------|
| D1 | Won event (host) | **`Subscribe`** for subscriptions (SaaS-correct; won't collide with guest-booking `Purchase`) |
| D2 | Won value | **Real money only**, from `platform_ledger.amount` (ZAR) at settle time — never estimated |
| D3 | Qualified event | Custom **`QualifiedLead`** (distinct from the top-funnel form-submit `Lead`) |
| D4 | Scope | Pipeline events **+** signup tracking gaps |
| D5 | Trial → Won | Won = **first real payment**. Trial fires a separate `StartTrial` signal; card sits in the new **Trial** stage, not Won. A trialing host **is a customer** → the card is **locked against deletion** too |
| D6 | One-off product buys | Count as Won; **`Subscribe`** for subs, **`Purchase`** for one-offs; **skip** pure Wielo-credit top-ups |
| D7 | No-card converts | The Meta event **always** fires (complete audiences); the board card is **moved if it exists, never auto-created** (board = real funnel leads only) |
| D8 | Won event (affiliate) | **`CompleteRegistration`** (registration, no value) |
| D9 | New Trial stage | Add host stage `trial`; show monetary **values on cards** (computed from `platform_ledger`) |

---

## 3. Where the truth lives (verified in code, 2026-08-01)

- **CAPI already exists**: `apps/web/lib/integrations/meta-capi.ts` — SHA-256 hashes em/ph, sends
  fbp/fbc/IP/UA, dedupes via `event_id`, reads Wielo platform creds from `platform_integrations`
  (`meta_capi_enabled`, `meta_pixel_id`, `meta_capi_access_token` [encrypted], `meta_test_event_code`),
  best-effort (never throws). Today it only sends `Purchase`, only from booking thank-you pages.
- **Host money chokepoint** = `platform_ledger` reaching `status='completed' AND type='charge' AND
  amount>0`. Single, idempotent (`provider_reference UNIQUE` + compare-and-set flip), all-paths
  (signup checkout, renewals, product buys, credits — app + Deno webhook converge here).
  `platform_ledger.user_id → user_profiles.id`; `amount`/`currency` are full ZAR (CHECK `currency='ZAR'`).
  Model trigger already present: `trg_mint_vilo_invoice` (`20260616000023`).
- **Trial** = `subscriptions.status='trialing'` (created in `signup/host/actions.ts` `finalizeOnboardingAction`;
  product `Founder`). No `platform_ledger` row (no money).
- **Affiliate registration** = `affiliate_accounts.status` reaching `'active'` (self-serve pending→active
  via `lib/affiliate/activation.ts` `activateAffiliateIfReady`; in-portal born-active via
  `portal/affiliates/actions.ts` `acceptAffiliateTermsAction`; admin manual). `affiliate_accounts.user_id
  → user_profiles.id` (UNIQUE, one per user). No trigger exists today.
- **Pipeline stage move**: `apps/web/app/[locale]/admin/pipeline/actions.ts` — `moveLeadStageAction`,
  `setLeadOutcomeAction`, `deleteLeadAction`. Stages are DB rows (`pipeline_stages`, seeded in
  `20260801100000_funnels_pipeline.sql`). Lead card = `pipeline_leads` (`user_id`, `stage_id`, `status`
  open/won/lost, `audience` host/affiliate). Board/record reads: `apps/web/lib/pipeline/queries.ts`.
- **Signup pixel** (client only): `ViewContent`, `CompleteRegistration`, `InitiateCheckout`,
  `Purchase`. **No advanced matching** on `fbq('init')` (no hashed PII), **no `StartTrial`/`Subscribe`**,
  **no CAPI** for signup events. Helpers: `apps/web/lib/analytics/pixel.ts`, `purchase.ts`;
  pixel loaders `components/analytics/trackers.ts`, `PlatformMarketing.tsx`.

---

## 4. Architecture

### 4.1 Outbox + worker (mirrors the live `nurture_worker` / `notification_queue` pattern)
- New table **`meta_conversion_events`** (outbox): `id`, `event_name`, `user_id`, `lead_id` (nullable),
  `value numeric` (nullable), `currency text` (nullable), `event_id text UNIQUE` (Meta dedup + our
  idempotency), `source_ref text` (e.g. ledger id / affiliate id), `status` (pending/sent/failed/skipped),
  `attempts int`, `last_error text`, `response jsonb`, `created_at`, `sent_at`.
- **`drain-meta-capi` pg_cron** (`* * * * *`, fail-soft no-op unless due rows + Vault worker URL/secret
  set) → **`/api/meta-capi-worker`** route (clone of `app/api/nurture-worker/route.ts`; timing-safe
  bearer). Worker joins `user_profiles` for `email/full_name/phone`, hashes, calls `sendCapiEvent`,
  marks `sent`/`failed` (bounded retries). Proof-it-fired lives in a column only the worker writes
  (`sent_at`, `response`) — per [[reference-schema-and-wiring-map]] / [[feedback-silent-no-op-pattern]].

### 4.2 Generalise the CAPI helper (don't fork)
- Add `sendCapiEvent(name, {...})` to `meta-capi.ts`: also hashes `fn`/`ln` (from `full_name` via the
  existing `splitName`) and `external_id` (= `user_id`); configurable `action_source`
  (**`system_generated`** for CRM/settle events — correct when there's no browser/fbp/fbc).
- Keep `sendCapiPurchase` as a thin wrapper → the two booking callers are untouched.

### 4.3 Three DB triggers (pure SQL, transactional, exactly-once) — enqueue + move card only
No HTTP/hashing in triggers; they only INSERT an outbox row (guarded by `event_id`/`ON CONFLICT DO
NOTHING`) and move an existing card.

1. **`platform_ledger` settle** (`AFTER INSERT OR UPDATE OF status WHEN status='completed' AND
   type='charge' AND amount>0`): classify by `product_id → products.product_type` →
   `Subscribe` (subscription) / `Purchase` (one-off) / **skip `wielo_credits`**. Enqueue with
   `value=amount, currency=currency (ZAR), event_id=ledger.id`. Move existing `('host', user_id)` card
   to Won (`status='won'`) — **move-only, never create** (D7). Append `pipeline_activities` `converted`.
2. **`subscriptions` trialing** (`AFTER INSERT OR UPDATE OF status WHEN status='trialing'`): enqueue
   `StartTrial` (no value; `event_id=sub.id`). Move existing `('host', user_id)` card to the new **Trial**
   stage. Not Won, not locked.
3. **`affiliate_accounts` active** (`AFTER INSERT WHEN status='active'` OR `AFTER UPDATE WHEN
   OLD.status IS DISTINCT FROM 'active' AND NEW.status='active'`): enqueue `CompleteRegistration`
   (no value; `event_id=affiliate.id`). Move existing `('affiliate', user_id)` card to Won.

### 4.4 App-code touchpoints
- **Qualified** (`moveLeadStageAction`): when the target stage's key is `qualified`, enqueue a
  `QualifiedLead` outbox row (best-effort, `event_id='lead:'||leadId||':QualifiedLead'`).
- **Won-gate** (`moveLeadStageAction`): reject any manual move into an `is_won` stage — Won is
  system-only ("leads become Won automatically when they buy / register").
- **Customer-lock** (`deleteLeadAction`): refuse deletion when the lead's current stage is a
  **customer stage** — a new `pipeline_stages.is_customer boolean` flag, true for **Trial** and **Won**
  (a trialing host is technically a customer too). Generic: future customer stages just set the flag.
- **Card values** (`lib/pipeline/queries.ts` `getBoard`/`getLead`): compute per-lead Wielo revenue =
  `SUM(platform_ledger.amount) FILTER (status='completed', type='charge')` grouped by `user_id`;
  Trial cards show the trial product's price (expected value). Render on the board card + record header.

### 4.5 New Trial stage
Migration adds `pipeline_stages.is_customer boolean NOT NULL DEFAULT false`, inserts host stage
`('host','trial','Trial', <sort before won>, is_won=false, is_lost=false, is_customer=true)`, and sets
`is_customer=true` on all `is_won` stages (host + affiliate); re-space `sort_order`. Board renders Trial
as a normal column (dnd + select already generic over `pipeline_stages`). The **Trial** and **Won**
columns are non-deletable (customer-lock, §4.4) and the drag-into-Won path is rejected (Won-gate).

---

## 5. Final event map

| Moment | Trigger point | Meta event | Value | Card |
|--------|---------------|-----------|-------|------|
| Funnel form submit | thanks page (existing) | `Lead` (client pixel) | — | new |
| Stage → Qualified | `moveLeadStageAction` | `QualifiedLead` (CAPI) | — | Qualified |
| Host account created | signup step 1 | `CompleteRegistration` (client + new CAPI mirror) | — | — |
| Host trial started | `subscriptions`→trialing trigger | `StartTrial` (CAPI) | — | → **Trial** (auto, locked) |
| **Host paid** (sub) | `platform_ledger` settle trigger | **`Subscribe`** (CAPI) | **real ZAR** | → **Won** (auto, locked) |
| **Host paid** (one-off product) | `platform_ledger` settle trigger | **`Purchase`** (CAPI) | **real ZAR** | → **Won** (auto, locked) |
| Wielo-credit top-up | — | (skipped) | — | — |
| **Affiliate registered** | `affiliate_accounts`→active trigger | **`CompleteRegistration`** (CAPI) | — | → **Won** (auto, locked) |

All server events use `action_source='system_generated'`, hashed `em/ph/fn/ln/external_id`, and a
stable `event_id` (dedup + idempotency). PII matching is gated on the lead's `marketing_consent`
where present (POPIA); limited-data-use set otherwise.

---

## 6. Phased build order (save-point per phase — green build+lint+tsc+vitest, live-verified, commit +
CHANGELOG + memory)

1. **CAPI generalise + outbox + worker + cron.** `sendCapiEvent`; `meta_conversion_events` migration;
   `/api/meta-capi-worker`; `drain-meta-capi` cron (Vault-gated, fail-soft). No booking behaviour change.
2. **Host settle trigger + Won-gate + Won-lock + card values.** Verify with a real test payment in Meta
   Test Events (`meta_test_event_code`).
3. **Trial stage + `subscriptions` trialing trigger (`StartTrial`).**
4. **Affiliate registration trigger (`CompleteRegistration`).**
5. **Qualified event (app code).**
6. **Signup gaps:** CAPI mirror for `CompleteRegistration` (host + guest, deduped with browser
   `event_id`); consent-gated advanced matching (`em/ph/fn/ln`) on `fbq('init')`.
7. **(Optional, later) Custom Audiences API sync** — deterministic named-audience membership from
   hashed emails, if event-based audiences aren't enough.

---

## 7. Non-negotiables
- **Real money only** for the `Subscribe`/`Purchase` value — `platform_ledger.amount` (ZAR), never
  host-typed or estimated.
- **Won is system-only** (no manual drag). **Trial + Won = customer stages**, locked against deletion.
- **Board = real funnel leads** — converts with no card fire the event but create no card.
- **Best-effort everywhere** — Meta being down never blocks a payment, signup, or stage move.
- **Exactly-once** — every event carries a stable `event_id`; outbox `event_id UNIQUE` + Meta dedup.
- **Consent-aware** (POPIA) — PII matching gated on `marketing_consent`.
- **Generic** — the outbox/worker are event-agnostic so new pipelines/offers add a trigger + a
  registry row, nothing else.
- **Don't touch website-builder / host-site tracking** — that's [[TRACKING_EVENTS_PLAN]] on the
  sub-branch ([[feedback-leave-website-features-to-subbranch]]).

---

## 8. Verification (Definition of Done per phase)
- Move a real test lead / make a real test payment → the event lands in **Meta Events Manager → Test
  Events** with correct value + matched params (`meta_test_event_code`).
- Prove it fired via `meta_conversion_events.sent_at`/`response` (a column only the worker writes) —
  not "should have fired".
- Card auto-moves to the right stage in the board AND the live admin render (canvas + live, rule #9).
- Negative controls: a wielo-credit top-up fires nothing; a manual drag into Won is rejected; a Won
  lead can't be deleted; a convert with no card creates no card but still fires the event.
