# Wielo Founding Programme

**Canonical source of truth — affiliate commission model and Founding Race competition rules.**

| | |
|---|---|
| **Version** | 1.0 |
| **Status** | Decided. Supersedes all prior versions. |
| **Date** | 30 July 2026 |
| **Supersedes** | `Wielo_Founding_Programme_Strategy` v1.0–v4, `AFFILIATE_CAMPAIGN_BLUEPRINT.md`, `AFFILIATE_COMPETITION_DECISIONS.md` (30 July) |
| **Derived artefacts** | Public rules page · Partner brochure copy · Affiliate agreement |

> **How to use this document.** This is the only place programme rules are authored. The public rules page, the partner brochure and the affiliate agreement are *outputs* of this document, never independent sources. When something changes, it changes here first and the derived artefacts are regenerated. The previous failure mode was three documents each holding a different version of the truth.

---

## 1. Architecture — two tracks

Wielo runs a permanent affiliate programme and, on top of it, time-boxed competitions. They are separate systems with separate links.

### Track 1 — The standard affiliate programme

- Always running. Open to every approved partner.
- One **permanent default link** per partner. Never expires.
- **25% lifetime commission** on the referred host's subscription.
- This is the baseline and the fallback. A partner is never without it.

### Track 2 — Competitions

- A partner **opts in** to a competition and receives a **separate link scoped to that competition**.
- Hosts arriving through that link are stamped with **the competition's rate** — 60% for the Founding Race.
- A partner may be enrolled in several competitions at once, each with its own link and rate.
- When a competition closes, its links stop functioning as competition links and **auto-redirect to that partner's default link**. Referrals already stamped keep their rate permanently.

**Only a competition can raise a partner above the 25% standard.** The standard rate is admin-editable configuration, never hardcoded.

---

## 2. Commission model

### 2.1 Rates

| | Rate | Applies to |
|---|---|---|
| **Standard** | 25% lifetime | Any referral not made through a competition link |
| **Founding Race** | **60% lifetime** | Referrals made through a Founding Race competition link |

Rates are ex-VAT (see §7.4).

### 2.2 The snapshot — the core mechanic

**The commission rate is stamped onto the referral at the moment of the click, and stored permanently on that referral.**

Once stored it never changes:

- If a competition's rate is later edited, existing referrals keep their stored rate. Only **new** referrals get the new number.
- If the competition **ends**, bound referrals keep earning their stored rate.
- **There is no retroactive correction.** If 60% proves too generous, it can only be changed for future referrals. This is accepted and deliberate.

### 2.3 What "lifetime" means

The partner earns for **as long as the referred host keeps paying** their Wielo subscription. No expiry, no cap on the number of periods, and no end when the competition ends.

**The Founding Race is a time-boxed competition. The 60% commission it grants is permanent.**

### 2.4 Lapses and restarts

- While a host is lapsed or cancelled, nothing is paid — there is no payment to earn on.
- The moment the host **pays again**, next month or three years later, the partner earns their stamped rate on those payments.
- The referral stays **permanently credited to the original partner**.
- **No grace period and no downgrade, ever.**

### 2.5 The rate lives on the referral, not the partner

A partner will hold several different rates simultaneously — 60% on hosts referred during the Founding Race, 25% on hosts referred afterwards.

**The partner dashboard must display per-referral rates, never a single blended headline number.** A partner who sees "your rate: 43%" will assume they are being shorted. Each host must be listed with the rate attached to it and the date it was stamped.

### 2.6 Add-on listings

The stamped rate applies to the **full subscription value including multi-listing add-ons**, not the base plan alone.

### 2.7 Transfer and sale of a partner's audience

- Commission entitlements **do not transfer** on the sale of a Facebook group, page or audience. The originating partner keeps earning on referrals they made.
- The buyer may **enrol as a new partner** and earns the standard 25% on hosts they refer from that point.
- **Wielo may, at its sole discretion and on written request, approve a transfer.**
- On partner account closure, commission ceases. On the death of a partner, Wielo may continue payment to the estate for **12 months**.

---

## 3. Attribution and links

### 3.1 Cookie

- **Duration: 90 days**, fixed from **first click**. Re-clicking does not refresh the clock.
- **Payload:** partner ID, competition ID (nullable), commission rate, click timestamp.

### 3.2 The six attribution rules

**1. First touch wins, permanently.** The first valid click inside the cookie window binds. Later clicks — any partner, any link — never displace it. This is the rule that prevents partners with overlapping audiences from stealing each other's warm leads.

