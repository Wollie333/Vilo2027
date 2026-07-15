# Looking-For — next-phase plan (founder requests, 2026-07-15)

Three founder requests captured mid-session to pick up fresh. Everything below is
NEW work; the enhancement pass that precedes it (create-data form, template modal,
flexible dates + deadline cap, WYSIWYG details, matching engine + notification
worker, and the admin-managed **Requirements** step) is shipped and on `main`
(commits `8e479c4f` → `bd2a19d7`). See `docs/lifecycles/looking-for.md`.

> **Verify-first carry-over:** the **requirements ADMIN UI** (`/admin/platform/looking-for`,
> commit `bd2a19d7`) is build/lint-green but was **not driven live** (needs a
> super-admin session — `wollie@manamarketing.co.za`, magiclink → local
> `/auth/confirm`). First thing next session: log in as super-admin, add/edit/delete
> a group + option, confirm it flows to the guest picker. The guest-facing
> requirements flow itself IS verified live.

---

## 1. Location step → Google-Maps address + pin + radius

**Goal:** In the request form's **Location & budget** step, let the guest type an
address (autocomplete → prefill), OR drop a **pin on a map**, then set a **radius**
around that point to describe the area they'll consider. Store lat/lng + radius so
search (feature 2) and host matching can use "within X km of here".

**Reference implementations (read these first):**
- `apps/web/app/[locale]/dashboard/properties/[id]/edit/Editor.tsx` — the listing
  editor already does address → geocode → map pin (the "type an address, prefill
  fields" flow the founder referenced). Reuse the same component/approach.
- `apps/web/app/api/geo/route.ts` — the geocoding endpoint already in use.
- `apps/web/app/[locale]/signup/host/Wizard.tsx` — host signup address prefill.
- Extract/repurpose whatever map+autocomplete component the Editor uses into a
  shared `components/location/` component if it isn't already shared.

**DB:** `looking_for_posts` already has `location_lat` / `location_lng` (DECIMAL(9,6))
and `location_text` / `location_region`. **Add** `location_radius_km INT` (nullable;
migration). Consider a PostGIS point later, but lat/lng + radius is enough for a
Haversine filter.

**Form wiring (RequestForm.tsx, `location` step):**
- Add a map picker (pin draggable) + address autocomplete above the current
  Region / Specific-location / budget fields.
- On address select OR pin move: set `locationText`, `region` (province), `lat`,
  `lng`. Add a "Search radius" slider/select (e.g. 5 / 10 / 25 / 50 / 100 km) → new
  `radiusKm` value.
- Extend `RequestEditValues` with `lat`, `lng`, `radiusKm`; thread through
  buildPayload → `createRequestAction`/`updateRequestAction` (add to
  `CreateRequestInput` + the insert/update) → edit page load.
- Show "within N km of <place>" on the rail sub, Review summary, and the post
  detail (+ host respond summary).

**Gotcha:** the map/autocomplete needs a client component; keep the API key handling
the same way the listing editor does (don't expose secrets client-side beyond the
already-public maps key).

---

## 2. Public advanced-search page for Looking-For

**Goal:** A richer public browse experience than the current `/looking-for`
directory — a **1/4 left sidebar of live search parameters** + **3/4 right column of
horizontal, enriched cards**, one per active public post.

**Base / references:**
- `apps/web/app/[locale]/looking-for/page.tsx` — current public directory (grid of
  cards + `DirectoryFilters`). Evolve this (or a new `/looking-for/search` route)
  into the sidebar+results layout.
- `apps/web/app/[locale]/looking-for/_components/DirectoryFilters.tsx` — existing
  filter bar; move/expand its controls into the left sidebar.
- Card enrichment: pull the same signals the host board shows — guest trust badges,
  budget, dates + **flex window**, guests, **requirements chips** (reuse
  `RequestRequirements` / `buildRequirementCategories`), quote count, "expiring
  soon", and (from feature 1) the location + radius.

**Sidebar params:** category, region/province, **radius-from-a-point** (ties to
feature 1 — "requests near me" / near a searched place), date range, guests,
budget band, property-type / facilities (the admin **requirements** taxonomy —
`getLookingForRequirements()`), urgent-only, sort (newest / expiring / budget).

**Data:** a server action or route that filters `looking_for_posts` (status active,
public, unexpired) by the params, joins requirements + guest trust, and returns
enriched cards. Haversine distance filter when a point + radius is supplied. Keep
it URL-driven (searchParams) so results are shareable/SSR-friendly like the current
directory.

**Layout:** `lg:grid-cols-[1fr_3fr]` — sticky sidebar left, results right; cards are
**horizontal** (image/thumb left, details middle, CTA right) and responsive (stack
on mobile).

---

## 3. Guest "Looking-For" CRM archive tab

**Goal:** In the guest portal under the **Looking For** area, an **archive** of ALL
the guest's requests where each post is a **CRM record** — one place to manage the
post plus every quote and conversation tied to it.

**References:**
- `apps/web/app/[locale]/admin/users/[id]/UserRecord.tsx` — the guest/user CRM
  record design the founder said to follow (tabbed record with related activity).
  Mirror its layout/《tabs》 for a "request record".
- `apps/web/app/[locale]/portal/looking-for/page.tsx` — current guest list of own
  posts (becomes / links to the archive).
- `apps/web/app/[locale]/portal/looking-for/[id]/page.tsx` — current per-post detail
  (received quotes list) — the seed of the record view; enrich it into the CRM view.
- Quotes + threads: `looking_for_responses` → `quotes` + `conversations` /
  `messages`. A request's responses already join host + quote; add the conversation
  thread per response so messaging lives on the record.

**Build:**
- New nav sub-tab (e.g. `/portal/looking-for/archive` or make the existing list the
  archive) listing every post (active/fulfilled/expired/cancelled) with status,
  quote count, unread-message count, last activity — CRM-row style.
- A **record view** per post (evolve `[id]/page.tsx`) with tabs/sections:
  **Overview** (the request + status + fulfil/extend/cancel actions),
  **Quotes** (each `looking_for_responses` → quote card, accept/decline/pay),
  **Messages** (the conversation thread(s) with the quoting hosts, inline reply —
  reuse the inbox message primitives), **Activity/timeline**.
- Goal: the guest never leaves the record to compare quotes, read the host's
  message, accept, or pay.

**Note:** the inbox already has shared guest↔host thread primitives (see memory
`project-guest-portal-parity` / the portal inbox). Reuse them rather than rebuilding
messaging.

---

## Suggested order

1. **Feature 3 (CRM archive)** — highest guest value, reuses existing data
   (responses/quotes/conversations), no new external deps.
2. **Feature 2 (advanced search)** — builds on the enriched card work; ties to
   feature 1's location/radius for "near me".
3. **Feature 1 (map + radius)** — needs the maps component + a migration; feeds
   the radius filter in feature 2.

(Order is a suggestion — feature 1's `location_radius_km` migration is a small
prerequisite if you want radius search in feature 2 immediately.)

Each ships in its own verified-live commit, per the founder's Principle #9.
