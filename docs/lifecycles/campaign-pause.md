# Lifecycle — pausing a partner in a competition

Taking one affiliate out of one competition, reversibly, **without touching
their money**.

## What a pause is (and is not)

There are two different "stop this partner" controls and they are easy to
confuse. Picking the wrong one costs a partner real income.

| | Global suspend | Competition pause |
|---|---|---|
| Where | Admin → Affiliates → the partner | Admin → Affiliates → Campaigns → the campaign |
| Stored on | `affiliate_accounts.status = 'suspended'` | `affiliate_campaign_enrollments.status = 'paused'` |
| Scope | Everything, everywhere | One campaign |
| Referral links | Stop attributing | **Keep working** |
| Commission ladder | Stops accruing | **Untouched** |
| Leaderboard | Gone (score RPC filters on account status) | Gone |
| Prizes | Ineligible | Ineligible |
| Score | Stops | **Keeps accruing quietly** |
| Reversible | Yes | Yes |

A pause is a *competition* sanction. If the intent is "this partner should stop
earning", that is the global suspend, not this.

## Why the score keeps accruing

Deliberate. `campaign_active_listings()` filters on `affiliate_accounts.status`
and knows nothing about enrollment, so a paused partner's hosts keep counting on
their own. Freezing the score would need a stored snapshot, and it would let a
partner game a pause by sitting out a bad month. Resuming therefore restores the
partner to where they *actually* are, not where they were when paused.

## The trap

`loadCampaignLeaderboard` builds its candidate list from a **union** of two
sources that disagree about pausing:

* `campaign_active_listings()` — returns paused partners, as above;
* `affiliate_campaign_enrollments` — the only place the pause is recorded.

Selecting only the `active` enrollments is **not enough**: a paused partner with
live hosts comes straight back through the scores half of the union. The paused
ids must be subtracted at the end. That is what `partitionRaceIds()` exists for,
and `leaderboard.test.ts` has a test named for exactly this regression.

Anywhere else that ranks partners must use the same rule, or the public page and
the partner's own portal will disagree about a rank. Today that is:

* `lib/affiliate/leaderboard.ts` — public page + `/api/campaigns/[slug]/standings`
* `app/[locale]/portal/affiliates/competitions/page.tsx` — computes its own rank

## Flow

1. **Admin** clicks Pause on the campaign page (`_components/EnrollmentPauseButton`).
   A reason is **required** — it is shown to the partner verbatim.
2. `setCampaignEnrollmentStatusAction` (campaigns/`actions.ts`):
   - refuses if the enrollment is `withdrawn`/`removed` (terminal, not pausable);
   - **upserts** — on an `eligible_partners = 'all'` campaign a partner can be
     scoring with no enrollment row at all, and those are exactly the ones you
     may need to pause;
   - records `paused_at` / `paused_by` / `paused_reason`;
   - writes `admin_audit_log` with before/after via `withAdminAudit`.
3. `notifyCampaignPauseChanged` dispatches `campaign_pause_changed` →
   in-app + push + the `CampaignPauseChanged` email. Never throws: a failed
   notification must not roll back the pause.
4. **Partner** sees an amber banner on `/portal/affiliates/competitions` and
   `/portal/affiliates/race/[slug]`, rank withheld, score still shown.

Resume is the same action with `status: 'active'`; it clears the pause columns
and sends the resumed variant of the email.

## Gotchas

* **`admin_audit_log.target_id` is a `uuid`.** A composite `campaign:affiliate`
  key lands as NULL without erroring. Keyed on the affiliate; the campaign id
  travels in the audited args.
* **The audit `target_type` list exists twice** — the TS union in
  `lib/admin/withAdminAudit.ts` and a DB `CHECK`. Adding it in TS alone compiles
  clean and then fails at runtime. Add it in both.
* **A queued email fails as `no_template:<type>` until the code is deployed.**
  The cron that drains `notification_queue` runs against the *deployed* build,
  and local dev writes into the same cloud database — so pausing someone locally
  queues a row the production worker cannot render yet. Expected before deploy.
* Already-awarded `affiliate_campaign_floors` (permanent prize floors) are
  **not** revoked by a pause. They are won, and the rules say permanent.