**2. The rate is taken at click, not at signup.** A host who clicks a competition link on 25 January and signs up on 10 March is stamped at the competition rate, because the partner did the work inside the window. The delay was the host's.

**3. A redirect never downgrades.** When an expired competition link redirects to a partner's default link, the resulting 25% stamp binds **only where no valid attribution already exists**. An existing attribution is never replaced by one at a lower rate.

**4. The link determines both rate and competition entry.** A partner who posts their default link during a competition binds that host at 25% and scores no points for it.

**5. A 30-day admin correction window** applies to rule 4. Wielo may reassign an incorrectly-bound referral on request within 30 days of the bind. All reassignments are logged.

**6. Manual fallback.** The signup form carries a **"Referred by"** field, prefilled from the cookie where present and manually enterable with a partner code where not. The same binding rules apply. Over a 90-day window a meaningful share of hosts will clear cookies or switch devices; this recovers those and gives Wielo something to point at in a dispute.

### 3.3 Link presentation during a competition

While a partner is enrolled in a live competition, the partner dashboard must surface the **competition link prominently** and attach a visible warning to the default link. Rule 4 will otherwise catch someone in week one who copied the wrong URL.

---

## 4. Payouts

### 4.1 Schedule

**Commission accrues on successful payment and becomes payable on day 33 after that payment clears.**

Thirty days covers the refund window, three days covers settlement into Wielo's account. **No commission is ever paid on a payment that is later refunded within the refund window.** Payment is by **EFT**, arriving within 7 business days of the payable date.

### 4.2 Threshold

- **Minimum payout balance: R1,000.** Balances below this roll forward.
- **Sweep-up exceptions — any balance is paid regardless of amount:** at competition close, on partner account closure, and once annually in June.

Without the sweep-ups, a partner with two founding-monthly hosts sits at R718 indefinitely and never gets paid.

### 4.3 Reversals

- **No clawbacks on lapse, cancellation or downgrade.** Future accruals only.
- The **only** reversal is the refund of a specific payment. Only that payment's commission reverses.
- A reversal landing after payout is **debited against the partner's balance and carried forward as negative until future earnings absorb it. Wielo does not pursue cash recovery.**

### 4.4 VAT and tax

- **Commission rates are ex-VAT.** Wielo is not VAT-registered and neither charges nor pays VAT.
- This is sales commission. **Partners are responsible for their own SARS obligations**, including income declaration and any VAT position of their own.
- Cash prizes are paid gross. Partners are responsible for any tax arising.

### 4.5 The annual-plan lever

One annual host pays R2,999.40 and clears the R1,000 threshold immediately. A monthly host at R359.40 takes three to trigger a payout. **State this explicitly in the partner brief** — partners will sell the annual plan harder than any pricing page once they understand it.

---

## 5. The Founding Race

### 5.1 Shape

| | |
|---|---|
| **Duration** | 5 months |
| **Opens** | 1 October 2026 |
| **Closes** | 28 February 2027 — **confirmed** |
| **Commission** | 60% lifetime on every host referred through a Founding Race link |
| **Leaderboard** | Public page, plus a partner-portal view. Auto-updating. |
| **Prizes** | Cash only, on top of the 60% every partner already earns |

### 5.2 Calendar

| Date | |
|---|---|
| **1 Oct 2026** | Race opens. Founding-host intake opens. Free access begins. |
| **Oct – Nov** | Recruitment peak. Hosts onboard and take summer bookings through Wielo under real load. |
| **December** | The proof month. Peak occupancy, guests staying, guest data accumulating. No selling. |
| **31 Dec 2026** | Free access ends for the founding cohort. |
| **1 – 31 Jan 2027** | **Decision window.** Soft open 1 Jan, hard push from ~12 Jan. |
| **1 Feb 2027** | Founding pricing ends. Price reverts to R999/month. |
| **early–mid Feb** | First large commission payouts land — **while the leaderboard is still live**. |
| **28 Feb 2027** | Race closes. Leaderboard frozen on listings live at that moment. |
| **early–mid Mar** | Prizes awarded. Second payout wave. |

**Why these dates.** SA summer bookings are made August–November for December–January stays, so an October start puts hosts into the product mid-rush — real reservations within two weeks. December proves it under peak occupancy. Mid-January is the only month where a guesthouse owner is simultaneously liquid, calm and convinced, which makes it the best possible moment to ask for R4,999.

