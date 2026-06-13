# Guest Reputation — Hosts Rate Guests (cross-host)

> Saved plan — not yet built. Pick up from here to implement.

## Context

The Reviews MVP only built **guest → listing** reviews. It missed the reverse:
**host → guest** ratings, so a host can warn other hosts what to expect. This is a
**shared reputation network** — unlike every other host-private table, a host's
rating of a guest is readable by *all* hosts (keyed on the guest's global Vilo
identity), while each host can only add/edit their own. The aggregate star sits on
the guest's record and informs hosting decisions.

Decisions locked with the founder:
- **5 dimensions** (each 1–5 + optional short note): Payments, Communication,
  Cleanliness, House rules & respect, Integrity — plus an **overall** star
  (required) and an **overall written summary**. ("Difficulty" was dropped as its
  own axis because 5★ would mean "worst", inverting the aggregate; it's captured by
  overall + house-rules.)
- **One review per host per guest**, editable (a living review, not per-stay).
- **Strictly host-internal** — guests never see it (no guest RLS, no notifications).
- **Eligibility:** a host may rate a guest only after a **completed stay** (also
  allow `no_show`, since a no-show is high-value signal). Enforced in the action.

Keying is on `guest_id` (`user_profiles.id`) — the global Vilo identity
(BUSINESS_PRINCIPLES Principle #1; accounts are minted via `ensureViloGuestIdentity`).
Email-only/OTA guests with no account (`gkey` = `e_…`) are not rateable — the tab
shows a graceful "no Vilo account yet" empty state.

## Plan

### 1. Migration — `guest_ratings` table
New file `supabase/migrations/<ts>_create_guest_ratings.sql`, mirroring the style of
`20260501000007_create_reviews_domain.sql`:

```sql
CREATE TABLE public.guest_ratings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id      uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  host_id       uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  rating        integer NOT NULL CHECK (rating BETWEEN 1 AND 5),       -- overall
  summary       text,                                                  -- overall write-up
  rating_payments      integer CHECK (rating_payments BETWEEN 1 AND 5),
  rating_communication integer CHECK (rating_communication BETWEEN 1 AND 5),
  rating_cleanliness   integer CHECK (rating_cleanliness BETWEEN 1 AND 5),
  rating_house_rules   integer CHECK (rating_house_rules BETWEEN 1 AND 5),
  rating_integrity     integer CHECK (rating_integrity BETWEEN 1 AND 5),
  note_payments text, note_communication text, note_cleanliness text,
  note_house_rules text, note_integrity text,                          -- per-dim short notes
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_id, guest_id)                                           -- one living review
);
CREATE INDEX idx_guest_ratings_guest ON guest_ratings(guest_id);
CREATE INDEX idx_guest_ratings_host  ON guest_ratings(host_id);
ALTER TABLE guest_ratings ENABLE ROW LEVEL SECURITY;
```

**RLS (the security-critical core — cross-host read, own-row write):**
- `host_read_all_guest_ratings` — `SELECT` allowed if the caller is any active host:
  `USING (EXISTS (SELECT 1 FROM hosts h WHERE h.user_id = auth.uid() AND h.deleted_at IS NULL))`.
  This is the deliberate cross-host sharing. **No guest policy** → guests can't read it.
- `host_write_own_guest_rating` — `INSERT/UPDATE/DELETE` only where
  `host_id = get_my_host_id()` (reuse the helper used by `reviews`).
- `admin_full_guest_ratings` — super admin (mirror existing `admin_full_reviews`).
- Add an `updated_at` touch trigger (reuse the project's standard `set_updated_at`).

Apply with `supabase db push --linked`, then regenerate types:
`supabase gen types typescript --linked > packages/types/database.types.ts`
(never pipe stderr — corrupts the file).

### 2. Zod schema + Server Actions
New `apps/web/app/[locale]/dashboard/guests/_rating/schemas.ts` (co-located, per
convention — see `dashboard/inbox/schemas.ts`): overall `rating` (1–5, required),
`summary` (max ~1500), and per-dimension `{score 1–5 nullable, note max ~300}`.

Add to `apps/web/app/[locale]/dashboard/guests/actions.ts` (mirror the existing
`addGuestNoteAction` pattern — `requireHost()` from `lib/host/current.ts`, scope by
`host.hostId`, `revalidatePath`, `{ ok }` return):
- `upsertGuestRatingAction(guestId, input)` — `requireHost`; **eligibility gate:**
  confirm a booking exists with `host_id = host.hostId AND guest_id = guestId AND
  status IN ('completed','no_show')`; zod-parse; **upsert** on `(host_id, guest_id)`;
  revalidate the guest record path. No notifications (internal).
- `deleteGuestRatingAction(guestId)` — `requireHost`; delete own row; revalidate.

Eligibility helper `lib/guests/can-rate.ts` (small) so the page and action share one
check.

### 3. Data load — `[gkey]/page.tsx`
After resolving `guestId` (already done via `gkeyFor`), when `guestId` is non-null:
- Fetch **all** `guest_ratings` for that `guest_id` (RLS lets this host read every
  host's row), ordered by `updated_at desc`.
- Split into `myRating` (where `host_id === host.hostId`) and `otherRatings`.
- Derive aggregate: overall avg + count of hosting hosts + per-dimension averages
  (compute on read — low volume, no denormalisation needed).
- Compute `canRate` via the eligibility helper.
- Pass all of the above into `GuestRecord`. When `guestId` is null, pass a flag so
  the tab renders the "no Vilo account yet" state.

### 4. UI — new tab + panel
In `[gkey]/GuestRecord.tsx`:
- Add `{ key: "reputation", label: "Reputation" }` to the `TABS` array
  (`GuestRecord.tsx:208`). Named **Reputation** to avoid clashing with the existing
  **Reviews** tab (which shows the guest's reviews *of listings*).
- Add a render branch (alongside `tab === "reviews"` at `GuestRecord.tsx:467`)
  rendering a new `ReputationPanel`.

New `ReputationPanel` (in `GuestRecord.tsx` or a sibling component file):
- **Header:** large aggregate overall star (avg across hosts) + "Rated by N hosts" +
  a compact per-dimension average row (reuse `StarRow` from
  `dashboard/reviews/StarRow.tsx`).
- **Your review** card: if `myRating` exists → show scores/summary with **Edit** +
  **Delete**; else a **Rate this guest** button — enabled only when `canRate`
  (otherwise a muted "Available after a completed stay" hint).
- **Other hosts' reviews:** scrollable list of cards (overall + per-dimension stars +
  per-dimension notes + summary). Attribution anonymised as **"A verified host"** +
  stay month (defaulted to reduce inter-host conflict / POPIA exposure; flag if you
  want host names shown instead).
- Empty/no-account states handled.

**Rate-guest modal** — `FormModal` shell (`components/ui/form-modal.tsx`) + RHF +
Zod. Reuse the `CategoryStars` interactive-star pattern from
`review/[bookingId]/ReviewSubmissionForm.tsx` (extract it to a shared
`components/reviews/CategoryStars.tsx` and import in both places — single source of
truth). Fields: overall stars, 5 dimension star rows each with an optional short
note, and an overall summary textarea. Submits via `upsertGuestRatingAction`.

Optional nicety: a one-line "Reputation ★4.2 · 3 hosts" badge in the dossier sidebar.

### 5. i18n
Add a `guestRating` namespace to `apps/web/messages/en.json` (dimension labels,
helper text, buttons, empty states). Wire every string via `t()` / `getTranslations`
— no hardcoded copy (RULES.md §10).

### 6. Help article
Seed migration `supabase/migrations/<ts>_help_guest_ratings.sql` mirroring
`20260601000002_help_seasonal_pricing.sql` — `help_articles` row, slug
`how-guest-ratings-work`, `audience = 'host'`, category `guests` (or nearest),
`INSERT … ON CONFLICT (slug) DO UPDATE`. Explain it's internal, cross-host,
one-editable-review-per-host, and the dimensions.

### 7. Feature gate (pre-MVP open)
Add the feature key but keep it **open on free** — seed `plan_features` enabled for
all plans and have the gate short-circuit `true` (AGENT_RULES §3.4), matching the
project's pre-MVP policy.

## Files

| Area | Path |
|---|---|
| Migration (table+RLS) | `supabase/migrations/<ts>_create_guest_ratings.sql` (new) |
| Help article seed | `supabase/migrations/<ts>_help_guest_ratings.sql` (new) |
| Types | `packages/types/database.types.ts` (regenerated) |
| Zod schema | `apps/web/app/[locale]/dashboard/guests/_rating/schemas.ts` (new) |
| Server actions | `apps/web/app/[locale]/dashboard/guests/actions.ts` (extend) |
| Eligibility helper | `apps/web/lib/guests/can-rate.ts` (new) |
| Data load | `apps/web/app/[locale]/dashboard/guests/[gkey]/page.tsx` (extend) |
| Tab + panel + modal | `apps/web/app/[locale]/dashboard/guests/[gkey]/GuestRecord.tsx` (extend) |
| Shared star input | `apps/web/components/reviews/CategoryStars.tsx` (extract from ReviewSubmissionForm) |
| Copy | `apps/web/messages/en.json` (extend) |

## Open sub-decisions to confirm at build time
- **Tab name** "Reputation" vs "Guest Rating" (clash-avoidance with existing Reviews tab).
- **Attribution**: anonymised "A verified host" (default) vs named host businesses.
- **`no_show` eligibility**: included by default — drop if undesired.
- **Legal**: cross-host opinions about a guest carry POPIA/defamation weight in SA;
  add a Terms clause (ties into the launch-blocking legal-direct-payments work).

## Verification

1. `supabase db push --linked` applies cleanly; `supabase migration list --linked`
   shows both new migrations; regenerate `database.types.ts` (line 1 is
   `export type Json =`).
2. Seed/use two host accounts (A, B) and one guest with a **completed** booking under
   each. As host A, the Reputation tab shows **Rate this guest** enabled; submit
   scores + notes + summary.
3. As host B (same guest), confirm A's review is visible under "Other hosts" and the
   aggregate reflects both; B can add their own but cannot edit A's.
4. A guest with no completed stay under host A shows the button disabled with the
   "after a completed stay" hint. An `e_…` (no-account) guest shows the
   "no Vilo account yet" state.
5. RLS check via service-role sweep: a guest token gets **zero** rows from
   `guest_ratings`; a non-host user gets zero; a host gets all rows for the guest.
6. `cd apps/web && pnpm build && pnpm lint` — zero errors/warnings; no `console.log`.
   Update `CHANGELOG.md` and `CURRENT_TASK.md`.
