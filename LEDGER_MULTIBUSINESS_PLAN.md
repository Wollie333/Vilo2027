# Ledger ↔ Multi-Business — Plan

> Saved plan (2026-06-13). Make the ledger business-aware and add a per-business
> filter to the **Ledger** and **Guest Record**, while the guest's headline
> balance still sums across ALL businesses. Decisions locked with the founder.

## Decisions (locked)
1. **Business per transaction = derived via listing.** Resolve each transaction's
   business from `booking → listing → business_id` in the ledger layer. No
   `business_id` columns on `payments`/`quotes`/`refund_requests` (single source
   of truth = the listing; nothing to drift).
2. **Store credit is per-business.** Add `business_id` to `guest_credit_ledger`
   so credit issued under Business 1 is attributable to Business 1. The guest's
   headline net balance still nets across all businesses.

## What's ALREADY done (verified 2026-06-13 — no work needed)
- `listings.business_id` canonical link; `booking_business_id()` resolver; default-business fallback.
- **Every finance document renders the listing's business** — invoices, credit
  notes, receipts, quotes (public page + PDF), and the `/pay` page all pass the
  listing's `business_id` into `getHostParty()` (business identity + per-business
  banking + per-business logo). Invoices/credit notes additionally **snapshot**
  business details frozen at issue.
- **Per-business document numbering** (`business_counters`, `next_*_number(business_id)`).
- **Guest directory already filterable by business** — `fetch_host_guests(p_business_id)`
  exists; `guest_business_links` table tracks guest ↔ business engagement (no UI yet).

## The gaps to close (the actual work)
1. The ledger is business-blind: `Txn` has no business; `fetchHostTransactions`
   has no business filter — all businesses merge into one stream.
2. No business filter UI on the **Ledger** page or the **Guest Record** Finances tab.
3. `guest_credit_ledger` (store credit) has no `business_id` — can't attribute or filter credit per business.

## Phased plan

### Phase 1 — Ledger becomes business-aware (data layer)
- `lib/finance/transactions.ts`:
  - Add `businessId: string | null` to the `Txn` type.
  - In `fetchHostTransactions`, resolve each row's business via its booking's
    listing (`booking_id → bookings.listing_id → listings.business_id`). Batch
    the lookup (one `listings` map keyed by id) — don't N+1.
  - Add a `businessId?: string | null` filter param. When set, return only Txns
    whose derived business matches (account-level rows w/o a booking — e.g.
    manual store credit — match on the credit row's own `business_id` once Phase 3
    lands).
  - Keep running-balance maths unchanged; it already groups per guest.
- `lib/payments/ledger.ts`: no change to the per-booking maths (a booking is one
  business by definition). Only the account/guest aggregation gains a filter.

### Phase 2 — Business toggle UI
- Shared `BusinessFilter` selector (reuse/extend any existing business selector;
  options = host's non-archived businesses + "All businesses" default).
- **Ledger page** (`dashboard/ledger`): add the selector to `LedgerBoard`
  filters; pass `businessId` to `fetchHostTransactions`. Show the active
  business's name in the header/summary.
- **Guest Record Finances tab** (`dashboard/guests/[gkey]`):
  - Add the same selector scoped to the businesses this guest has actually
    engaged (from `guest_business_links`), plus "All".
  - **Headline net balance stays all-businesses** (per decision). When a business
    is selected, show that business's outstanding + credit as a secondary subtotal
    on the rows, not in the headline.
- `components/finance/LedgerList.tsx`: optionally show a small business chip per
  row when "All businesses" is selected (so mixed rows are legible).

### Phase 3 — Per-business store credit
- Migration: add `business_id uuid REFERENCES businesses(id)` to
  `guest_credit_ledger` (nullable for legacy/unattributed; new rows always set).
  Index `(host_id, business_id, gkey)`.
- Populate `business_id` on write: from the originating booking's business when a
  credit comes from a booking/overpayment; from the selected business when issued
  manually in the Guest Record.
- Guest Record balance: headline still sums all credit; the per-business view
  nets only that business's credit + outstanding.
- Regenerate types.

### Phase 4 — Verify, help, ship
- Service-role sweep: a host with two businesses + one shared guest — confirm the
  Ledger and Guest Record filters scope rows correctly and the headline balance is
  unchanged across filters.
- Eyeball one real invoice + quote PDF to confirm the correct business header
  (closes the original "business info on documents" concern).
- Help article touch-up (Ledger filter); `pnpm build` + `pnpm lint`; CHANGELOG +
  CURRENT_TASK; chunked commits per phase.

## Files (anticipated)
| Area | Path |
|---|---|
| Txn type + filter | `apps/web/lib/finance/transactions.ts` |
| Ledger page/board | `apps/web/app/[locale]/dashboard/ledger/page.tsx`, `LedgerBoard.tsx` |
| Row chip | `apps/web/components/finance/LedgerList.tsx` |
| Guest finances | `apps/web/app/[locale]/dashboard/guests/[gkey]/page.tsx`, `GuestRecord.tsx` |
| Store credit migration | `supabase/migrations/<ts>_guest_credit_business.sql` (new) |
| Types | `packages/types/database.types.ts` (regen) |
| Help seed | `supabase/migrations/<ts>_help_ledger_business_filter.sql` (new) |

## Open sub-decisions at build time
- Guest Record selector source: businesses-this-guest-engaged (`guest_business_links`)
  vs all host businesses. Default: engaged-only (cleaner), "All" always present.
- Whether to show a per-business subtotal band in the Guest Record when filtered
  (recommended) vs rows-only.