**Why five months, not four.** January's conversions pay out on day 33, landing mid-February with two weeks of race remaining. Partners watching R2,999 per annual host arrive while there is still a leaderboard to climb is the strongest motivational beat in the programme, and it only exists if the competition outlives the decision window. Schedule the partner-group announcement for that week deliberately.

### 5.3 Intake and trial

- **Intake stays open until the Race closes.**
- **Free access ends 31 December for the whole founding cohort regardless of join date.** Join in October, get three months. Join in November, get two. The asymmetry is deliberate — it gives partners a reason to recruit hard in week one: *"every week you wait, your hosts get a shorter free run."*
- **Late-joiner safety net:** any host activating from 1 December onward gets a guaranteed 30 days free plus a 30-day decision window on a rolling clock.
- **State plainly in the public rules:** a host joining in late February is unlikely to publish a live listing before close and will score their partner nothing — but the referral still stamps 60% for life.
- **Non-converting hosts are never deleted.** Accounts go read-only with full data export available.

### 5.4 Scoring

**One point per active published listing from your referrals. That is the entire system.**

1. **Only listings that are currently live count.** A host who leaves stops counting at the next nightly recompute. No clawback windows, no timers, no disputes.
2. **Each listing counts separately.** A manager with 15 properties scores 15.
3. **Score is a live query recomputed nightly, not an accumulating ledger.** Final score is computed on listings live at the moment of close.

**The line partners will remember:** *"How many of your hosts are live right now? That's your score."*

**Tie-breaker: earliest to reach the final score.**

**Why activation and nothing else.** The commission pays on conversion — in cash, monthly, permanently. Scoring conversion as well pays twice for one outcome. Signups prove nothing in a free-trial model. Activation measures the one thing the partner genuinely controls: who they chose to invite. A partner who blasts their group gets ~15% activation; one who personally messages thirty serious hosts gets 70%.

### 5.5 Prizes

**Placings — awarded at close**

| | |
|---|---|
| **1st** | **R15,000** + "Wielo Founding Partner of the Year," named on the website |
| **2nd** | **R7,500** |
| **3rd** | **R5,000** |

**Milestones — first past the post, once each**

| | |
|---|---|
| First host live | **R500** |
| First to 10 live listings | **R2,000** |
| First to 25 live listings | **R5,000** |

**Monthly campaign — 5 × R1,000 = R5,000**

Scored on **net change in live listings within that month**, not on running total. Whoever adds the most live listings in November wins November.

> **This is the anti-runaway-leader mechanism and it is not optional.** In a five-month race, a dominant partner is uncatchable by month three and everyone else quietly stops posting — you lose 25 partners to keep one. Scoring net change resets the field five times and lets a partner with 6 listings beat one with 90. The dominant partner still wins the main race, correctly, while everyone else always has something winnable in front of them. **(2026-07-31: the partner cap is now removed/uncapped — which makes this reset mechanism *more* essential, since more partners means a runaway leader would demoralise more people.)**

**Fast Start — R1,000, non-competitive**

Any partner reaching **5 live listings within their first 30 days** gets R1,000. Not a race — everyone who hits it gets it. Budget 5 × R1,000 = R5,000.

> This is the only non-competitive prize, and it is what gives a partner who knows they won't win a reason to start at all.

**Total prize budget: R45,000.**

| | |
|---|---|
| Placings | R27,500 |
| Milestones | R7,500 |
| Monthly campaigns | R5,000 |
| Fast Start | R5,000 |

**Currency.** Prizes are in **rand only**. International partners may contact Wielo to arrange PayPal settlement.

**Award mechanism.** The leaderboard calculates and ranks **automatically**. All prizes require **admin approval before final award**. Milestone prizes are flagged automatically the moment they are hit and awarded on admin approval.

### 5.6 Eligibility and entry

- **One entry per person.** A person may not enter twice under different accounts, groups or entities.
- Partners must be approved by Wielo and must have accepted the affiliate agreement.
- Wielo may decline any application without giving reasons.

### 5.7 Anti-gaming

- One account per real, verifiable property. Address and photos verified before a listing counts.
- **No self-referral.** No referring one's own accounts, or family accounts that do not operate as genuine businesses.
- **No paid search advertising** on the term "Wielo" or variants.
- **No misrepresentation.** Specifically: no claims about the website builder or any feature not yet shipped.
- Wielo verifies all activations. **Wielo's decision on qualification is final.**
- Any partner found creating fake accounts **forfeits all points, all prizes and all commission.**

### 5.8 Partner obligations

