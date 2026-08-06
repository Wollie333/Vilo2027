# Wielo — Current Task

> Reset at the start of every session. This is the session contract.

## 🟢 SAVE POINT (2026-08-06) — **FRONT-PAGE FAIR SEARCH + LISTING STRENGTH — SHIPPED & LIVE** ⬅ START HERE

**`main` == `origin/main` == `0329ddb4`** (pushed, Vercel deploying). `pnpm build` + `pnpm lint` +
`tsc` all GREEN. Branch `feature/front-page-search` merged. Plan/SoT:
`docs/features/FRONT_PAGE_SEARCH_PLAN.md`. Memory: [[project-savepoint-aug6-fair-search]].

### ✅ Done this session (all live-verified, canvas + live)
1. **Modern front-page search bar** (`app/_components/browse/DirectorySearchBar.tsx`) — Where
   (keyword) · Type · Check-in/Check-out · Guests · Search. Branded `Select` popovers +
   `DateRangePicker` SSOT (never native controls). Mobile-first, equal-height desktop row. On the
   home `Hero` + `/explore` & `/portal/browse` (via `SearchBar` adapter; type = chips there). Header
   untouched.
2. **Real availability filtering** — `checkin`/`checkout` hide stays whose whole-listing is blocked
   for the range (`blocked_dates` `room_id IS NULL`). Half-set range = no filter.
3. **Ethical earned-only ranking** — mig `20260806170000`: weighted `search_vector` (name A ·
   location B · type C · description D); **plan boost REMOVED** (`ranking_weights.plan → 0`),
   `recalculate_listing_ranking()` rewritten. Mig `20260806180000`: **`search_directory()` RPC** =
   single filter+order SoT (FTS relevance × earned quality via `search_blend`, else `ranking_score`;
   all filters + availability + priority-country; returns `(id, total_count)`). `searchListings.ts`
   routes through it. PROVEN on live DB (rollback test): high-relevance free listing beats
   higher-quality weak-match; date-blocked listing excluded.
4. **Host "Listing Strength" page** — Gauge icon on each property card →
   `/dashboard/properties/[id]/strength` (breadcrumbs, 2-col spread), SEPARATE from listing setup.
   `lib/search/listingStrength.ts` (pure) + `lib/search/loadListingStrength.ts` (own-only: RLS
   ownership check THEN admin read, so drafts work) + `ListingStrengthCard.tsx` ("earned not bought"
   banner, component bars, quick-wins with **Fix →** deep-links to the editor tab).
5. **Public help article** — mig `20260806190000`: `/help/how-search-ranking-works` in the
   "Listings & photos" category (host audience, published). Live-verified render.

6. **Fair-search refinements** — mig `20260806200000`: host-diversity round-robin (max 2/host
   before others interleave; no-op for single-listing hosts) + new-listing grace boost + hourly
   banded rotation (recommended sort only; knobs `platform_settings.search_fairness`). Diversity
   PROVEN live in-browser + ranked results rendering confirmed (seeded 5 demos across 2 hosts,
   screenshotted, then DELETED → 0 published now); freshness proven via rollback.

### ⚠️ Known / traps
- **0 published accommodation listings in the DB** (demos removed after verifying) — real results
  appear once hosts publish. Everything is proven (SQL rollback + live browser).
- 🚨 **`supabase db push` can record a migration WITHOUT running its SQL** ("up to date" lie) — verify
  the row, then `migration repair --status reverted <ver>` + re-push. Also: **migration-timestamp
  collisions** after rebasing over concurrent main work (renamed article `190000`→`191000`).

### ▶️ Likely next (nothing left on fair search)
Possible nice-to-have: a **listing-strength badge on the properties list card**. Otherwise the older
backlog: **Meta CAPI creds + Vault secrets guide** ([[project-savepoint-aug6-per-user-controls]]).
