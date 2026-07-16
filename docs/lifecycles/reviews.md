# Reviews — lifecycle flow

> Check-out → request → submit → publish → host reply → feature/moderate.
> Steps marked ✅ were traced through code; ⚠️ marks what is broken or unproven.

## ✅ Read this first — the blocker is cleared (but unproven end to end)

Verified on live 2026-07-16:

| | State |
|---|---|
| `drain-review-requests` cron | **active**, `* * * * *` |
| Vault `review_request_worker_url` | ✅ **created 2026-07-16** → `https://wielo.co.za/api/review-request-worker` |

**Until 2026-07-16 this was dead.** The cron reads that Vault secret and, if it's unset,
`RAISE NOTICE`s and returns — a **silent soft-skip**: no error, no queue row, no alert.
No migration creates the secret; it's a manual one-time `vault.create_secret`. So
`review_request_queue` filled on every check-out and never drained, and **no guest was
ever automatically asked for a review**. The secret now exists.

⚠️ **Still unproven end to end.** The DB is a blank slate (0 bookings), so nothing has
ever been due: the cron early-returns and reports `succeeded` exactly as it did when it
was broken. **A green run here still proves nothing** — that is the whole trap. It will
first be exercised ~1 minute after a real check-out (then +60 min for the guest's email).

✅ **The request delay is now 60 minutes** (`REVIEW_REQUEST_DELAY_MINUTES`,
`dashboard/bookings/actions.ts`) — the founder asked for 5 → 60 back on 2026-07-12 and
it had never been done. It is **not** in SQL, despite two migrations commenting on it.

---

## Tables

**`reviews`** (`20260501000007_create_reviews_domain.sql`) — `booking_id` **UNIQUE
NOT NULL** (one review per booking, ON DELETE RESTRICT) · `property_id` (renamed from
`listing_id`) · `host_id` · `guest_id` **nullable** (account-less/manual guests,
`20260610000005`) · `rating` 1–5 · `body` · `host_response` / `host_responded_at` ·
`is_published` (default **false**) / `publish_at` · `flagged` / `flagged_at` /
`flagged_reason` · `admin_decision ∈ ('upheld','rejected')` · six sub-ratings
(cleanliness, communication, checkin, accuracy, location, value) · `trip_type` ·
`helpful_count`.

**`review_request_queue`** — `booking_id` UNIQUE · `guest_id` · **`send_at`** ·
`sent_at`. Index `idx_review_queue_due (send_at) WHERE sent_at IS NULL`.

Also: `review_flags`, `review_photos`, `review_helpful_votes`.
**Featured review = `properties.featured_review_id`** — *not* `featured_listings`,
which is the unrelated directory-promotion table. Don't conflate them.

**Triggers:** `protect_review_content()` — reviews are immutable; a host may only add
`host_response`/`host_responded_at` (bypassed for `is_super_admin()`).
`on_review_published()` — recalculates `properties.avg_rating/total_reviews` and
`hosts.avg_rating/total_reviews`.

---

### Step 1 — Host checks the booking out ✅
- Trigger: host clicks Check out · Actor: host
- Functions/files: `dashboard/bookings/actions.ts` → `applyTransition('checkOut')`
  → `status='completed'`, `checked_out_at=now` → `enqueueReviewRequest()` (`:168`).
- Logic: gated on `guest_id || guest_email`. Upsert `onConflict:'booking_id',
  ignoreDuplicates:true`, `send_at = now + REVIEW_REQUEST_DELAY_MINUTES` (60). **Wrapped in try/catch that
  swallows errors** — a failed enqueue is invisible.
- DB writes: `bookings`, `review_request_queue`.
- Next: → Step 2.

### Step 2 — The queue drains ✅ unblocked, ⚠️ never yet exercised
- Trigger: cron `drain-review-requests`, `* * * * *` (`20260610000002`) · Actor: system
- Logic: read Vault `review_request_worker_url` + `email_worker_secret` → **if either
  unset, NOTICE + return** → count due rows (`sent_at IS NULL AND send_at <= now()`)
  → if 0 return → else `net.http_post` the worker.
- Worker: `app/api/review-request-worker/route.ts`, bearer `EMAIL_WORKER_SECRET`,
  BATCH_SIZE 50 → `sendReviewRequest(booking_id)` → stamps `sent_at`.
- ✅ `review_request_worker_url` created 2026-07-16 → `https://wielo.co.za/api/review-request-worker`. ⚠️ With 0 bookings nothing is due, so it still early-returns; unproven until a real check-out.

### Step 3 — The 24-hour backstop ⚠️
- Trigger: cron `queue-review-requests`, `0 9 * * *` · Actor: system
- Logic: enqueue any `completed` booking, paid (`payment_status ∈ completed,
  partially_refunded, refunded`), checked out >24h ago, with no review and no queue
  row. **Filters `guest_id IS NOT NULL`** → an account-less guest whose enqueue
  failed is **never recovered**, even though `sendReviewRequest` supports email-only
  guests.

### Step 4 — The request is sent ✅
- Functions/files: **SSOT `lib/reviews/request.ts` → `sendReviewRequest(bookingId)`**.
- Re-validates: `status='completed'`, `payment_status ∈ PAID_STATUSES`, no existing
  review. Two branches:
  - **Account guest:** `dispatchEvent('review_request_guest')` (email + in-app + push)
    **plus** a guest system card (`systemEvent:'review_request'`).
  - **Account-less guest:** raw `sendTransactionalEmail` with **inline HTML** — not the
    `ReviewRequestGuest` React template, not in the email registry, no admin preview,
    not localised. Two divergent copies of the same message.
- Host-initiated: `dashboard/reviews/actions.ts` → `requestReviewsAction(bookingIds)`
  (max 100, host-ownership filtered).

### Step 5 — Guest submits ✅
- Trigger: the tokenised link · Actor: guest
- Functions/files: `app/[locale]/review/[bookingId]/page.tsx` +
  `actions.ts → submitReviewAction(bookingId, token, input)`.
- **Token:** `lib/review-token.ts` — HMAC-SHA256 over `review:${bookingId}` keyed by
  `REVIEW_TOKEN_SECRET`, **falling back to `SUPABASE_SERVICE_ROLE_KEY`**. There is no
  DB token column (see Gaps).
- Gates, in order: zod (rating 1–5, body ≤2000, ≤`MAX_REVIEW_PHOTOS`) → verify token →
  booking exists and not deleted → **`status='completed'` and `checked_out_at` set** →
  no existing review.
- DB writes: `reviews` with **`is_published: true, publish_at: now`** — published
  immediately, there is no 48-hour window. Then `review_photos`,
  `review_request_queue.sent_at = now`, and `dispatchEvent('new_review_host')`.
- Uses the **service-role client deliberately**: there is no guest INSERT policy on
  `reviews`.
- Side-effects: `on_review_published()` recalculates the property + host averages.

### Step 6 — Host replies ✅
- Functions/files: `dashboard/reviews/actions.ts` → `replyToReviewAction(reviewId,
  {body})` (min 2, max 1500) → `assertReviewOwnership` (relies on RLS returning null
  for non-owners) → writes `host_response`, `host_responded_at`.
  `editReplyAction` delegates to it; `clearReplyAction` nulls both.
- ⚠️ **The guest is never told their review got a reply** — no dispatch here.

### Step 7 — Feature / flag / moderate ✅
- **Feature is the HOST's, not the admin's:** `toggleFeaturedReviewAction` writes
  `properties.featured_review_id`, scoped by `host_id`; refuses to feature an
  unpublished review; unpin is scoped by `featured_review_id` so it can't clear
  someone else's pick.
- **Host flags:** `flagReviewAction` → `review_flags` row + `reviews.flagged`.
- **Admin moderates:** `admin/reviews/actions.ts` — `hideReviewAction`
  (`reviews.moderate`, audited `review.uphold_flag`, reason required) sets
  `flagged:true, is_published:false, admin_decision:'upheld'`; `restoreReviewAction`
  (`review.reject_flag`) reverses it.

---

## Gaps (each verified on live; ✅ = fixed 2026-07-16)

1. ✅ **FIXED — `drain-review-requests` was dead** (missing Vault secret; created 2026-07-16). ⚠️ Still unproven end to end — see the top of this doc.
2. ✅ **FIXED — the delay is 60 minutes** (`REVIEW_REQUEST_DELAY_MINUTES`).
3. ✅ **FIXED `20260716250000` — a host could undo admin moderation.** RLS
   `host_respond_reviews` is a blanket `FOR UPDATE USING (host_id =
   get_my_host_id())` and `protect_review_content()` left the flag/publish columns
   editable, so a host could `UPDATE reviews SET is_published=true, flagged=false`
   on a review an admin hid — or bury a bad review outright. **Proven on live**
   (4 abuses possible), then closed in the trigger, since a policy cannot express
   "these columns are off-limits" and widening RLS would break the reply flow.
   🔑 The exemption is **not** `is_super_admin()`: that is `auth.uid()`-based and so
   is FALSE for the service-role client, which is exactly how `hideReviewAction` /
   `restoreReviewAction` write — gating on it would have broken admin moderation
   itself. It gates on `auth.uid() IS NOT NULL` (a real end-user session); trusted
   no-JWT contexts (service role, pg_cron) pass through. A host may still reply and
   still **raise** a flag; they cannot publish/unpublish, **clear** a flag, or set
   `admin_decision`. Rehearsed live, 9 cases, before/after.
4. ✅ **RETIRED `20260716260000` — `auto-publish-reviews`.** A leftover of the
   abandoned 48-hour window: it published anything `is_published=false AND
   flagged=false AND publish_at <= now()`, but submissions publish immediately, so it
   matched nothing. It was harmless *only* because `hideReviewAction` also sets
   `flagged:true` — incidental coupling, not design — so **any future "unpublish
   without flagging" would have been silently republished within 15 minutes**, with no
   audit trail. `20260716250000` made that live rather than theoretical by exempting
   no-JWT contexts (pg_cron). Unscheduled, and the `publish_at` / `is_published`
   column comments (which still described the 48-hour window) corrected.
5. **`reviews.review_token` / `token_expires_at` are dead columns.** Tokens are HMAC,
   keyed by env. The column COMMENT ("Expires in 30 days") is **false** — HMAC links
   never expire; the only revocation is rotating the secret, which kills *every*
   outstanding link at once.
6. **`REVIEW_TOKEN_SECRET` falls back to `SUPABASE_SERVICE_ROLE_KEY`** — rotating the
   service-role key silently invalidates every outstanding review link.
7. ✅ **FIXED `20260716330000` — the host could never flag at all, and the anti-spam
   was fiction.** Two faults, found when the button was finally wired (pt11):
   - **`review_flags` had RLS enabled and ZERO policies from May to July.**
     `20260501000007:65` ran `ENABLE ROW LEVEL SECURITY` and never wrote a policy.
     RLS with no policy **denies every non-service-role write**, so
     `flagReviewAction`'s insert always raised. Proven on live as `authenticated`:
     `42501 new row violates row-level security policy for table "review_flags"` —
     **not** `23503`, so the FK on deliberately-fake uuids never got a say: RLS
     refused first. 🔑 Nobody noticed because **the action had no caller to notice
     with** — a dead feature hides its own bugs, and both would have surfaced on the
     new button's first click.
   - **The anti-spam constraint the comments claimed did not exist.** It does now
     (`review_flags_one_per_flagger`), and the action reports the 23505 honestly
     ("already reported") instead of advising a retry that cannot work.
   Rehearsed on live with 6 controls incl. the pre-migration control (must fail),
   a different host (42501), and a spoofed `flagged_by` (42501).
   Also wired: the admin queue never **read** `review_flags`, so the host's typed
   explanation was written and read by nobody — `flagged_reason` alone is an enum.
   It now renders under "Host said:".
8. ✅ **Stale `publish_at` contract** — column comments corrected in `20260716260000`.
   The `is_published` DEFAULT false is deliberately left: every insert names the
   column, so it's unreachable, and false is the safe way to be wrong.
9. **Worker retry semantics are inverted from its own comment.** A missing booking
   returns `{ok:true, skipped}` → the worker stamps `sent_at` → **not** retried. Only
   an email failure leaves the row — and that then retries **every minute forever**,
   with no backoff and no attempt cap.
10. **`review_helpful_votes` is unwired.** Table, RLS and the `sync_review_helpful_count`
    trigger exist; nothing in the app ever writes it, so `helpful_count` stays 0.
11. `new_review_host` is skipped silently when the host row has no `user_id`.
12. **Not found:** guest edit/delete; any notification on host reply, flag, or
    moderation decision; any writer of `reviews.admin_actioned_by`.

## Operational notes

✅ `review_request_worker_url` was created 2026-07-16, so the queue can drain. **To prove
it actually does**, you need one real check-out — then confirm `cron.job_run_details`
shows the worker being POSTed rather than the early-return:

```sql
select j.jobname, d.status, d.start_time, left(d.return_message, 80)
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
where j.jobname = 'drain-review-requests'
order by d.start_time desc limit 5;
```

⚠️ `succeeded` alone means nothing — it is identical for "posted the worker" and "no rows
due, returned early". Cross-check `review_request_queue` for a row whose `sent_at` fills in.

## Related

`booking.md` (check-out) · `access-details.md` (the same Vault-soft-skip failure
mode) · [[project-vercel-deploy-outage-jul16]].
