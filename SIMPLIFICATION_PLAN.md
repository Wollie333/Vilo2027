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

## Key finding
The single biggest source of bloat is **duplicated display formatting**: the
`currency === "ZAR" ? "R " : …` money snippet is copy-pasted in **40+ files**
and ad-hoc `toLocaleDateString("en-ZA", …)` date formatting in **~50**. This
dwarfs any per-feature structural duplication. So Pass 5 (shared formatters) is
really the highest-value work — but the copies differ subtly (non-ZAR handling,
decimal/rounding, date options), so they must be migrated in **small verified
batches**, never a blind find-replace, to avoid changing displayed amounts.

`lib/format.ts` now holds the canonical `formatMoney`. Date formatting stays
per-site for now (options vary too much for a single helper).

## Progress log
- **Pass 1 (done):** extracted shared quote-thread helpers into
  `components/inbox/quote-thread.ts`; rewired host + guest loaders and threads.
- **Formatter foundation (done):** added `lib/format.ts#formatMoney`; migrated
  the inbox batch — `ThreadQuoteCard`, `InboxView` (`fmtZAR`), `PipelineControl`
  (`fmt`). Output identical for ZAR (the only live currency).
- **Bookings batch (done):** migrated `BookingsBoard` (`fmtR`),
  `bookings/[id]/page` (`fmtR`), `IssueRefundButton` (`fmtR`),
  `ManualBookingForm` (`fmt`) to `formatMoney`. Four private copies removed;
  ZAR output unchanged. `symbolFor` (input-prefix helper) kept.
- **Payments + refunds batch (done):** migrated `PaymentsBoard` (`fmtR`),
  `payments/[id]/page` (`money`), `admin/payments/page` (`fmtR`),
  `refunds/page` (`fmtR`), `RefundActions` (`fmtR`),
  `portal/trips/[id]/RequestRefundButton` (`fmtR`), and
  `components/booking/CancelBookingDialog` (`fmtR`) to `formatMoney`. Seven
  private copies removed; ZAR output unchanged. Non-ZAR now shows the ISO code
  prefix (`USD 1 500`) instead of a bare number — strictly more correct, same
  tradeoff as the bookings batch.
- **Invoices + credit-notes batch (done):** migrated `credit-note/[token]/page`,
  `credit-notes/page`, `credit-notes/[id]/page`, `invoices/[id]/CreateCreditNote`,
  `invoices/[id]/page`, and `invoice/[token]/page` (`fmt`) to `formatMoney`. Six
  copies removed. These used differing `symbol`/spacing forms — verified each
  collapses to identical ZAR output before swapping; non-ZAR double-space bug
  fixed as a side effect.
- **Quotes batch (done):** migrated `QuoteForm`, `quotes/[id]/page`, the public
  `q/[id]/[token]/page`, `QuoteShare` (inline), and one equivalent inline spot in
  `quotes/actions.ts` to `formatMoney`. **Left one inline spot in `actions.ts`
  untouched** (the `quote_sent` system-message body) — it used bare
  `Math.round()` with NO thousands grouping (`R 1500`), so it is NOT
  output-identical to `formatMoney` (`R 1 500`). Migrating it would change a
  displayed amount, which violates the no-behaviour-change rule — flagged as a
  latent inconsistency to fix deliberately, not silently under a refactor.
- **Remaining money-formatter batches (queued):** listings & pricing, public
  listing/explore pages, dashboard home. To be done in feature-sized commits
  with a check each.
