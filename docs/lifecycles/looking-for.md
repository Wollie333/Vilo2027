# Looking-For — lifecycle flow

> A **reverse marketplace**: a guest posts *"here's what I'm looking for"*, hosts
> browse those requests and **respond with a quote**, the guest compares quotes and
> **accepts** one — which converts to a booking through the normal quote machinery.
> A Looking-For response **is a `quotes` row** (linked by `quotes.looking_for_post_id`);
> there is no separate quote store (Principle #5, one source of truth). The respond
> form is the **same `QuoteForm`** the New/Edit-Quote pages use — a *distinct purpose*
> from the manual-booking / new-quote / request-quote forms (memory
> `feedback-quote-vs-booking-forms-distinct`). Accepting reuses
> [quotes.md](quotes.md) → [booking.md](booking.md).
>
> Audited 2026-07-14 (deep pass, driven live end-to-end host→guest). This audit
> found the feature **broken at three hops** (host browse, host respond, quote↔post
> link) plus a missing guest email — all fixed and re-verified live (see
> §Audit fixes).

Surfaces:

- **Public directory** `app/[locale]/looking-for/` — anyone browses active public
  posts; "Send a quote" is the single intent gate.
- **Guest portal** `app/[locale]/portal/looking-for/` — a guest creates/edits a
  request and compares the quotes it attracts.
- **Host dashboard** `app/[locale]/dashboard/looking-for/` — a host browses
  requests, responds with a quote, saves/passes/alerts.
- **Admin** `app/[locale]/admin/looking-for/` — moderate posts (flag/remove) and
  edit per-plan quotas.

---

## Data model

Migration `20260628100000_looking_for_schema.sql` (+ `..200000` notifications,
`..200001` cron, `..210000` analytics, `..220000` alerts reshape, `..230000` match
score, `..250000` host availability, `20260703120000` image, `20260714120000`
status widen).

**`looking_for_posts`** — the guest request.

| Group | Columns |
|---|---|
| Ownership | `guest_id`→`user_profiles` (CASCADE) |
| Request | `title` (≤100), `description` (≤2000), `category` (accommodation\|experience\|venue\|event\|other), `sub_category`, `image_url` |
| Stay | `check_in_date`, `check_out_date`, `adults`≥1, `children`, `infants` |
| Location | `location_text`, `location_region`, `location_lat/lng` |
| Budget | `budget_min/max`, `budget_currency`(ZAR), `budget_per` (night\|person\|total) |
| Status | `status` `active\|fulfilled\|expired\|removed\|quotes_closed\|cancelled\|flagged` · `is_public` · `expires_at` (trigger: checkout+7d or now+30d) |
| Metrics | `view_count`, `quote_count` (denormalized by triggers) |
| Fulfilment | `fulfilled_via` (vilo_booking\|ota\|direct\|other) · `fulfilled_booking_id`→`bookings` |
| Enhance | `is_urgent`/`urgent_until`, `min_host_rating`, `quote_deadline`, `extension_count`, `reopen_count`, event/group fields |

**`looking_for_responses`** — the post↔quote bridge. `post_id`, `host_id`→`hosts`,
`quote_id`→`quotes`, `thread_id`→`conversations`, `status`
`sent\|viewed\|accepted\|declined\|expired`, `sent_at/viewed_at/expires_at`,
**`UNIQUE(post_id, host_id)`** (one response per host per post → upsert on re-send).

Supporting: **`looking_for_quotas`** (per-plan caps), **`looking_for_usage`**
(action log: `guest_post`\|`host_quote`\|`guest_extension`), **`looking_for_post_views`**
(`UNIQUE(post_id,host_id)`, trigger bumps `view_count`), **`looking_for_bookmarks`**,
**`looking_for_passes`** ("not a fit"), **`looking_for_alerts`** (saved searches —
flat filter columns after `..220000` dropped `criteria_json`), **`looking_for_post_targets`**
(private/targeted requests). `quotes` gains `looking_for_post_id`.

Triggers: `set_looking_for_post_expiry` (BEFORE INSERT), `increment_looking_for_quote_count`
(AFTER INSERT on responses — fires on first insert only, so re-send upserts don't
double-count), `increment_looking_for_view_count`. RPCs `check_guest_post_quota` /
`check_host_quote_quota` return **JSONB** `{allowed, remaining_*, limit_hit}`.

RLS: posts — public SELECT of `active AND is_public`, guest full CRUD own; responses —
host CRUD own + guest SELECT responses to own posts; quotas admin-only; usage
service-role INSERT. Host-owned tables gate via `hosts.user_id = auth.uid()`.

---

## Flow (server action at each hop)

1. **Guest creates a request** — `portal/looking-for/new` → `RequestForm` →
   `createRequestAction` (`portal/looking-for/actions.ts`). Gates on
   `guestCan('looking_for_post')` + `check_guest_post_quota`; inserts the post
   (`status='active'`, `expires_at=now+30d`) + a `looking_for_usage(guest_post)` row.

2. **Host browses** — `dashboard/looking-for` → `RequestsBoard` →
   `fetchLookingForPostsAction`. Reads public + host-targeted `active`, unexpired
   posts, joins the guest profile, marks `already_quoted` from `looking_for_responses`,
   batch-checks `check_host_availability_for_dates`. A card view →
   `recordPostViewAction` (upsert view → trigger bumps `view_count`).

3. **Host opens the respond page** — `dashboard/looking-for/respond/[postId]`.
   Gate chain: auth → is a host (else `/signup/host?next=…`) → `looking_for_access`
   → post still active → not already responded (`existingResponse.quote_id` →
   redirect to the quote) → has ≥1 quotable listing (else "finish your listing").
   Listings load via the shared **`loadQuoteFormListings`** (`dashboard/quotes/_listings.ts`).
   Renders `RespondFormWrapper` → `QuoteForm` seeded with the request's guest, dates,
   headcount, note, and **`lookingForPostId`**.

4. **Host saves the quote** — `QuoteForm` → `createQuoteAction`
   (`dashboard/quotes/actions.ts`). Inserts a `quotes` row (`status='draft'`)
   **carrying `looking_for_post_id`**. No response row yet.

5. **Host sends the quote** — `sendQuoteAction`. Flips the quote to `sent`; because
   `looking_for_post_id` is set it **upserts `looking_for_responses`**
   `{post_id, host_id, quote_id, thread_id=conversation_id, status:'sent'}`
   (→ trigger bumps `quote_count`), logs `looking_for_usage(host_quote)`, and
   dispatches **`looking_for_quote_received`** to the guest (in-app + push + the
   `QuoteSentGuest` email — see §Side-effects).

6. **Guest compares / views** — `portal/looking-for/[id]` (single) and
   `[id]/quotes` (side-by-side) both fire `markQuotesViewedAction`: unseen responses
   → `viewed_at` + `status='viewed'`, and `looking_for_quote_viewed` back to each
   host. Each quote links to `/portal/quotes/[id]` (the shared guest quote view).

7. **Guest accepts** — `/portal/quotes/[id]` (`acceptMyQuoteAction`) or the public
   token page `/q/[id]/[token]` — both call **`acceptAndConvertQuote`**
   (`lib/quotes/accept-convert.ts`, idempotent). It creates the `bookings` row
   (`origin='quote_converted'`, pending payment), marks the quote `accepted`, and —
   when the quote has a `looking_for_post_id` — **closes the loop**: the response →
   `accepted`, the post → `fulfilled` + `fulfilled_via='vilo_booking'` +
   `fulfilled_booking_id`. `reopenRequestAction` clears those if the guest never pays.

Guest post lifecycle actions (`portal/looking-for/actions.ts` + `PostActions`):
`extendRequestAction` (+7d), `markFulfilledAction`, `cancelRequestAction`
(→`cancelled`), `reopenRequestAction`, `duplicateRequestAction`. Admin
(`admin/looking-for/posts/actions.ts`): `flagPostAction` (→`flagged`),
`removePostAction` (→`cancelled`), `unflag`/`reinstate` (→`active`).

---

## Side-effects (notifications / emails / usage)

`notification_categories.looking_for` + four events (`..200000` migration, mirrored
in `lib/notifications/registry.ts`):

| Event | To | Channels | Fires from |
|---|---|---|---|
| `looking_for_quote_received` | guest | in-app · push · **email (`QuoteSentGuest`)** | `sendQuoteAction` |
| `looking_for_quote_viewed` | host | in-app · push | `markQuotesViewedAction` |
| `looking_for_new_post_region` | host | in-app · push | ⚠️ **never dispatched** (gap) |
| `looking_for_post_expiring` | guest | in-app · push | ⚠️ **never dispatched** (gap) |

The guest quote email reuses the audited `QuoteSentGuest` template (a Looking-For
response *is* a quote); `sendQuoteAction` enriches the dispatch refs with the fields
that template renders (`listingName`, `quoteNumber`, `totalAmount`, dates, nights,
`acceptToken`). Usage ledger: `guest_post` on create, `host_quote` on send
(`guest_extension` is defined but never written).

---

## Audit fixes (2026-07-14)

Driven live host→guest on test host `host@wielotest.com` (Karoo Sky) + a seeded
guest post; every hop re-verified against the cloud DB.

1. **Host browse board was 100% dead** — `fetchLookingForPostsAction` selected
   `user_profiles.display_name`, a column that doesn't exist (Postgres 42703), so
   every host saw "No requests yet". → `full_name`. *(Verified: the board now lists
   the request with guest, dates, budget.)*
2. **No host could respond** — `respond/[postId]/page.tsx` hand-rolled a listing
   query using `properties.is_active` (doesn't exist) and a `rooms` relation (the
   table is `property_rooms`), so it errored and showed "Your profile isn't live
   yet" for *every* host, even with a published listing. → replaced the bespoke
   query with the shared `loadQuoteFormListings`. *(Verified: the quote form loads,
   prefilled, with rooms + add-ons + blocked nights.)*
3. **The quote↔post link was dropped at the form** — `QuoteForm` declared
   `lookingForPostId` in its props type but never put it in the submit payload, so
   every "sent" Looking-For quote had `looking_for_post_id = null` → no response
   row, no guest notification, no accept-loop. → payload now carries it. *(Verified:
   Q-0007 linked to the post, response row created, `quote_count`→1, usage logged.)*
4. **Guest never got the quote email** — `looking_for_quote_received` had an
   `emailTemplate` key but **no `EMAIL_REGISTRY` entry**, so the drain marked every
   queued email `no_template` and dropped it. → registered it to `QuoteSentGuest`
   and enriched the dispatch payload. *(Verified: the `notification_queue` row now
   carries the full renderable payload; delivery rides the cloud email worker —
   see caveat below.)*
5. **Accept never closed the loop** — `acceptAndConvertQuote` ignored the post. →
   it now marks the response `accepted` and the post
   `fulfilled`/`vilo_booking`/`fulfilled_booking_id`. *(Verified: accepting Q-0007
   flipped all three + created the pending booking.)*
6. **Invalid status writes** — `cancelled`/`flagged` were written by guest-cancel
   and admin flag/remove but absent from the `status` CHECK, so those writes were
   rejected. → migration `20260714120000` widens the constraint. *(Verified: DB
   round-trip of `cancelled`/`flagged`/`removed` now returns 204.)*
7. **Minor:** guest post-quota compared JSONB `=== false` (never enforced) → now
   reads `.allowed`; `updateQuotaAction` hard-wrote `*_per_year: null` (wiped annual
   caps every save) → omitted; single-quote portal view now fires
   `markQuotesViewedAction` too (host "viewed" ping otherwise only fired from the
   compare page, which is hidden for a single quote).

**Delivery caveat:** the local env has no `RESEND_API_KEY` / `EMAIL_WORKER_SECRET`,
so actual Resend delivery of the guest email was **not** exercised here — only the
queue row + renderable payload + registered template are proven. Delivery runs
through the same cloud email worker that ships every other Wielo email.

---

## Known gaps (not fixed — founder call)

- **Saved-search alerts do nothing.** `looking_for_alerts` is CRUD-only; no matcher
  runs new posts against alerts (`match_count`/`last_notified_at` never update), and
  `calculate_looking_for_match_score` (`..230000`) is dead code.
- **Region-digest & expiry notifications never fire.** The crons populate
  `looking_for_region_digest_queue` and `looking_for_expiry_notifications`, but no
  worker drains them, and `looking_for_new_post_region` / `looking_for_post_expiring`
  are never dispatched.
- **Quotas aren't enforced on send.** `sendQuoteAction` doesn't call
  `check_host_quote_quota` before inserting (pre-MVP the feature gate is open anyway).
- **`response.thread_id` is often null** — a Looking-For quote's `conversation_id`
  may not exist at send time, so the response's inbox thread link is empty. The
  guest still reaches the quote via the response→quote join.
- **`removed` vs `cancelled` overlap** — admin-remove and guest-cancel both write
  `cancelled`; `removed` stays valid but unused. Cosmetic.
