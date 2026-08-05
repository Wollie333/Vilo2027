# Pipeline lifecycle — host & affiliate lead journey

> How a person moves across the sales pipeline board from first touch to
> customer — and, now, back down again when they lapse. Most forward moves and
> **every** downward move are driven by DB triggers reacting to real events
> (host created, subscription trialing/paid/cancelled), not by hand. The sales
> team drives the human-judgment middle stages manually; the system owns the
> ends.

Related flows: [`onboarding.md`](onboarding.md) (signup → wizard),
[`subscriptions.md`](subscriptions.md) + [`recurring-billing.md`](recurring-billing.md)
(the subscription states this reacts to), [`affiliate.md`](affiliate.md)
(referral attribution + the `/r/<slug>` credit link), and the Meta CAPI plan
`docs/features/PIPELINE_META_CAPI_PLAN.md` (conversion events fired alongside).

Board UI: `app/[locale]/admin/pipeline/*` — `PipelineBoard.tsx` (columns),
`[leadId]/_components/LeadRecordClient.tsx` (the record). Data:
`lib/pipeline/queries.ts`. Server actions: `app/[locale]/admin/pipeline/actions.ts`.

---

## The two boards

A `pipeline_leads` row is one person on one board, keyed `(user_id, audience)`.
`audience` is `host` or `affiliate`. A lead is a `user_profiles` row (a
passwordless `is_lead` guest **or** a claimed account) — never a separate table.

### Host stages (`pipeline_stages` where `audience='host'`, by `sort_order`)

| # | key | label | flags |
|---|-----|-------|-------|
| 0 | `new` | New | — |
| 1 | `signed_up` | Signed up | — |
| 2 | `contacted` | Contacted | — |
| 3 | `qualified` | Qualified | — |
| 4 | `demo_booked` | Demo booked | — |
| 5 | `nurturing` | Nurturing | — |
| 6 | `trial` | Trial | `system_managed`, `is_customer` |
| 7 | `won` | Won (became host) | `system_managed`, `is_won`, `is_customer` |
| 8 | `churned` | Churned | `system_managed` |
| 9 | `lost` | Lost | `is_lost` |

`pipeline_leads.status ∈ {open, won, lost, churned}`. Stages 0–5 are manual
(sales judgment). Stages 6/7/8 are **system-managed**: `moveLeadStageAction`
refuses a manual drop into them (`actions.ts` guard on `stage.system_managed`).
Cards in a customer/won/churned stage are non-draggable on the board; a churned
card stays re-engageable (a fresh trial reopens it).

### Affiliate stages

`new → contacted → joined (Joined program) → won (Won — actively promoting)`.
Affiliate `won` is system-managed (fires when a referred host actually pays —
`20260801260000`). There is **no** affiliate churn stage by design: an affiliate
"wins" by referring a paying member; they don't lapse the way a paying host does.

---

## State machine (host)

```
                 (manual: sales team)
  New ─► Signed up ─► Contacted ─► Qualified ─► Demo booked ─► Nurturing
   │         ▲                                                     │
   │         │ on_host_created                                     │ on_subscription_trialing
   │         │ (host row)                                          ▼
   │         └──────────────────────────────────────────────►  Trial ──┐
   │                                                              │      │ host pays
   │  on_subscription_trialing (win-back reopen, status<>'won')   │      ▼
   │      ┌───────────────────────────────────────────────────────┘    Won
   │      │                                                              │
   ▼      │                                on_subscription_churned       │ cancel/expire
 (any) ───┴──────────────►  Lost  ◄────── (never paid)                   │ (paid)
                            Churned ◄───── (paid then cancelled) ◄────────┘

  past_due / paused / restricted-while-paid  ──►  at_risk = true (no stage move)
  active / trialing again                     ──►  at_risk = false (recovery)
```

`at_risk` is a boolean flag on the card, orthogonal to stage — a Won or open card
whose payment is faltering. It is **not** a stage; it renders as a red "⚠ At risk"
badge and clears on recovery.

---

## Steps

### Step 1 — Person enters the pipeline (card created at New)
- Trigger: starts host signup at `/signup/host` (app-layer start hook, host-only) · Actor: guest
- Functions/files: signup start action (see [`onboarding.md`](onboarding.md)) inserts the lead; or `on_host_created` creates one if none exists (`20260801240000`, enriched in `20260805150000` §6).
- Logic: host-only start hook drops a card at **New**. Source captured from `affiliate_referrals` — competition campaign → `source_kind='competition'` (+ `suppress_default_nurture`), affiliate slug → `affiliate_referral`, else `direct`.
- DB writes: `pipeline_leads` (stage=`new`, `source_kind`, `source_label`, `affiliate_ref`), `pipeline_activities(kind='created')`.
- Side-effects: default nurture drip may enrol (unless suppressed) — see Step 7.
- Next: → Step 2 on host-row creation, or manual advance by sales.

### Step 2 — Host account created (→ Signed up, or Trial)
- Trigger: `hosts` row inserted (onboarding completes) · Actor: system
- Functions/files: `on_host_created()` trigger (`20260801240000` + `20260805150000` §6).
- Logic: advances an **open** card sitting before the target stage. Target = **Trial** if the new host already holds a `trialing` subscription (belt-and-suspenders; the trialing trigger is usually the real path since the sub is created after the host), else **Signed up**. If a card already sits at/after the target, leave it. If no card exists (host made outside the start flow), create one at the target, recording source.
- DB writes: `pipeline_leads.stage_id`, `pipeline_activities(kind='stage_moved'|'created', meta.system=true)`.
- Next: → manual middle stages, or → Step 3 when a trial starts.

