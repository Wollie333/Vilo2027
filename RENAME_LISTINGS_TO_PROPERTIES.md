# Rename: `listings` → `properties` (full, consistent) — Execution Checklist

> **R0 inventory.** This is the authoritative checklist + progress log for the
> `listings → properties` rename. It is the resume anchor for fresh sessions:
> read this + the plan (`~/.claude/plans/ok-it-has-come-spicy-snail.md`) +
> `git log` to continue. Part of the bigger Website CMS pivot (see plan).

## Why
Pre-MVP, no production data, `supabase db reset` sanctioned, **migrations immutable**
(never edit existing — add new `ALTER … RENAME` migrations). Docker unavailable, so
recreate affected functions from their **latest** definitions in the migration files.
Goal: logical naming before the website build sits on top of it.

## The rule (what renames vs what stays)
- **RENAME → `property_*`:** tables representing the PROPERTY and its intrinsic
  inventory/content.
- **KEEP "listing":** tables/concepts that genuinely mean the **directory channel**
  (a "directory listing" is a real, retained concept). These keep their name; only
  their FK column `listing_id → property_id` changes.
- **RPC parameter names stay** (`p_listing_id`): they are internal labels; renaming them
  would break `.rpc(fn, { p_listing_id })` named-arg callers. Only **table/column
  references inside function bodies** change. (Intentional, documented exception.)
- Storage bucket `listing-photos` **stays** (bucket id; not a table). `storage_path`
  comment text is cosmetic.