- **Minimum 4 posts** across the competition. Wielo supplies all of them.
- **One pinned post** for the first 30 days.
- **Attend at least 2 of the monthly partner calls.**
- **Honest representation.** No promising features that don't exist. **No website-builder claims.**

---

## 6. The host offer

### 6.1 Pricing

| | |
|---|---|
| **Standard** | **R999/month** — live and genuinely purchasable on the public site from day one |
| **Founding annual — the hero product** | **R4,999/year** (R417/month, against R11,988 standard) |
| **Founding monthly** | **R599/month** |

**Partner earns:** R2,999.40 on an annual host · R359.40/month on a monthly host.

### 6.2 Annual is the hero, monthly is the recovery offer

All public-facing material — brochure, partner posts, emails, pricing page — shows **R4,999/year** against the R999/month standard. That is the whole visible story.

**R599/month is not advertised.** It is surfaced only on hesitation or decline: on the Build Night call, in the "your access ends in 7 days" email, in the abandonment flow, or when a partner reports a host who can't manage the lump sum. Framed honestly: *"If the annual isn't workable right now, we can do R599 a month — it works out higher over the year, but it's yours at that rate for as long as you stay."*

**Why not annual-only.** Forcing annual maximises revenue per convert while shrinking the number of converts, which is the opposite of the stated goal of user count. Elsa is cash-poor by definition; removing R599 leaves her only R999/month, and most of those people convert to nothing at all. On a 150-host base the trade is roughly R65,000 of extra January cash against ~30 hosts, 30 directory listings and 30 advocates.

**Worth knowing:** at 60% commission a monthly host who stays past **month nine** is worth more to Wielo than an annual host (R599 × 12 = R7,188 vs R4,999; Wielo keeps R2,875 vs R2,000). Annual remains the right hero — certain, cash-now, and it removes twelve churn decisions — but it is not the financially superior option it appears to be.

### 6.3 Refunds

**30-day money-back from the first payment.** No commission is paid until day 33, so a refund inside the window never requires a clawback.

### 6.4 Founding price lock

- **R4,999/year or R599/month, locked for as long as the host stays subscribed.**
- The lock covers **their tier as it exists and everything subsequently added to that tier**, at no extra cost.
- **Outside the lock:** new tiers (Pro, Agency) and genuinely separate products — payments, transaction-based services, paid add-ons.
- **This boundary must appear in writing in the Founding Host terms.** Not stating it is how you end up with a cohort you cannot serve profitably in year three.
- **Founding pricing exists while Wielo is in beta. When Wielo leaves beta, it goes.**

### 6.5 Language

**Never call it free.** "Free" anchors the product at R0 and makes R599 read as a price increase. Use *"full access for the months you help us build it"* — which makes the founding price read as a reward.

---

## 7. Legal

To be finalised by a South African commercial attorney. This document is not legal advice.

### 7.1 Publication (Consumer Protection Act)

- Competition rules must be **available free to every entrant** at a **fixed public URL**, linked in every partner communication.
- Rules and records **retained for three years**.
- Wielo's decision on all matters of qualification, scoring and award is **final**.

### 7.2 POPIA

- Hosts sign up directly with Wielo. Partners never handle host personal information.
- Partners handling any host contact data do so subject to POPIA obligations set out in the affiliate agreement.
- Wielo does not share partner audience data with third parties.

### 7.3 Affiliate agreement

A signed agreement per partner covering: commission terms and the snapshot mechanic, reversal and negative-balance handling, POPIA obligations, termination, non-transferability on sale of audience, and the tax position in §4.4.

### 7.4 Open question for the attorney

**CPA cancellation rights against the annual plan.** Section 14 permits cancellation of fixed-term consumer agreements on 20 business days' notice with only a *reasonable* penalty; a full-year forfeit may not qualify. Juristic persons are excluded, so a guesthouse trading as a Pty Ltd is likely outside it — but sole proprietors are a significant share of the ICP.

**Exposure:** host pays R4,999 in January, partner is paid R2,999 in February, host cancels in May with a pro-rata entitlement of roughly R2,900. Wielo is ~R900 down and the money is gone.

**If it bites, the fix is small:** pay 50% of annual commission at day 33 and the balance at month 6.

---

## 8. Targets

**Competition target: 200 paying hosts.**

| | |
|---|---|
| Paying hosts | 200 |
| Activated listings required (~60% conversion) | ~335 |
| Signups required (~50% activation) | ~670 |
| **Accepted partners required** (~8 paying hosts each) | **25–30** |
| Recruitment funnel | Shortlist 50 → invite 35 → accept 25–30 |

