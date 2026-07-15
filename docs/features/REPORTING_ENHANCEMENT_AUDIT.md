# Reporting Enhancement — Audit & Plan (SAVE POINT)

> **Status:** audit complete, **not yet built**. Founder directive (2026-07-15):
> *"work on the reporting feature so each and every metric is reported on… refine,
> enhance and polish."* Scope confirmed = **BOTH surfaces**. This doc is the
> execution plan for a new session. Repo clean at the save-point commit.

Two surfaces, all paths under `apps/web/app/[locale]/`:
- **HOST** analytics — `dashboard/reports/` (rich, ~20 components; functional but
  gappy/hardcoded).
- **ADMIN** platform reporting — `admin/reporting/` (clean, but thin + a range bug).

**Robustness issue (both):** the 12 host analytics RPCs (`fetch_primary_kpis`,
`fetch_secondary_metrics`, `fetch_revenue_trend`, `fetch_channel_mix`,
`fetch_conversion_funnel`, `fetch_time_to_book`, `fetch_regional_breakdown`,
`fetch_seasonality_heatmap`, `fetch_guest_demographics`, `fetch_popular_rooms`,
`fetch_refunds_cancellations`, `fetch_looking_for_stats`, `fetch_property_performance`)
exist in the **live DB but NOT in any committed migration**. A fresh
`supabase db push` env would render the host reports' "Failed to Load Analytics"
error state. **Fold "capture the analytics RPCs into a migration" into this pass**
(dump `pg_get_functiondef` for each into a new migration) so reporting is
reproducible.

---

## HOST ANALYTICS (`dashboard/reports`)

### A. Quick polish — hardcoded / TODO / dead / broken

| # | Issue | Location |
|---|-------|----------|
| H1 | **Filter bar is non-functional (highest-leverage fix).** `ReportsFilters` keeps filters in local `useState` only — never writes to the URL, which the page reads from. Date-range button has no onClick; Compare only flips a legend; **Region + Channel filters are fully dead** (never reach the RPCs); Listing filter is a disabled placeholder. | `_components/ReportsFilters.tsx:162,169,217-280,283-340` |
| H2 | Occupancy "trend" bars are **fabricated with `Math.random()`** (shown as real). | `_components/PrimaryKPIs.tsx:253-276` (called `:207`) |
| H3 | `listingCount={24}` hardcoded (`// TODO Phase 2`). | `page.tsx:524` |
| H4 | Intro prints hardcoded **"24 active listings"**. | `page.tsx:537-538` |
| H5 | `hasAdvanced` computed then never used (eslint-disabled). | `page.tsx:135-143` |
| H6 | Top **"Schedule" button** is a no-op (empty `handleSchedule`); duplicates the working `ScheduledReportsSection`. Remove or wire. | `_components/ReportsFilters.tsx:154-157` |
| H7 | Region + Channel option lists hardcoded, not data-driven. | `_components/ReportsFilters.tsx:235-278,301-338` |
| H8 | Hardcoded default props (`"1 Jan"`, `"30 Jun 2026"`, `listingCount=24`); `handleReset` resets to a hardcoded label. | `_components/ReportsFilters.tsx:37-42,57` |
| H9 | Listing dropdown shows disabled "Individual listings will appear here". | `_components/ReportsFilters.tsx:209-212` |
| H10 | ChannelMix subtitle hardcodes **"Direct bookings save 15%"** — contradicts the Savings page (`HEADLINE_OTA_RATE` from `lib/savings/ota-competitors`). Pick one source. | `_components/ChannelMixPieChart.tsx:72` |
| H11 | **`page-minimal.tsx` is dead code** (debug stub, imported by nothing). Remove. | `page-minimal.tsx` |
| H12 | **`ExportButton.tsx` is dead code** (imported by nothing). Remove. | `_components/ExportButton.tsx` |
| H13 | "Export as PDF/XLSX" claims a full report but `generateFullReportAction` **only exports the property table** — no KPIs/funnel/demographics/etc. Widen it. | `_actions/generateFullReportAction.ts:59-94` |
| H14 | Revenue-trend grouping hardcoded to `"day"`; RPC supports `p_grouping` day/week/month — add a UI toggle. | `page.tsx:194` |

### B. Unshown-but-available metrics (returned by an RPC, never rendered)
- **Looking-For monthly trend** — `fetch_looking_for_stats` returns
  `trend:[{month,quotes_sent,accepted}]` (typed `page.tsx:443`, `LookingForStats.tsx:16`)
  but `LookingForStats` never renders it → add a trend chart (free).
- **`quotes_accepted` raw count** — returned (`page.tsx:333`), only `acceptance_rate`
  shown (`SecondaryMetrics.tsx:118`).

### C. New high-value host metrics to add (data source)
1. **Real occupancy trend** to replace the random bars (H2) — nights-sold time series
   (`bookings` + `property_rooms`) or reuse `fetch_revenue_trend`.