## Table rename map
| Current table | Action | New name | Phase |
|---|---|---|---|
| `listings` | RENAME ✅ | `properties` | R2 (done) |
| `listing_rooms` | RENAME ✅ | `property_rooms` | R2 (done) |
| `listing_photos` | RENAME ✅ | `property_photos` | R2 (done) |
| `listing_amenities` | RENAME ✅ | `property_amenities` | R2 (done) |
| `listing_seasonal_pricing` | RENAME ✅ | `property_seasonal_pricing` | R2 (done) |
| `listing_policies` | RENAME ✅ | `property_policies` | R2 (done) |
| `listing_addons` | RENAME ✅ | `property_addons` | R2 (done) |
| `listing_rankings` | RENAME | `property_rankings` | R1 |
| `listing_points_of_interest` | RENAME | `property_points_of_interest` | R1 |
| `listing_review_themes` | RENAME | `property_review_themes` | R1 |
| `listing_counters` | RENAME | `property_counters` | R1 |
| `listing_access` | RENAME | `property_access` | R1 |
| `listing_local_picks` | RENAME | `property_local_picks` | R1 |
| `listing_room_access` | RENAME | `property_room_access` | R1 |
| `listing_view_events` | RENAME | `property_view_events` | ~~R1~~ **R3** (see note) |
| `listing_categories` | RENAME ✅ | `property_categories` | R1 (done — renamed; it's the *kinds of properties* taxonomy) |
| `featured_listings` | **KEEP** (directory channel) | — (col→property_id) | R3 |
| `directory_search_logs` | **KEEP** (directory channel) | — (`clicked_listing`→`clicked_property`) | R3 |

> Verify the full table set against the live DB before R1/R2 (grep `CREATE TABLE …
> listing`). `listing_categories` is the taxonomy catalog — confirm it's property-scoped
> before renaming; if it's a global taxonomy it may stay (decide in R1).
>
> **R1 decisions (done):** (a) `listing_categories` → `property_categories` — it's the
> admin-managed catalog of *kinds of properties* (Villa, Cottage, …), so the property
> name reads logically; the `listings.category_id` FK auto-follows. (b) `listing_view_events`
> **deferred to R3** — it's consumed only by the large analytics RPC suite, which R3 already
> recreates for the `listing_id→property_id` column change. Renaming it in R1 would force
> recreating that whole suite twice (table-name now, column later) for no benefit; in R3 it
> renames table + column in one clean pass.

## Column renames (R3) — `listing_id → property_id` everywhere
Tables carrying a `listing_id` FK (non-exhaustive — re-grep `listing_id` in migrations
before R3): `bookings`, `quotes`, `invoices`, `conversations` (inbox),
`featured_listings`, `reviews`, `coupons`, `ical_feeds`, `blocked_dates`,
`policy_snapshots`, and every `property_*` child table after R2 (`property_rooms`,
`property_photos`, `property_amenities`, `property_seasonal_pricing`,
`property_policies`, `property_addons`, `property_rankings` (PK), `property_counters`
(PK), `property_access` (PK), `property_local_picks`, `property_points_of_interest`,
`property_review_themes`, `property_view_events`).
Also: `listings.listing_type → property_type`, any `listing_category_id →
property_category_id`, `directory_search_logs.clicked_listing → clicked_property`.

## Functions / RPCs to recreate (find LATEST def per fn; swap table/col refs in body)
Recreate in the phase that renames the objects the body touches. Known universe:
- **Pricing/availability (R2/R3):** `calculate_booking_price`, `get_listing_availability`,
  `room_is_available`, `listing_is_available_whole`, unified pricing engine fns
  (`20260601000001`), seasonal pricing v2 fns (`20260524000008`), `effective_vat_rate`.
- **Policy (R2/R3):** `resolve_listing_policy_id` + snapshot fns + `get_listing_policy_summary`
  (latest = `20260610180004`/`20260610180006` — confirm), `20260610180000_policy_resolver_snapshot_ssot`.
- **Directory/ranking (R1):** `recalculate_listing_ranking`.
- **Slug/location triggers (R2):** `generate_listing_slug`, `sync_listing_location` (+ their triggers).
- **Doc numbering (R1/R3):** `listing_doc_code` (`20260602000010`).
- **Analytics RPCs (R2/R3):** many with `p_listing_id` — latest defs across
  `20260605150404`, `20260605151537`, `20260605200526` (find truly-latest per fn name).
- **Guest CRM RPCs (R3):** `_host_guest_rows`, `fetch_host_guests*`, list rpcs with `p_listing_id`.
- **Misc:** any trigger fn referencing renamed tables (`on_booking_confirmed`, etc. — check bodies).

> Method per phase: `grep` each candidate fn name across migrations → open the
> highest-timestamp file defining it → that is the source of truth → recreate with
> renamed table/column references. RLS policies & triggers whose expressions name a
> renamed table/column must also be recreated.

## Code surface (sweep targets)
- `.from('listing*')`: **239 occurrences / 82 files** (table-name swap → R1/R2).
- `listing_id` filters/selects/embeds + generated-type fields (→ R3). Re-count before R3.
- Embedded PostgREST selects: `listing_rooms(...)`, `listing_photos(...)`, etc. (→ R2).
- TS types: regenerate `packages/types/database.types.ts` each phase (`--linked`, **no stderr pipe**).
- Verify scripts in `apps/web/scripts/` (verify-policy-resolver, test-booking-flows,
  seed-demo, seed-analytics) reference tables — update with each phase.

## Routes & labels (R4)
- `/[locale]/listing/[slug]` → `/[locale]/property/[slug]` (+ `book/`, `rooms/[roomId]`).
- `/[locale]/dashboard/listings` → `/dashboard/properties`; `dashboard/listing-extras`,
  `dashboard/rooms`, `dashboard/seasonal-pricing` (folded later per plan §5).
- `/ical/[listing_id]/[token]` → `[property_id]`; `admin/.../listings/[listingId]`.
- i18n `messages/en.json` (+ af/fr/de/pt): "Listing" → "Property" (keep "Directory listing"
  channel wording). `messages/en.json` has ~14 hits to review.

## Per-phase checklist (each: migration → `db push --linked` → gen types → sweep → `pnpm build` + `pnpm lint` + query-sweep → commit)
- [ ] **R0** Inventory doc (this file) committed.
- [x] **R1** Leaf tables renamed + isolated fns recreated + code swept. Green. Commit.
- [x] **R2** Core tables renamed + core fns recreated + `.from()`/embeds/types swept. Green. Commit.
- [x] **R3** `listing_id → property_id` (+ listing_type etc.) + fns recreated + code swept. Green. Commit.
- [x] **R4** Routes + i18n labels. Green. Commit (`852bfea` routes).
- [ ] Run `apps/web/scripts/verify-policy-resolver.mjs` + a query-sweep after R2/R3.

## Verification commands
```
supabase db push --linked
supabase gen types typescript --linked > packages/types/database.types.ts   # never pipe stderr
cd apps/web && pnpm build && pnpm lint
node apps/web/scripts/verify-policy-resolver.mjs      # + query sweep after R2/R3
```

## Progress log
- **R0 (done):** inventory + rule (channel tables keep "listing"; RPC params stay) +
  5-phase plan. Next: **R1 — leaf tables.**
- **R1 (done):** migration `20260617000100_rename_r1_leaf_tables.sql` renamed 8 leaf
  tables (`listing_{rankings,counters,categories,review_themes,local_picks,access,
  room_access,points_of_interest}` → `property_*`). Indexes/constraints/triggers/RLS
  policies/FKs follow the table rename automatically (kept their old internal names —
  cosmetic). Recreated the 3 functions whose bodies named a renamed table, swapping
  only that ref: `recalculate_listing_ranking` (→`property_rankings`),
  `gen_booking_reference` (→`property_counters`), `send_due_access_cards`
  (→`property_access`/`property_room_access`). `app_purge_user_account`/`clear_all`
  needed no change (they delete `listings` and rely on CASCADE). Swept 17 code files
  (`.from()` + the trips-page embed) + `seed-demo.mjs` + 2 doc comments. Regenerated
  types; `pnpm type-check` + `pnpm build` green; `pnpm lint` clean (only 2 pre-existing
  `<img>` warnings in untouched reports components); live-DB sweep on all 8 tables OK.
  **`listing_view_events` deferred to R3** (analytics-suite entanglement — see note above).
  Next: **R2 — core tables** (`listings`→`properties` + core children).
- **R2 (done):** migration `20260617000200_rename_r2_core_tables.sql` renamed the 7
  core tables (`listings`→`properties`; `listing_{rooms,photos,amenities,
  seasonal_pricing,policies,addons}`→`property_*`). FKs/indexes/triggers/sequences
  /RLS policies all followed the rename automatically — **including cross-table RLS
  policies/views that reference a renamed table in a subquery** (their expressions
  are stored as OID-referenced parse trees, not text), so none were recreated.
  Recreated **30 functions** whose PL/pgSQL/SQL bodies name a renamed table
  (function bodies are late-bound text and DO break) — discovered by introspecting
  every `CREATE FUNCTION` body across the migration history (slice→dollar-body
  parse), swapping ONLY the 7 table tokens and keeping `listing_id` columns, the
  `policies` catalog table, channel tables (`listing_view_events`,
  `featured_listings`) and all RPC/param names. `app_purge_user_account` updated
  (`DELETE FROM listings`→`properties`). Pushed; types regenerated (`properties`
  key present, old keys gone). **Code sweep:** codemod over 886 files → 112 changed
  + 2 `.mjs` scripts (`seed-demo`, `test-booking-flows`) + `verify-policy-resolver`/
  `verify-reviews`: `.from()` table names, PostgREST embeds (un-aliased `listings(`
  embeds aliased back as `listings:properties(...)` to preserve result keys; 5 prose
  false-positives reverted incl. user-facing Terms text), child embeds + their
  property-access keys, and 2 generated-type index refs reverted (hand-written
  types still key `listings`). `pnpm type-check` + `pnpm lint` green (only the 2
  pre-existing `<img>` warnings); live verify: 7 tables resolve / old names gone /
  17 recreated RPCs callable. Next: **R3 — `listing_id → property_id` columns**
  (+ `listing_type`, `clicked_listing`, rename `listing_view_events` table+col,
  recreate analytics suite once for the column change).
- **R3 (done):** migration `20260617000300_rename_r3_columns.sql`. **Column renames**
  via `ALTER TABLE … RENAME COLUMN`: `listing_id → property_id` on 20 tables
  (`bookings`, `quotes`, `conversations`, `coupons`, `reviews`, `blocked_dates`,
  `ical_feeds`, `featured_listings` (channel table — name kept, col follows) + every
  `property_*` child), plus `properties.listing_type → property_type`,
  `properties.whole_listing_discount_pct → whole_property_discount_pct` (added for
  full consistency — was not in the original R3 column list), and
  `directory_search_logs.clicked_listing → clicked_property`. Renamed the deferred
  `listing_view_events` → `property_view_events` (+ its col). FKs/PKs/indexes/RLS/
  CHECK expressions all follow the column rename by attnum (same as R1/R2) — only
  function bodies break. **Recreated 36 functions** whose latest def names a renamed
  column/table, by a mechanical, reviewable swap of the verbatim latest defs
  (`\blisting_id\b → property_id`, `listing_view_events → property_view_events`);
  `p_listing_id` params + `listing_ids` array outputs preserved by word boundaries.
  Full-consistency choice: jsonb output keys + SQL aliases inside functions also
  became `property_id`, so each function is internally consistent and the app reads
  match. **Code sweep:** word-boundary replace across **104 source files** (+ the
  `track-listing-view` edge fn) — `.select/.eq/.insert/.order` strings, typed row
  reads, RPC-JSON reads, `listing_type`/`whole_listing_discount_pct`; the iCal
  `[listing_id]` route param left as-is (folder coupling → R4), only its
  `.eq("property_id", …)` DB filter swapped. **Follow-up migration
  `20260617000400`** drops a **stale pre-SSOT 1-arg `get_listing_policy_summary`
  overload** that had coexisted with the canonical 2-arg since 2026-06-10 (R1/R2/R3
  by-name recreation kept refreshing the wrong one) — PostgREST could not
  disambiguate single-arg calls, which the R3 verify surfaced. Types regenerated
  (0 bare `listing_id`; only FK-constraint NAMES keep the old label, cosmetic).
  `pnpm type-check` + `pnpm lint` green (only the 2 pre-existing `<img>` warnings).
  **Live verify:** `verify-policy-resolver` 🎉 green; 13 callable RPCs (analytics +
  pricing + availability + policy) execute against the renamed schema; recreate-
  ranking INSERT path + booking-path fns (`booking_business_id`,
  `ensure_booking_invoice`, `_materialize_booking_party`) green; all renamed columns
  resolve. **Edge fn `track-listing-view` updated + redeployed** (table+col+body
  → `property_view_events`/`property_id`) and smoke-tested green end-to-end.
  `seed-demo.mjs` has a pre-existing, unrelated
  `eft_banking_details.business_id` not-null failure (multi-business build, not R3).
  Next: **R4 — routes + i18n labels** (`/listing/[slug]`, `/dashboard/listings`,
  iCal `[listing_id]` folder, "Listing" → "Property" copy).
- **R4 (done):** **No DB migration** — routes + labels only. Renamed route folders
  (`git mv`) + swept every path-string & import reference (typedRoutes is OFF, so
  stale path strings are runtime 404s, not build errors — swept exhaustively by hand):
  (a) `app/[locale]/listing/[slug]` → `property/[slug]` (+ `book/`, `rooms/[roomId]`);
  (b) `app/[locale]/dashboard/listings` → `dashboard/properties` (also fixed relative
  imports `../listings/[id]/edit/*` from `dashboard/rooms` + `dashboard/setup`, and
  alias imports from `components/listing/*`); (c) `app/[locale]/admin/listings` →
  `admin/properties` and `admin/users/[id]/listings/[listingId]` →
  `properties/[propertyId]` (param key `params.listingId` → `params.propertyId`);
  (d) `app/ical/[listing_id]` → `[property_id]` (route param key
  `params.listing_id` → `params.property_id`; no export-URL builder exists in code yet).
  Commit `852bfea` (routes). **i18n (commit pending):** `messages/en.json` value swaps
  for the **app-UI** Property concept — `booking.listing` "Listing"→"Property", the
  `businesses.*` block (subtitle/listingsCount/currencyHint/archiveConfirmBody),
  dashboard tour `calendarBody`/`listingsBody`; `messages/af.json` `businesses.*`
  "lysadvertensies"→"eiendomme" (its `booking.listing` was already "Eiendom");
  `fr/de/pt.json` are 18-line stubs (no content — nothing to change). Host sidebar nav
  item relabelled "Listings"→"Properties" + the footer count badge (they point at the
  renamed route). Build + lint green (only the 2 pre-existing `<img>` warnings); 0
  remaining route strings anywhere.
  **KEPT (internal labels / not routes / channel wording):** `components/listing/`
  component dir; `dashboard/listing-extras` route (plan §5 folds it into the per-Property
  editor later); the `listing` i18n namespace KEY (callers use `useTranslations("listing")`
  — internal id like `p_listing_id`); `p_listing_id` RPC args; `reviews_listing_id_fkey`
  / `listing_photos_*_fkey` FK constraint NAMES (R3 kept them, cosmetic); landing/marketing
  copy ("not a listing buried in a marketplace", "Add your listing", FAQ "existing
  listings" which means Airbnb/Booking.com listings) — a separate marketing-copy concern.
  **DEFERRED to the website-build §5 IA pass:** the ~50 *hardcoded* (non-i18n) user-facing
  "Listing/Listing-wide/Listing basics" page headings, table column labels and error
  strings across host + admin pages. §5 restructures the sidebar/headings anyway and the
  right move is to *extract* those to i18n (per RULES §10), not hardcoded-swap them now.
  **The 5-checkpoint physical rename (R0–R4) is COMPLETE.** Next: the **website build**
  (plan `~/.claude/plans/ok-it-has-come-spicy-snail.md` §1+) — Property+Channels, per-business
  `host_websites` CMS, subdomains/custom domains, sidebar/IA restructure (§5, incl. the
  deferred label sweep), product gating.