### Step 3 — Trial starts (→ Trial)
- Trigger: `subscriptions.status` becomes `trialing` · Actor: system (signup / billing)
- Functions/files: `on_subscription_trialing()` trigger `trg_subscription_trial` (`20260801180000`, extended in `20260805150000` §7).
- Logic: resolve the host's `user_id`; move **any non-won** host card into **Trial** and set `status='open'`, `at_risk=false`. This includes **reopening a `lost` or `churned` card** — the win-back path. Guard `TG_OP='UPDATE' and OLD.status='trialing'` avoids re-firing.
- DB writes: `pipeline_leads(stage_id=trial, status='open', at_risk=false)`, `pipeline_activities(kind='stage_moved')`, `meta_conversion_events('StartTrial')` (idempotent on `event_id`).
- Side-effects: **conversion cancels the drip** — the nurture worker marks the enrolment `converted` once the card reaches a customer stage / won (Step 7).
- Next: → Step 4 (pays) or → Step 5 (trial lapses).

### Step 4 — Host pays (→ Won)
- Trigger: a positive `platform_ledger` charge settles (`status='completed'`) · Actor: system (webhook/reconcile)
- Functions/files: `on_platform_ledger_settled()` trigger `trg_platform_ledger_settled` (`20260801190000`).
- Logic: move the host card to **Won** and `status='won'` (only if not already won). Won is earned by payment, never asserted by hand — there is no manual "Mark won" button (`LeadRecordClient.tsx`).
- DB writes: `pipeline_leads(stage_id=won, status='won')`, `pipeline_activities(kind='stage_moved')`, plus Purchase/Subscribe Meta events.
- Next: → Step 6 (recovery/at-risk) or → Step 5 (churn).

### Step 5 — Downward transitions (Churned / Lost / at-risk / recovery)
- Trigger: `subscriptions.status` changes · Actor: system (billing, dunning, or the `expire-trials` cron which sets `status='restricted'`)
- Functions/files: `on_subscription_churned()` trigger `trg_subscription_churned` (`20260805150000` §8), helper `pipeline_user_has_paid(user_id)` (§5 — "any completed positive charge?").
- Logic (in order; guards on real status change, host subs only):
  - `active`/`trialing` → **recovery**: clear `at_risk` on the host's cards. (A fresh trial's stage move is Step 3's job.)
  - `past_due`/`paused` → **at-risk**: set `at_risk=true` on won/open cards; no stage move.
  - `cancelled`/`expired`/`restricted` → terminal branch, **unless another `active`/`trialing` sub still exists** (then do nothing — still a customer):
    - `restricted` **and** has paid → treat as dunning/overdue, not a hard end → `at_risk=true`, wait for cancel/expire.
    - has paid → **Churned** (`status='churned'`, stage `churned`).
    - never paid → **Lost** (`status='lost'`, stage `lost`) — a lapsed trial.
  - Only moves a card not already in a terminal end state (`status not in ('churned','lost')`).
- DB writes: `pipeline_leads(stage_id, status, at_risk)`, `pipeline_activities(kind='stage_moved', meta.{from_status,to_status,paid,system})`.
- Side-effects: **churn/lost cancels the drip** (Step 7); the lead record shows a rose "Churned" callout or a red "At risk" callout (`LeadRecordClient.tsx`).
- Next: → Step 3 (win-back) if they ever start a fresh trial.

### Step 6 — At-risk flag surfacing
- Trigger: `at_risk` set/cleared by Step 5 · Actor: system
- Functions/files: `PipelineBoard.tsx` (⚠ At risk badge), `LeadRecordClient.tsx` (header tag + red callout + Details "Open · at risk"). Data via `lib/pipeline/queries.ts` (`atRisk`).
- Logic: purely presentational — a Won/open card whose payment is faltering, so the team can reach out before it churns.
- Next: recovery clears it (Step 5) or it tips into Churned (Step 5).

### Step 7 — Nurture drip interplay
- Trigger: `drain-nurture` pg_cron pings `/api/nurture-worker` each minute (`20260801110000`) · Actor: system(cron)
- Functions/files: `app/api/nurture-worker/route.ts`, CTA links via `referralNextLink()` in `lib/affiliate/links.ts`.
- Logic: for each due active enrolment — stop if consent withdrawn (`unsubscribed`); **stop on conversion** (`is_customer` stage or `won` → `converted`) or **on death** (`lost`/`churned` → `cancelled`); otherwise send the current step's email and advance. Every CTA routes through the referring partner's `/r/<slug>?next=<path>` when the lead has `affiliate_ref` (credits the affiliate), else the plain Wielo link.
- DB writes: `nurture_enrollments.status/current_step/next_send_at`, `pipeline_activities(kind='email_sent')`.
- Side-effects: email(Resend transactional). Preview in `nurtureEmailProps` is affiliate-aware too.
- Next: the lifecycle (Steps 3–5) drives whether the drip keeps running.

---

## Manual moves & guards

- `moveLeadStageAction` (`actions.ts`) refuses a move **into** a `system_managed`
  stage (Trial/Won/Churned) and blocks un-winning. Manual **Lost** is allowed
  (the "Lost" button) except on won/lost cards.
- Board: customer/won/churned cards are non-draggable; churned cards remain
  draggable so the team can re-engage.
- There is **no** manual "Mark won": Won is earned by a settled payment only.

## Verification notes

- ⚠️ **Trigger paths verified via rolled-back transactions** (house style:
  `supabase db query --linked "begin; …; select …; rollback;"`), not yet a full
  live customer churn E2E (no real paying-then-cancelling host exists pre-MVP).
  The stage ordering + `system_managed`/`at_risk` columns were read from the live
  DB (2026-08-05).
- The `expire-trials` cron sets `status='restricted'`; the churn trigger reacts to
  it → Lost (never paid) or at-risk (paid). No cron change was needed.
