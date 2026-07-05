# Website search-results — plan (room-based, designed, previewable)

Founder ask: 'Check availability' on the host site → a designed, website-scoped
results page showing **room cards** (ALL rooms; available first, unavailable clearly
indicated), each with a **Book now** button that deep-links to the website checkout
with the searched **dates pre-filled** (still editable). Must be **previewable and
style-editable in the page builder**. Inspiration: the Wielo/marketplace property
listing, but scoped to this one site and in its theme.

## What exists (map)
- `components/site/sections/SearchResultsSection.tsx` — current results block. It is
  **property-based** (quotes every bookable PROPERTY via `/api/website-quote`),
  **filters out unavailable**, and renders minimal cards. In the builder
  (`interactive=false`) it shows only a placeholder → **not previewable**.
- `search_results` is a system standard page (slug `search-results`,
  `standardPages.ts`); `siteSearchHref(ctx)` → `/search-results?...`.
- `siteBookHref(ctx, {roomId,from,to,guests})` → `/book?room=&from=&to=&guests=` —
  the checkout already reads these to prefill. ✅ reuse as-is.
- `quoteWebsiteStay()` (`bookingFunnel.ts`) → availability + price for a PROPERTY +
  dates. Room-level needs a per-room availability + price (see Slice 2).
- Room card anatomy exists in `RoomsPreviewSection` (image/name/price/facts/button)
  + per-element styling keys (card/image/title/price/button/badge).
- Demo data: `DEMO_BOOKING` (properties) in `sampleSite.ts`; `DEMO_ROOMS` (rooms).

## Slices (each ends green + committed)

### Slice 1 — Previewable in the builder ✅ (this doc's first ship)
Render designed DEMO room-result cards when `interactive=false` (builder preview),
so the host can open the search-results page and edit the card/section STYLE. No
network. Available-first ordering + an "Unavailable" state shown on demo cards so the
design of both states is editable.

### Slice 2 — Room-based results data + design (live)
- Loader: for the site's visible rooms, compute per-room availability + price for
  the searched dates. Single-property site → the property's rooms; multi-property →
  all rooms across bookable properties. Reuse the availability RPC per room
  (`listing_is_available_*`) + `computeStayPricing` per room.
- Render ROOM cards (not property cards): image, name, capacity/facts, price for the
  stay, an availability badge. Show ALL rooms — available first (sorted), unavailable
  greyed + "Not available for these dates" + Book disabled.
- Per-element styling (card/image/title/price/button/badge) so it's builder-editable.

### Slice 3 — Live 'Check availability' → results page
Ensure every availability form (BookingSearch / availbar / hero search) navigates to
`siteSearchHref` with `?from=&to=&guests=` on submit (single-property too, not only
multi-property). The results page reads the query + auto-runs the search.

### Slice 4 — Book now → checkout with dates pre-filled
Each available room card's "Book now" → `siteBookHref({roomId, from, to, guests})`
(→ `/book?room=&from=&to=&guests=`). Checkout prefills dates (already supported);
dates remain editable there.

## Notes
- Keep the property-based multi-property path working (fallback) where a site has
  many properties; rooms are grouped under their property.
- Theme-scoped via `--site-*`; card styling via `--el-*` (Principle #6 + #8).
- Verify canvas (builder preview) AND live for each slice.
