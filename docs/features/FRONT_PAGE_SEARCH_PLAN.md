# Front-Page Availability Search + Fair Ranking — Build Plan

> Branch: `feature/front-page-search`. Founder brief: modernise the home-page
> search bar (dates / type / keyword / guests) and build an **ethical, fair**
> "Google-styled" ranking so hosts compete on *listing optimisation*, not spend.

## Founder decisions (locked 2026-08-06)

1. **Remove plan from rank.** Subscription plan no longer buys search position.
   Paid plans monetise via *features* (more photos, richer tooling) that help a
   host optimise naturally. `ranking_weights.plan` → 0; weight redistributed to
   earned signals.
2. **Dates filter availability.** Check-in/out hide stays fully blocked for the
   range (whole-listing `blocked_dates`, `room_id IS NULL`). Dates also carry
   forward to pre-fill the booking calendar.
3. **Build all together** on one branch before merge.

## What exists today (ground truth)

- Home search = plain GET form → `/explore`, only `where` + `guests`
  (`apps/web/app/_components/home/Hero.tsx`).
- `/explore` backend `searchListings.ts`: `where` (naive `ILIKE`), `type`
  (category slug), `guests`, advanced filters. **No relevance scoring, no dates.**
- Availability = `blocked_dates(property_id, room_id, date)`; `room_id IS NULL`
  = whole-listing block. Public-readable for published properties.
- Ranking = `properties.ranking_score`, recomputed every 15 min by
  `recalculate_listing_ranking()`; weights in `platform_settings.ranking_weights`
  = rating .30 / reviews .20 / profile .15 / response .15 / **plan .20**.
- FTS precedent already in repo: `help_articles.search_tsv` (generated tsvector
  + GIN, `.textSearch(..., {type:'websearch'})`).

## Architecture — two-stage search

**Stage 1 · Relevance (Google-styled).** `properties.search_document tsvector`
GENERATED ALWAYS from name (A) · city/province (B) · accommodation_type (C) ·
description (D) + GIN index. Query via `websearch_to_tsquery` → phrases,
stemming, multi-keyword. Replaces binary `ILIKE`.

**Stage 2 · Quality × Fairness.** Order = relevance blended with an *earned*
quality score. Because `ts_rank` is query-time, ranked search moves into a SQL
function `search_directory(...)` (returns page of ids + total). Non-query browse
keeps ordering by the precomputed `ranking_score`.

### Fair ranking components (post-change)
- Guest rating (earned) · review volume (log-normalised)
- **Listing optimisation/completeness** (photos ≥5, description, city, amenities
  ≥3, check-in time, up-to-date calendar) — the lever every host controls
- Host responsiveness (real messages)
- **Plan boost REMOVED** (founder decision #1)
- Freshness/exploration: new-listing grace + banded rotation (stable per query)
- Host diversity: cap consecutive listings from one host

### Anti-gaming
- Keyword-stuffing resistance (tsvector de-dups terms; cap per-field weight)
- Location honesty: "near X" matches structured city/province, not free text
- Only verified signals (real bookings → reviews; real response rate)

### Transparency (makes "fair" real)
- Host **"Listing Strength"** panel: their optimisation score + concrete
  "do X to rank higher" tips, from the same signals the algorithm uses.
- Public help article listing the ranking factors (no hidden pay-to-win).

## UI

Modern one-pill search bar (header untouched): **Where · Type · Dates · Guests ·
Search**. Branded `DateRangePicker` SSOT (never native `<input type=date>`).
Mobile-first (stacks on small screens). Used on Hero + `/explore`.
New params: `checkin`, `checkout` (+ existing `where`, `type`, `guests`).

## Phases (all on this branch)

- **P1 — DB foundation:** migration: `search_document` tsvector + GIN; rewrite
  `recalculate_listing_ranking()` (drop plan boost, add calendar-freshness);
  `ranking_weights` reweighted (plan→0); `search_directory()` SQL function
  (FTS relevance blend + availability filter + host diversity). Regenerate types.
- **P2 — Backend:** route `searchListings.ts` through `search_directory` when a
  query/date is present; add `checkin`/`checkout` parsing + availability filter.
- **P3 — UI:** new `HomeSearchBar` (client) with DateRangePicker + type select;
  wire into Hero + `/explore`; carry dates to booking.
- **P4 — Transparency:** host Listing-Strength panel + public ranking-factors
  help article.
- **P5 — Verify:** canvas + live (founder rule #9) — relevance ordering, a
  well-optimised free listing outranking an under-optimised paid one, date filter
  hides blocked stays, no console/build/lint errors.

## Guardrails
- No pay-to-rank once shipped — assert a free, well-optimised listing can top a
  paid, under-optimised one (fairness proof).
- `where` still runs through `sanitizeSearch` before any query grammar.
- Availability filter must distinguish "no date filter" from "filter matched
  nothing" (the amenity-filter NO_MATCH lesson).
