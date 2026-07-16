# Reviews — lifecycle flow

> Check-out → request → submit → publish → host reply → feature/moderate.
> Steps marked ✅ were traced through code; ⚠️ marks what is broken or unproven.

## 🔴 Read this first — automatic review requests do not send

Verified on live 2026-07-16:

| | State |
|---|---|
| `drain-review-requests` cron | **active**, `* * * * *` |
| Vault `review_request_worker_url` | **MISSING** ❌ |

The cron reads that Vault secret and, if it's unset, `RAISE NOTICE`s and returns —
a **silent soft-skip**: no error, no queue row, no alert. So `review_request_queue`
fills up on every check-out and **never drains**. **No guest is ever automatically
asked for a review.**

The **host-initiated** path (Reviews → Request) does work: it calls
`sendReviewRequest()` directly and delivers through `drain-email-queue`, whose Vault
secrets *are* set. Fix = create the secret (see [Operational notes](#operational-notes)).

**Also: the founder asked for the request delay to change 5 min → 60 min. It never
happened.** It is still 5 minutes, and it is not in SQL — it's one line of TypeScript:
`dashboard/bookings/actions.ts:21` → `REVIEW_REQUEST_DELAY_MS = 5 * 60 * 1000`.

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
  ignoreDuplicates:true`, `send_at = now + 5 min`. **Wrapped in try/catch that
  swallows errors** — a failed enqueue is invisible.
- DB writes: `bookings`, `review_request_queue`.
- Next: → Step 2 (which currently never runs).

### Step 2 — The queue drains 🔴 DEAD (missing Vault secret)
- Trigger: cron `drain-review-requests`, `* * * * *` (`20260610000002`) · Actor: system
- Logic: read Vault `review_request_worker_url` + `email_worker_secret` → **if either
  unset, NOTICE + return** → count due rows (`sent_at IS NULL AND send_at <= now()`)
  → if 0 return → else `net.http_post` the worker.
- Worker: `app/api/review-request-worker/route.ts`, bearer `EMAIL_WORKER_SECRET`,
  BATCH_SIZE 50 → `sendReviewRequest(booking_id)` → stamps `sent_at`.
- 🔴 `review_request_worker_url` is not in Vault → this has never fired.

### Step 3 — The 24-hour backstop ⚠️
- Trigger: cron `queue-review-requests`, `0 9 * * *` · Actor: system
- Logic: enqueue any `completed` booking, paid (`payment_status ∈ completed,
  partially_refunded, refunded`), checked out >24h ago, with no review and no queue
  row. **Filters `guest_id IS NOT NULL`** → an account-less guest whose 5-min enqueue
  failed is **never recovered**, even though `sendReviewRequest` supports email-only
  guests. It also feeds the same dead Step 2.

### Step 4 — The request is sent ✅ (only via the host-initiated path today)
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

## Gaps (each verified, none fixed)

1. 🔴 **`drain-review-requests` is dead** — missing Vault secret (top of this doc).
2. 🔴 **The 5→60 min delay change was never made** — `bookings/actions.ts:21`.
3. **A host can undo admin moderation.** RLS `host_respond_reviews` is a blanket
   `FOR UPDATE USING (host_id = get_my_host_id())`, and `protect_review_content()`
   deliberately leaves the flag/publish columns editable. Nothing stops a host
   `UPDATE reviews SET is_published=true, flagged=false` on a review an admin hid —
   or hiding a bad review themselves. The admin UI assumes those columns are
   admin-only; **RLS does not enforce it.**
4. **`auto-publish-reviews` is vestigial and contradicts the flow.** It still runs
   `*/15` setting `is_published=true WHERE is_published=false AND flagged=false`, but
   submissions now publish immediately, so it matches nothing on the happy path. It is
   harmless *only* because `hideReviewAction` also sets `flagged:true` and the cron
   filters on that — incidental coupling, not design. **Any future "unpublish without
   flagging" would be silently reverted within 15 minutes.**
5. **`reviews.review_token` / `token_expires_at` are dead columns.** Tokens are HMAC,
   keyed by env. The column COMMENT ("Expires in 30 days") is **false** — HMAC links
   never expire; the only revocation is rotating the secret, which kills *every*
   outstanding link at once.
6. **`REVIEW_TOKEN_SECRET` falls back to `SUPABASE_SERVICE_ROLE_KEY`** — rotating the
   service-role key silently invalidates every outstanding review link.
7. **`review_flags` anti-spam does not exist.** The code comments claim "the unique
   check on (review_id, flagged_by) keeps hosts from flag-spamming" — **no migration
   ever adds that constraint.**
8. **Stale `publish_at` contract** — the column comment and `is_published` default
   still describe the abandoned 48-hour moderation window.
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

To turn automatic review requests on:
`SELECT vault.create_secret('https://wielo.co.za/api/review-request-worker',
'review_request_worker_url', '');` — `email_worker_secret` is already set. Then
confirm `cron.job_run_details` shows the worker actually being posted, not the
early-return.

## Related

`booking.md` (check-out) · `access-details.md` (the same Vault-soft-skip failure
mode) · [[project-vercel-deploy-outage-jul16]].