**This is the one structural change the 200 target forces** — the earlier plan assumed 15–20 partners, which cannot reach 200 at realistic per-partner performance. Expect heavy skew: the top 20% of partners will deliver 50–60% of the total.

**Partner recruitment priority order:**

1. SA guesthouse / B&B owner groups (highest ICP density)
2. Self-catering and holiday accommodation groups
3. Regional tourism groups (Garden Route, Drakensberg, Lowveld, Cape Winelands, Karoo)
4. Airbnb host groups SA
5. Safari lodge and game farm operator groups
6. Property management / rental management groups (highest leverage per property)

---

## 9. Parked — pick up before launch

| | |
|---|---|
| **Brochure rewrite** | The 14-panel partner brochure is **factually wrong** in at least three panels. Panel 8 carries the old commission ladder. Panel 9 is built entirely on rate floors ("the floor matters more than the cash") which no longer exist. Panel 10 promises a dashboard showing "how many more listings until your rate goes up" — there is no ladder to climb. **Rewrite once the build is live so it can be made factual, not before.** |
| **Public rules page** | Generate from §1–7 of this document, attorney-reviewed, live at a fixed URL before any partner communication goes out. |
| **Affiliate agreement** | Draft per §7.3, attorney-reviewed. |
| **Attorney question** | §7.4 — CPA cancellation rights against the annual plan. |
| **Communications hub** | Per the 30 July decisions doc §F. Competition + affiliate system first; global hub consolidation after. Website/site-builder comms out of scope. |

---

## 10. Implementation deltas

For the build. Supersedes §I of the 30 July decisions doc where they differ.

### 10.1 Rates and products

- Set `pro` product affiliate rate 20% → **25%** (config, editable).
- Create the **R999/month standard product**, live and purchasable from day one.
- Create **R4,999/year** and **R599/month** founding products. UI presents annual as the hero; monthly is not shown on public pricing surfaces.

### 10.2 Links

- **Two link namespaces.** Default links are permanent. Competition links are scoped to a campaign, carry an expiry, and carry a redirect target.
- On expiry, competition links **auto-redirect to the partner's default link**.

### 10.3 Cookie

- Duration **30 → 90 days**, fixed from first click (no rolling refresh).
- Payload changes shape: **partner ID, competition ID (nullable), rate, click timestamp** — no longer a bare partner ID.
- **Audit the codebase for anything else assuming a 30-day cookie.**

### 10.4 Snapshot and binding

- Add snapshot columns to `affiliate_referrals`; populate in `bindAffiliateReferral`.
- **The snapshot source is the cookie payload, not live campaign config.** This preserves the §2.2 fix — the resolver (`accrue_affiliate_commission`) reads the snapshot on the referral and the `status = 'active'` dependency is removed, so rates survive campaign end.
- **Attribution guard:** a bind must check for existing attribution and refuse to replace it (rules 1 and 3, §3.2).
- **"Referred by" field** on the signup form, cookie-prefilled, manually enterable.
- **Admin reassignment tool** with a 30-day window and audit logging.

### 10.5 Scoring and prizes

- **Nightly recompute job** over currently-live listings. Live query, not an accumulating ledger.
- **Campaign scoring mode setting: total, or net change in window.** The monthly campaigns require net-change mode; the main race uses total. This setting is what makes concurrent campaigns useful rather than decorative.
- Strip redundant `floor` fields from the campaign competition config. Cash prizes only.
- **Ladder machinery stays in code** as a supported campaign option — not dead code. The Founding Race simply uses the flat model.
- Milestone prizes flag automatically on being hit; **admin approval required before award**.

### 10.6 Payouts

- Accrual payable on **day 33** after successful payment.
- **R1,000 threshold** with sweep-up at competition close, account closure, and annually in June.
- **Negative balance carry-forward** on post-payout reversals. No cash recovery.

### 10.7 Dashboards

- **Partner dashboard: per-referral rates**, each host listed with its stamped rate and stamp date. **Never a blended headline rate.**
- Competition link surfaced prominently while a competition is live; default link carries a warning during that period.
- **Public leaderboard page** and a **partner-portal leaderboard view.**

### 10.8 Verification

Verify against the live DB with a throwaway referral, regenerate types, update `docs/SCHEMA.md`, changelog.

---

*Wielo · Founding Programme v1.0 · 30 July 2026 · Confidential*
