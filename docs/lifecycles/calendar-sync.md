# Calendar sync (iCal) — lifecycle flow

> Two independent directions. **Export**: Wielo publishes a per-property (or
> per-room) `.ics` feed that an OTA subscribes to. **Import**: Wielo polls a feed
> the host pastes in and writes `blocked_dates`, so an OTA booking closes the dates
> here. They share nothing but the `ical_feeds` table.
>
> Spec: `BOOKING_SYNC.md`. Steps marked ✅ were driven; ⚠️ marks what has NOT been
> proven.

## ⚠️ Read this first — the sync has never moved a real booking

Verified on live 2026-07-16:

| | State |
|---|---|
| `sync-ical-feeds` cron | **active**, `*/15 * * * *`, last 5 runs **succeeded** |
| Vault `ical_sync_worker_url` / `ical_sync_worker_secret` | **both set** ✅ |
| `ical_feeds` rows | **0** |

So the pipe is plumbed and green, and **every "success" is an early return** — the
cron only wakes the worker when a feed is actually due, and there are no feeds. The
import path has therefore never imported anything on this database. **A green cron
here is not evidence the feature works.** The unproven step is a **real OTA
round-trip** (Airbnb/Booking.com → import → block → export → OTA sees it).

---

## Tables

**`ical_feeds`** — one row per subscribed external feed:
`id` · `property_id` · **`room_id`** (nullable → per-room feeds) · `source_label` ·
`url` · `status` · `last_sync_at` · `last_error` · `imported_count` ·
`created_at` · `updated_at`.

`status ∈ ('active','error', …)` — the cron considers `active` **and** `error` feeds
due, so a failing feed keeps retrying rather than falling out of the rotation.

---

### Step 1 — Host adds a feed to import ✅
- Trigger: Calendar sync → add feed · Actor: host
- Functions/files: `dashboard/calendar-sync/FeedManager.tsx` → its actions.
- DB writes: `ical_feeds` (property_id, room_id, source_label, url, status='active').
- Next: → Step 2, within 15 minutes.

### Step 2 — The cron decides whether to wake the worker ✅ (green, but see the warning above)
- Trigger: cron `sync-ical-feeds`, `*/15 * * * *` · Actor: system
- Functions/files: `20260707130000_ical_sync_cron_use_vault.sql` (supersedes
  `20260707120000`, which read `current_setting()` GUCs instead of Vault).
- Logic:
  1. Read Vault `ical_sync_worker_url` + `ical_sync_worker_secret`. **If either is
     unset → `RAISE NOTICE` and return** — a silent soft-skip, no error, no row.
  2. Count feeds where `status IN ('active','error')` **and**
     `last_sync_at IS NULL OR last_sync_at < now() - interval '3 hours'`
     (matches the worker's own 3-hour min-interval). **If 0 → return** — this is the
     branch that fires today.
  3. Otherwise `net.http_post` the worker.
- 🔑 **A "succeeded" run in `cron.job_run_details` means the DO block completed — not
  that a feed synced.** Both early returns look identical to a real sync from there.

### Step 3 — The worker imports ⚠️ never exercised
- Trigger: the cron's HTTP POST · Actor: system
- Functions/files: `apps/web/app/api/ical-sync-worker/route.ts` → `POST`, bearer-gated
  on **`ICAL_SYNC_WORKER_SECRET`** (note: this worker uses its *own* secret, not the
  shared `email_worker_secret` the other queue workers use) → `lib/ical-sync.ts`
  → `syncFeed()` → `lib/ical-parser.ts`.
- Logic: fetch the URL → parse VEVENTs → **cap at `MAX_IMPORTED_DATES = 1000`** so a
  giant or hostile feed can't flood `blocked_dates` → write blocks → stamp
  `last_sync_at`, `imported_count`.
- On failure: `status='error'` + `last_error`. The feed stays in the rotation (Step 2
  includes `'error'`), so it self-heals once the source recovers.
- DB writes: `blocked_dates`, `ical_feeds` (last_sync_at, imported_count, status,
  last_error).

### Step 4 — Wielo publishes its own feed (export) ✅ route exists
- Trigger: an OTA fetches the URL · Actor: external
- Functions/files: `apps/web/app/ical/[property_id]/[token]/route.ts` → `GET`
  → `lib/ical.ts` → `verifyListingToken()` → `buildIcalFeed()`.
- Both `/ical/{id}/{token}.ics` and `/ical/{id}/{token}` resolve (`stripIcsExt`).
- **Token:** `signListingToken()` derives a **per-property secret** from
  `ICAL_TOKEN_SECRET` (AGENT_RULES.md §2.6). 🔑 It deliberately does **not** fall back
  to the service-role key — a feed token is public-by-construction, so deriving it
  from the most powerful secret in the system would be a compromise. `ICAL_TOKEN_SECRET`
  is listed in `turbo.json`. Missing secret → `signListingToken` **throws**
  ("iCal token secret is not configured"), it does not degrade quietly.
- ⚠️ Not proven: that a real OTA accepts the emitted VEVENT/VCALENDAR shape.

### Step 5 — The double-booking guard ✅
- An imported block and a Wielo booking compete for the same dates. The guard is
  live in both directions and per-room — see [[project-calendar-sync-state]] and
  `booking.md`.

---

## Operational notes

- **Two secrets, two owners.** The cron reads Vault (`ical_sync_worker_url`,
  `ical_sync_worker_secret`); the route reads the **env var**
  `ICAL_SYNC_WORKER_SECRET`. They must match, and they live in different places —
  Vault for the DB side, Vercel env for the app side. `ICAL_SYNC_WORKER_SECRET` is
  currently **missing from `turbo.json`**, which is harmless because the route reads
  it at runtime, not at build (see [[project-vercel-deploy-outage-jul16]]).
- **Per-room feeds:** `ical_feeds.room_id` — a property's rooms each carry their own
  feed. Don't assume one feed per property.
- **To prove this feature**, you need a real OTA on both ends. Until then treat
  Steps 3–4 as unproven regardless of what the cron reports.

## Related

`booking.md` (the block/conflict side) · `BOOKING_SYNC.md` (the spec) ·
[[project-calendar-sync-state]].
