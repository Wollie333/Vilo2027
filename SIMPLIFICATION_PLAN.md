# Simplification Plan — reduce bloat, keep behaviour

Goal: streamline the codebase feature-by-feature — less duplication, fewer
moving parts, faster reads — **without changing behaviour**. Each pass ends
green (`pnpm build` + `pnpm lint`) and is committed on its own so it can be
reviewed/reverted in isolation.

## Principles (non-negotiable)
- No behaviour change. Same inputs → same outputs, same UI.
- One concern per commit. Small, reviewable diffs.
- Delete > rewrite. Prefer removing dead code and duplication over re-architecting.
- Verify each pass: build, lint, and a live-DB query sweep for any changed `.select()`.
- Don't touch payments/webhooks/migrations under the banner of "simplification".

## Method per feature
1. Map the files in the feature.
2. Find: duplicated helpers, repeated query strings + row→VM mappers, dead
   code, oversized components doing several jobs, needless client state.
3. Extract the shared bit once; rewire call sites. Keep names/signatures.
4. Build + lint + sweep. Commit.

## Feature checklist
- [x] **Pass 1 — Comms / inbox** (enquiry → pipeline → quote card → claim).
      Dedup quote-card column list, row→`ThreadQuote` mapper, and
      first-message-per-quote logic shared by host + guest threads.
- [ ] Pass 2 — Quotes (builder, send, accept, public `/q` page).
- [ ] Pass 3 — Bookings (board, detail, manual booking).
- [ ] Pass 4 — Listings (editor, photos, pricing).
- [ ] Pass 5 — Cross-cutting: a single `lib/format.ts` (money/date/relative)
      to replace the ~half-dozen private copies (email, pdf, inbox, bookings…).
      Done last because it touches the most files.

## Progress log
- Pass 1 started: extracted shared quote-thread helpers into
  `components/inbox/quote-thread.ts`; rewired host + guest loaders and threads.
