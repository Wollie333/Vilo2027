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
(`UNIQUE(post_id,host_id)` — this is what makes `view_count` mean *distinct hosts*),
**`looking_for_bookmarks`**,
**`looking_for_passes`** ("not a fit"), **`looking_for_alerts`** (saved searches —
flat filter columns after `..220000` dropped `criteria_json`), **`looking_for_post_targets`**
(private/targeted requests). `quotes` gains `looking_for_post_id`.

Triggers: `set_looking_for_post_expiry` (BEFORE INSERT), plus the two counter triggers
`sync_looking_for_quote_count` (`..180000`) and `sync_looking_for_view_count` (`..290000`).
Both **recompute** — `COUNT(*)` over the source table on INSERT/DELETE/UPDATE, never `+1` —
because responses and views cascade from **`hosts`** as well as posts, so a delta counter
strands the count high the moment a host is purged. Both are **`SECURITY DEFINER` and must
stay that way**: the counter lives on the *guest's* post while the row that fires the trigger
is written by a *host*, and `looking_for_posts`' UPDATE policy only admits the guest — as
`SECURITY INVOKER` the UPDATE silently matches zero rows. RPCs `check_guest_post_quota` /
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
   batch-checks `check_host_availability_for_dates`. The board records **no** views —
   it is a list, and scrolling past a card is not "seen". `view_count` counts detail
   opens only (steps 3 and 3b).

3. **Host opens the respond page** — `dashboard/looking-for/respond/[postId]`.
   Gate chain: auth → is a host (else `/signup/host?next=…`) → `looking_for_access`
   → post still active → not already responded (`existingResponse.quote_id` →
   redirect to the quote) → has ≥1 quotable listing (else "finish your listing").
   Listings load via the shared **`loadQuoteFormListings`** (`dashboard/quotes/_listings.ts`).
   Renders `RespondFormWrapper` → `QuoteForm` seeded with the request's guest, dates,
   headcount, note, and **`lookingForPostId`**. Once the gates pass the host is looking
   at the request, so this is where the view is recorded → `recordPostView`
   (`lib/looking-for/postViews.ts`) — the ONE writer. Recorded even while the lead is
   still locked (the request card renders either way, so they *have* seen it), and never
   for a host opening their own request.

3b. **Public detail page** — `/looking-for/[id]` is the same "detail view" and records
   the same way when the viewer resolves to a host. Signed-out visitors and plain guests
   cost nothing (the host lookup is skipped) and are not counted: `view_count` is
   "Seen by X **hosts**", not page loads.

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

`notification_categories.looking_for` + **six** events (mirrored in
`lib/notifications/registry.ts`). Every stage now has a Wielo-branded email on the
shared `Shell` (§6) **and** in-app/push, both sides of the lifecycle:

| Stage | Event | To | Channels | Fires from |
|---|---|---|---|---|
| New request matches host area/alert | `looking_for_new_post_region` | host | in-app · push · **email (`LookingForNewRequestHost`)** | `notifyMatchingAlerts` (real-time, on create) + the worker's region digest |
| Host sends a quote | `looking_for_quote_received` | guest | in-app · push · **email (`QuoteSentGuest`)** | `sendQuoteAction` |
| Guest views the quote | `looking_for_quote_viewed` | host | in-app · push | `markQuotesViewedAction` |
| **Guest accepts the quote** | `looking_for_quote_accepted` | host | in-app · push · **email (`LookingForQuoteAcceptedHost`)** | `acceptAndConvertQuote` |
| **Guest declines the quote** | `looking_for_quote_declined` | host | in-app · push · **email (`LookingForQuoteDeclinedHost`)** | `declineMyQuoteAction` |
| Request expiring soon | `looking_for_post_expiring` | guest | in-app · push · **email (`LookingForRequestExpiringGuest`)** | `/api/looking-for-worker` (drains the expiry queue) |