2. **Payment-method split** for the host's income (Paystack/PayPal/EFT) — `payments`
   domain / host ledger already carries `provider` (`lib/finance/transactions.ts`).
3. **Add-ons / extras revenue** — quotes/invoices/add-ons (`20260524000001`).
4. **Coupon usage & discount given** — coupons domain.
5. **Wielo Credits balance / spend** — `wielo_credit_ledger` (`20260715150000`).
6. **Revenue-trend period toggle** (day/week/month) — RPC already supports (H14).
7. **Weekday vs weekend / lead-time revenue** — `bookings` check-in dates.

---

## ADMIN PLATFORM REPORTING (`admin/reporting`)

### A. Correctness (page itself has no TODOs/hardcodes)
| # | Issue | Location |
|---|-------|----------|
| A1 | **Range filter does NOT affect the charts.** `buildPlatformReport` always builds a fixed last-12-calendar-months `monthly` series regardless of `range`; only `collectedPeriod`/`newUsersPeriod`/`rangeLabel` are period-scoped. 30D/90D/6M/YTD leave the Revenue + User-growth charts unchanged and the Revenue header always says "over 12 months." | `lib/billing/platform-report.ts:217-252`; `page.tsx:46,120-138`; `RevenueAreaChart.tsx:36` |
| A2 | **Plan donut mislabels one-off products as subscriptions.** `report.plans` includes `type:"one_off"` product rows; `PlanDonutChart`'s local `Slice` drops `type`+`testOnly`, so the title reads "N subscriptions" while summing one-off units, and the `testOnly` tag never shows. | `PlanDonutChart.tsx:5,17,30`; `platform-report.ts:279-299` |

### B. Unshown-but-available (on the report object, not displayed)
- **`kpis.bookingCount`** — computed (`platform-report.ts:349`), never rendered.
- **`PlanSlice.type`/`testOnly`** — dropped by the chart (A2).
- **`MonthlyPoint.signups`** (total/month) — computed (`:249`), unused.
- **`generatedAt`/`periodStart`** — available, not surfaced.

### C. New high-value platform metrics (all data exists; none computed today)
1. **Payment-method split (Paystack/PayPal/EFT)** — `fetchWieloLedger` returns
   `provider` per row (`wielo-ledger.ts:60,156`); aggregate.
2. **VAT / output tax collected** — ledger returns `vat_amount` (`:113`).
3. **MoM growth %** (revenue, signups, MRR) — from the existing `monthly` array.
4. **Refunds / credit-notes detail** — `wielo_credit_notes` (`20260708130000`): list,
   reasons, trend (only a single `refunded` total shown today).
5. **Affiliate commissions / payouts** — `affiliate_commissions` (`20260616000010`);
   absent from platform reporting.
6. **Wielo Credits sold & spent** — `wielo_credit_ledger` (`20260715150000`) +
   credit `product_orders`.
7. **Quote & Looking-For platform volume** — `quotes`, `looking_for_posts`/`responses`.
8. **Take-rate / net revenue** — Wielo revenue ÷ GMV (both already computed).
9. **Per-plan revenue share %** + **ARR-per-plan** — `plans[].mrr` exists; add share + ×12.
10. **Cohort retention / LTV / net revenue retention** — `subscriptions` +
    `user_profiles.created_at` (churn is only a flat count/rate today).
11. **Geography of hosts/guests/bookings** — `properties.province` + `bookings`.
12. **Total vs active listings & listings-per-host**.
13. **GMV trend & booking-status distribution**.

---

## Cross-surface + exports
- **Commission-saved framing differs** — Host ChannelMix "15%" (hardcoded H10) vs the
  Savings page's `HEADLINE_OTA_RATE`. Single source.
- **"Full report" export (host)** is really just the property table (H13) — if new
  metrics are added, widen `lib/reports/export/pdf.tsx` + `xlsx.ts` or it under-reports.

## Suggested build order (new session)
1. **Migration**: capture the 12 analytics RPCs into a committed migration (reproducibility).
2. **Host H1** (filters → URL) — unblocks per-listing/region/channel; then H3/H4 (real
   listing count), H2 (real occupancy trend), remove dead code (H11/H12), H10, H6.
3. **Host B + C**: surface the LF trend + accepted count; add payment-method / add-ons /
   coupons / credits metrics; revenue-trend toggle (H14); widen the export (H13).
4. **Admin A1** (range-aware `monthly`) + **A2** (donut type/label fix); render
   `bookingCount`; then C1–C13 platform metrics (payment split, VAT, MoM %, credit-notes,
   affiliate, credits, quote volume, take-rate, per-plan share, retention, geography).
5. Verify live in BOTH the builder canvas and live render (Principle #9): drive each
   surface, confirm every new metric shows real numbers, and both PDF exports match.
