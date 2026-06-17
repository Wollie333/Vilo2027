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
| `listings` | RENAME | `properties` | R2 |
| `listing_rooms` | RENAME | `property_rooms` | R2 |
| `listing_photos` | RENAME | `property_photos` | R2 |
| `listing_amenities` | RENAME | `property_amenities` | R2 |
| `listing_seasonal_pricing` | RENAME | `property_seasonal_pricing` | R2 |
| `listing_policies` | RENAME | `property_policies` | R2 |
| `listing_addons` | RENAME | `property_addons` | R2 |
| `listing_rankings` | RENAME | `property_rankings` | R1 |
| `listing_points_of_interest` | RENAME | `property_points_of_interest` | R1 |
| `listing_review_themes` | RENAME | `property_review_themes` | R1 |
| `listing_counters` | RENAME | `property_counters` | R1 |
| `listing_access` | RENAME | `property_access` | R1 |
| `listing_local_picks` | RENAME | `property_local_picks` | R1 |
| `listing_room_access` | RENAME | `property_room_access` | R1 |
| `listing_view_events` | RENAME | `property_view_events` | R1 |
| `listing_categories` | RENAME | `property_categories` | R1 |
| `featured_listings` | **KEEP** (directory channel) | — (col→property_id) | R3 |
| `directory_search_logs` | **KEEP** (directory channel) | — (`clicked_listing`→`clicked_property`) | R3 |

> Verify the full table set against the live DB before R1/R2 (grep `CREATE TABLE …
> listing`). `listing_categories` is the taxonomy catalog — confirm it's property-scoped
> before renaming; if it's a global taxonomy it may stay (decide in R1).

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
- [ ] **R1** Leaf tables renamed + isolated fns recreated + code swept. Green. Commit.
- [ ] **R2** Core tables renamed + core fns recreated + `.from()`/embeds/types swept. Green. Commit.
- [ ] **R3** `listing_id → property_id` (+ listing_type etc.) + fns recreated + code swept. Green. Commit.
- [ ] **R4** Routes + i18n labels. Green. Commit.
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
