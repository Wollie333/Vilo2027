# Affiliate Program & Competition — Updated Decisions (Launch)

> ⛔ **SUPERSEDED (2026-07-30) by [`WIELO_FOUNDING_PROGRAMME.md`](WIELO_FOUNDING_PROGRAMME.md)** —
> the canonical source of truth. That document expands and, in places, revises what is below
> (90-day cookie with the rate in the payload, click-time rate stamping, two link namespaces,
> R999/R4,999/R599 products, monthly + Fast-Start prizes, day-33 payouts, per-referral dashboards).
> Read the SoT, not this file, for current rules. Kept for history only.

> **Status:** ~~decided 2026-07-30~~ superseded. This was the canonical source for the affiliate
> **commission model** and the **Founding Race** competition rules at launch.
>
> **Supersedes** the growing-ladder + prize-floors design described in
> `project-founding-programme-strategy` (v4) and `AFFILIATE_CAMPAIGN_BLUEPRINT.md`
> *for the commission specifics only* — the surrounding programme strategy (beta,
> Founding Partners, 8-month competition, Looking-For funnel) is unchanged.

---

## Summary

We are replacing the old "growing commission ladder + prizes that award permanent
rate floors" with a **single, flat, lifetime commission**:

> **Every host referred through a competition link earns the partner a flat 60%
> lifetime commission. The 60% is locked to that referral the moment the host signs
> up, stored permanently, and never changes — even after the competition ends, and
> even if the host stops and later restarts paying.**

The standard (non-competition) affiliate rate is **25% lifetime**. Only a competition
can raise a partner's rate above the standard. Cash prizes and the public leaderboard
stay exactly as they are.

---

## A. Commission model

### A.1 Standard (default) program
- **Standard rate: 25% lifetime** on a referred host's Wielo subscription.
- Admin-editable config on the product — never hardcoded.
- Applies to any referral that did **not** come through a competition link.

### A.2 Competition override
- A competition may set its own commission rate. The **Founding Race = 60% lifetime**.
- Only a competition can raise a partner above the 25% standard.
- The rate is a per-competition setting, admin-editable.

### A.3 What "lifetime" means
- The partner earns commission for **as long as the referred host keeps paying** their
  Wielo subscription — no expiry, no cap on number of periods.
- **It does not end when the competition ends.** The 8-month Founding Race is a
  time-boxed *competition*; the 60% *commission* it grants is permanent.

---

## B. The referral snapshot (the core mechanic)

- **The commission rate is snapshotted onto the referral at the moment the host is
  referred**, and stored permanently on that referral.
- Once stored, it **never changes** for that referral:
  - If the competition's rate is later edited, existing referrals keep their stored
    rate; only **new** referrals get the new number.
  - If the competition **ends**, bound referrals keep earning their stored 60%.
- **Missed payments do not matter.** If a referred host lapses or cancels:
  - During the gap, no payment is made, so no commission accrues (nothing to pay on).
  - The moment the host **pays again** — next month or a year later — the partner earns
    their snapshotted 60% again on those payments.
  - The referral stays **permanently credited** to the original partner. "Always
    recorded to the right people."
- **No grace period, no downgrade, ever.** (An earlier draft proposed a 30-day grace
  then a drop to a reduced rate — that idea is **scrapped**.)

### B.1 Why this also fixes a live bug
Today the accrual resolver reads the rate **live** from the campaign and only while the
campaign's status is `active`. Because the Founding Race runs 8 months and then ends,
every referral bound to it would **silently fall back to the default rate at the next
renewal** — breaking the "60% lifetime" promise. Snapshotting the rate onto the referral
is what makes 60% survive the competition ending.

---

## C. Clawbacks

- **No clawbacks on lapse, cancellation, or downgrade** — future accruals only.
- The **only** reversal is a **refund of a specific payment**: when a charge is refunded,
  only that charge's commission reverses. This existing behaviour is unchanged.