`quote_viewed` stays in-app/push only by design (an email per view would be spam).
The guest quote email reuses the audited `QuoteSentGuest` template (a Looking-For
response *is* a quote), now also showing the guest's **requested** window (+ flex)
beside the host's **quoted** dates. Every dispatch carries both the snake_case refs
(for the in-app/push builders) and the camelCase props each email renders. Usage
ledger: `guest_post` on create, `host_quote` on send.

**Full-loop notification flow:**

```
guest posts request ──▶ [new_post_region] ──▶ matching HOSTS (email + in-app)
host sends quote ──────▶ [quote_received]  ──▶ GUEST (email + in-app)
guest opens quote ─────▶ [quote_viewed]    ──▶ HOST (in-app/push)
        │
        ├─ accepts ────▶ [quote_accepted]  ──▶ HOST (email + in-app) · booking created
        └─ declines ───▶ [quote_declined]  ──▶ HOST (email + in-app)
request nears expiry ──▶ [post_expiring]   ──▶ GUEST (email + in-app) · "extend?"
```

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

## Enhancements (2026-07-15)

- **Guest post form → create-data layout.** `RequestForm` re-skinned to the
  standard left-rail / health-ring / Review / autosave pattern (add-ons · specials ·
  coupons convention). New draft entity `looking_for_request`; the new/edit pages
  dropped their headers (the form owns the shell).
- **Saved-search alert matcher (real-time).** `lib/looking-for/matchAlerts.ts` —
  `createRequestAction` now notifies every host whose active alert matches a new
  public post (`looking_for_new_post_region`), bumping `match_count` /
  `last_notified_at`. Alerts finally do something.
- **Notification worker.** `/api/looking-for-worker` (bearer-gated, hourly cron via
  the Vault pattern, migration `20260714130000`) drains both queues: expiring-soon →
  guest, region digest → hosts in the province without an active alert. Idempotent
  via `dispatched_at` (new) / `processed_at`.
- **`calculate_looking_for_match_score` fixed** — referenced `properties.is_active`
  + `properties.region` (neither exists); now `is_published` / `province`. No longer
  dead — returns real scores (used by Host discovery).

## Search radius (map pin) — added 2026-07-16

A request can carry an optional **pinned location + search radius**. The guest form's
Location & budget step leads with a Leaflet map (`components/location/LocationPicker.tsx`);
picking a place drops a draggable pin, auto-fills the location label, snaps the Region
select to the matched province, and defaults the radius to 25 km. The radius (5–200 km)
draws a circle around the pin. Columns on `looking_for_posts`: `location_lat`,
`location_lng`, `search_radius_km` (all nullable — a post can still be region/text-only).
Migration `20260716140000_looking_for_search_radius.sql`.

- **Write:** `createRequestAction` + `updateRequestAction` persist all three; the edit
  page (`[id]/edit/page.tsx`) loads them back so the pin round-trips.
- **Display (host + guest):** `RequestInfoCard` (respond page + shared card), the host
  board `RequestCard`, the public detail page, and the guest CRM record all render
  "· within N km" beside the location.
- **Scope:** display only — the radius is **not** yet used by the alert matcher or
  `calculate_looking_for_match_score` (would need lat/lng on listings + a distance calc).
  Geo-matching is a future enhancement.
- **Gotcha:** `LocationPicker` loads Leaflet asynchronously; the marker/circle effects
  depend on a `mapReady` state flag so they run once the map exists (a ref mutation alone
  won't re-trigger them — this was why the circle didn't draw on first load).

## Known gaps (not fixed — founder call)

- **Quotas aren't enforced on send.** `sendQuoteAction` doesn't call
  `check_host_quote_quota` before inserting (pre-MVP the feature gate is open anyway).
- **`response.thread_id` is often null** — a Looking-For quote's `conversation_id`
  may not exist at send time, so the response's inbox thread link is empty. The
  guest still reaches the quote via the response→quote join.
- **`removed` vs `cancelled` overlap** — admin-remove and guest-cancel both write
  `cancelled`; `removed` stays valid but unused. Cosmetic.
