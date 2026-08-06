# Pipeline Email Sequences — Standardised Lifecycle Plan

**Goal (founder):** decouple automated emails from competitions and run ONE
standardised, best-practice email sequence per pipeline, aimed at the pipeline's
real goal:

- **Host pipeline →** get the lead **subscribed** (New → Won).
- **Affiliate pipeline →** get the partner to their **first referral** (today: nothing sends).

> **Base branch note:** the nurture engine + pipeline lifecycle this plan edits
> live on **`origin/main`** (the parallel agent's work), NOT the local `main`
> (which has an older, thinner pipeline). Implementation must be done on
> `origin/main`'s base — either resolve the local↔origin divergence first, or
> branch from `origin/main`. See "Implementation base" at the bottom.

---

## Current state (verified on `origin/main`)

- **Engine is config-driven + audience-agnostic.** `nurture_sequences(audience,
  is_active)` + `nurture_steps(sequence_id, step_order, delay_hours, email_type,
  subject_override)`; `delay_hours` is measured from the PREVIOUS step (step 1 =
  from enrolment). Worker: `apps/web/app/api/nurture-worker/route.ts`, drained by
  cron `drain-nurture` (`* * * * *`). Copy: `apps/web/lib/funnels/nurtureCopy.ts`
  (`NURTURE_COPY`), rendered via `emails/templates/FunnelNurture.tsx`.
- **Host drip exists but is thin + competition-suppressed:** 3 steps seeded for
  `audience='host'` — `nurture_host_welcome` (0h) → `nurture_host_value` (+48h) →
  `nurture_host_offer` (+120h). Competition leads are excluded via
  `suppress_default_nurture` (set in `lib/pipeline/leadSource.ts` when a
  `campaign_id` is bound).
- **Affiliate drip = nothing.** Templates + copy exist (`nurture_affiliate_welcome
  /value/offer`) and an `audience='affiliate'` sequence row exists, but **no steps
  are seeded and the sequence is inactive**, and nothing enrols affiliates → zero
  emails ever send.
- **Milestone emails already exist** (event/cron-triggered, independent of the
  drip): `host_offer_welcome/nudge/final`, `listing_published_host`, `trial_ending`,
  `subscription_welcome`, `subscription_expiring/failed/restricted`,
  `affiliate_commission_earned`, `campaign_*` (competition).

---

## Structural changes (apply first)

1. **Decouple from competitions.** Stop setting `suppress_default_nurture` for
   campaign leads (`lib/pipeline/leadSource.ts`) so EVERY host runs the standard
   drip. Competition emails (`campaign_*`) layer on top — they augment, never
   replace, the standard journey.
2. **Activate the affiliate sequence.** Seed `nurture_steps` for `audience='affiliate'`
   and set that `nurture_sequences` row `is_active=true`.
3. **Enrol affiliates.** On partner signup (and on an affiliate lead card being
   created), enrol into the affiliate sequence — mirror how host funnel leads are
   enrolled today.
4. **Hard exits (already partly there).** Host drip stops on `is_customer`/`won`;
   affiliate drip must stop the moment the partner's **first referral binds**
   (add this exit to the worker's dead/convert check for `audience='affiliate'`).

---

## HOST journey — New → Won (balanced: ~6–7 touches / ~8 days)

Two channels working together: a **time-based DRIP** (engine, stops on subscribe)
and **milestone emails** (event/cron-triggered, always fire).

### Drip (engine, `audience='host'`, until subscribed)

| Step | Delay (from prev) | email_type | Subject | Goal |
|---|---|---|---|---|
| 1 | 0h (enrol) | `nurture_host_welcome` ✅ | "Your Direct Booking Starter Kit — start here" | orient + create booking page |
| 2 | +48h (day 2) | `nurture_host_value` ✅ | "What direct booking actually saves you" | desire (0% commission maths) |
| 3 | +48h (day 4) | `subscribe_offer_host` 🆕 | "Keep taking direct bookings — go Pro" | **the subscribe push** |
| 4 | +96h (day 8) | `host_offer_final` ✅ (reuse) | "Last thing before you go…" | last-chance conversion + social proof |

> `nurture_host_offer` (old step 3, "create a free account") is **retired from the
> drip** — its job is now covered by welcome; step 3 becomes the paid-subscribe push.

### Milestones (event/cron, always)

| Trigger | Email | Notes |
|---|---|---|
| Onboarding finishes (free tier) | `host_offer_welcome` ✅ | finish setup |
| 24–48h after signup, no published listing | `host_offer_nudge` ✅ | activation (the #1 predictor of conversion) |
| First listing publish | `listing_published_host` ✅ | "live 🎉 → take your first booking" |
| Trial starts | `trial_started_host` 🆕 | welcome + what to try in the trial |
| ~24h before trial ends | `trial_ending` ✅ | convert |
| Subscription activates (Won) | `subscription_welcome` ✅ | confirm + retain |

**Exit:** card reaches Won/customer → drip stops (worker already handles this).

---

## AFFILIATE journey — → first referral (balanced: ~5 drip + 3 milestone)

### Drip (engine, `audience='affiliate'`, until first referral binds)

| Step | Delay (from prev) | email_type | Subject | Goal |
|---|---|---|---|---|
| 1 | 0h (enrol) | `nurture_affiliate_welcome` ✅ | "Welcome — here's how partners earn with Wielo" | first action: grab + share link |
| 2 | +48h (day 2) | `nurture_affiliate_value` ✅ | "How much can you earn referring hosts?" | motivation |
| 3 | +48h (day 4) | `nurture_affiliate_offer` ✅ **(fix CTA)** | "Grab your referral link and start earning" | remove friction — **CTA must go to the Partner Pack / share-link, NOT `/signup/partner`** |
| 4 | +48h (day 6) | `affiliate_first_referral_tips` 🆕 | "The 3 easiest people to refer first" | how-to: a share script + who to target + marketing library |
| 5 | +96h (day 10) | `affiliate_encourage` 🆕 | "The first referral is the hardest — here's a hand" | re-engage if still 0 referrals |

### Milestones (event, always)

| Trigger | Email | Notes |
|---|---|---|
| First click on their link | `affiliate_first_click` 🆕 | "Someone clicked your link! Here's what's next" |
| First referral signup binds | `affiliate_first_referral` 🆕 | "You referred your first host 🎉" |
| First commission earned | `affiliate_commission_earned` ✅ | the payoff |

**Exit:** first referral binds → drip stops (partner graduates to "supported").

---

## New templates to build (6)

All short, reuse the `FunnelNurture.tsx` React-Email pattern + a `NURTURE_COPY`
entry (subject/heading/body/CTA). Register in `apps/web/lib/email/registry.ts`.

| key | audience | trigger | CTA |
|---|---|---|---|
| `subscribe_offer_host` | host | drip day 4 | `/dashboard/settings/subscription` |
| `trial_started_host` | host | trial start event | `/dashboard` |
| `affiliate_first_referral_tips` | affiliate | drip day 6 | Partner Pack / marketing library |
| `affiliate_encourage` | affiliate | drip day 10 | share link |
| `affiliate_first_click` | affiliate | first click event | affiliate dashboard |
| `affiliate_first_referral` | affiliate | first bind event | affiliate dashboard |

(Also **fix** `nurture_affiliate_offer` CTA path from `/signup/partner` → the
share-link/Partner Pack, since the recipient is already a partner.)

---

## Implementation checklist

1. **Migration** — reseed `nurture_steps` for `host` (4 steps above) and seed
   `affiliate` (5 steps); `UPDATE nurture_sequences SET is_active=true WHERE
   audience='affiliate'`.
2. **Decouple** — drop `suppress_default_nurture` in `lib/pipeline/leadSource.ts`
   (+ anywhere it's read) so competition hosts run the standard drip.
3. **Enrolment** — enrol affiliates into the affiliate sequence at partner signup
   (mirror host funnel-lead enrolment); confirm host direct-signups are enrolled too
   (not just funnel leads).
4. **Worker** — add the affiliate first-referral exit; ensure audience routing +
   CTA links are correct for `affiliate` steps.
5. **New templates ×6** — copy + `FunnelNurture` render + registry entries; final
   copy drafted below (to be filled before build).
6. **Event emails ×3** — wire `affiliate_first_click` (on first `affiliate_clicks`
   row), `affiliate_first_referral` (on first `affiliate_referrals` bind),
   `trial_started_host` (on sub → trialing) via `dispatchEvent`.
7. **Fix** `nurture_affiliate_offer` CTA.
8. **Nurture template discrepancy** — the worker currently sends inline HTML, not
   the registry `FunnelNurture` template (a known "later refinement"); align them so
   preview == what sends.

## Verification / DoD

- Enrol a test host lead + a test affiliate; run the drip worker; confirm each step
  renders + sends at the right offset and stops on conversion/first-referral.
- Confirm a competition host now ALSO receives the standard drip.
- tsc + lint + vitest green; regenerate types if the migration adds columns.

## Implementation base (blocker to resolve)

This plan edits files that exist on **`origin/main`** only. Options:
- **(A)** Resolve the local↔origin divergence (merge), then implement on the merged
  main. Cleanest, but requires the deferred consolidation.
- **(B)** Branch from `origin/main` and implement there, merge later.

Founder to choose before code starts.