---

## D. The competition — Founding Race

- Runs **8 months** from launch.
- **Public, auto-updating leaderboard** (kept as-is).
- **Scored on activated (published) listings** brought live by each partner's referred
  hosts. *(⚠️ open item — confirm exact scoring metric wording, §G.)*
- Prizes are on **top of** the 60% commission every partner already earns.

---

## E. Prizes (cash — kept)

Current live config; the founder can change these at any time:

| Prize | Award |
|---|---|
| 1st place | R15,000 |
| 2nd place | R7,500 |
| 3rd place | R5,000 |
| First to 10 live listings | R2,000 |
| First to 25 live listings | R5,000 |
| First host live | R500 |

- The old **prize "rate floors" are removed** — with commission flat at 60%, a floor is
  redundant. Prizes are **cash only** now.
- Prizes are awarded when **final results are published** at competition end. Milestone
  prizes are currently **admin-awarded** when hit. *(⚠️ open item — confirm auto vs
  manual milestone award, §G.)*

---

## F. Communications & emails

- All Wielo messaging (email / push / in-app) will be managed from **one Communications
  hub** — merging today's scattered *Broadcasts*, *Send to users*, and *Email templates*
  surfaces. **One data model, many lenses.**
- The **competition dashboard gets an Email tab** (next to Marketing) that is the same
  data **filtered to that competition** — not a separate system.
- Admins edit **subject + a short intro block** per message; the branded email frame
  stays fixed.
- New competition emails to add: **partner enrolled, referral activated, milestone hit,
  kickoff, standings digest, ending-soon** (welcome/won/commission/payout/pause already
  exist).
- Full spec: `docs/strategy/COMMUNICATIONS_UI_BRIEF.md`.
- **Build priority:** finish the competition + affiliate system first; the global hub
  consolidation comes after. **All website/site-builder comms are out of scope** (handled
  in a separate sub-branch).

---

## G. Open items to confirm

1. **Scoring metric wording** — confirm the leaderboard is scored on *activated
   (published) listings brought live by referred hosts*.
2. **Milestone award** — do milestone prizes auto-award the instant they're hit, or stay
   admin-awarded (current behaviour)?
3. **Rules document** — the plain-language rules (this doc, §A–E) need to be placed at a
   **fixed public URL** and finalised by the attorney (CPA: free to entrants, retained 3
   years), per the founding-programme legal requirements.

---

## H. What changed vs. the old model

| Aspect | Old (superseded) | New (this doc) |
|---|---|---|
| Commission shape | Growing ladder 10→15→20→25% by book size | **Flat 60% lifetime** |
| Prizes | Cash **+ permanent rate floors** | **Cash only** |
| Rate over time | Could rise as the partner's book grew | **Fixed at referral time, never changes** |
| On host lapse | (n/a) | **No downgrade; resumes at 60% when they pay again** |
| After competition ends | Referrals fell back to default (bug) | **Keep 60% forever (snapshot)** |
| Standard rate | Unset / per-product (was 20% on `pro`) | **25% lifetime** |
| Leaderboard | Public, auto | **Unchanged** |

---

## I. Implementation notes (for the build, not the reader)

- **Default rate:** set `pro` product affiliate rate 20% → 25% (config, editable).
- **Snapshot:** add snapshot columns to `affiliate_referrals`; populate in
  `bindAffiliateReferral`; resolver (`accrue_affiliate_commission`) reads the snapshot,
  not the live campaign config — which also removes the `status = 'active'` dependency
  that caused the campaign-end fallback.
- **Prizes:** strip the redundant `floor` fields from the campaign competition config;
  keep the cash prizes.
- **Ladder machinery stays** in code as a still-supported campaign option (not dead
  code); the Founding Race simply uses the flat model.
- Verify against the live DB with a throwaway referral, regenerate types, update
  `docs/SCHEMA.md`, changelog.
