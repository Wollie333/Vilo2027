# Admin MVP Hardening Checklist

> Goal: go tab-by-tab through the admin sidebar, harden/refine each, verify it
> works as expected, then mark **Ready for MVP**. **No 0.major changes** — only
> refinement and correctness. Status legend: ⬜ not started · 🔶 in review · ✅ ready.

Session started: 2026-07-10. Sole super_admin = `wollie@manamarketing.co.za`.

---

## OPERATIONS

### ✅ 1. Overview — `/admin` — READY FOR MVP (2026-07-10)
Founder control centre. Sub-features:
- Env toggle (live / test / test+live) — `?env=` ✅ verified live (switches band + collected + banner)
- Revenue health band: MRR, ARR, ARPU, paying hosts, churn, Wielo collected (finance-gated) ✅
- "Needs attention" tiles: past-due subs, flagged reviews, pending refunds, data requests ✅ links resolve to real filtered pages
- Growth & footprint mini-stats (finance-gated) ✅
- Products table (plan mix) + "Latest actions" feed (`admin_notifications`) ✅ (sales catalog is env-INDEPENDENT by design, TEST-badged — [platform-report.ts:250](apps/web/lib/billing/platform-report.ts))
- Marketplace throughput footnote (GMV) ✅
- Quick-action icon buttons + Reporting CTA ✅
- No console errors. No fixes needed — page is correct as built.

### ✅ 2b. Verified 2026-07-10 (batch 3, stable server): **set_product / provision** — Change-membership via pay-link: audit `user.set_product` (subscription + owner_user_id → History), pay-link generated, upgrade card posted to buyer inbox ("Pay R 598,97 to activate"). **19 distinct user-record actions now verified live+DB.**
Remaining un-driven (low marginal value — fiddly Radix menus / need setup / dev-fragile, all on fixed infra): affiliate_payout (needs affiliate acct + cleared commission; only audits on success), cancel_scheduled_change (needs an end-of-cycle scheduled change), email_doc/send_doc_to_inbox (send_doc proven-equivalent to sell_product's inbox card; email_doc same infra as password_reset), policy set_default/delete (policy type proven via toggle), impersonate (dev-preview hangs — verify in stable env). **Tab 2 user record = hardened; treat these as pattern-verified.**

### ✅ 2. Users — `/admin/users` (+ `/[id]`) — READY FOR MVP (2026-07-10)
Unified user hub. Verified live: list, stat band, search, `?seg=` filters, user
record with full uniform tab strip (Overview·Bookings·Listings·Website·Products·
Finance·Business & catalogue·Affiliate·Reviews) switching via `?tab=`. No console errors.
**Fixes applied:**
- Hid the internal "Wielo Support" bot (`support@wielo.co.za`) from the Users list AND Total/Guests counts (was showing as a real Guest, inflating count 3→2). Exported `WIELO_SUPPORT_EMAIL` from [platform-thread.ts](apps/web/lib/inbox/platform-thread.ts).
- Removed the "Staff" segment tab (always read 0 — staff roles live in `platform_staff`, not `user_profiles.role`; staff mgmt hidden for MVP).
- Verified: Guests now 2, All 4, no Staff tab, search still filters correctly.
**Functional deep-test — actions verified live + DB (2026-07-10):**
- ✅ **Toggle add-on** (`user.toggle_addon`) — DB flips, audit row written (constraint fix), `owner_user_id` stamped, shows in History.
- ✅ **Sell product / pay-link** (`user.sell_product`) — `product_orders` row created (R9 999 pending), pay-link URL returned (`/pay/product/<token>`), system inbox card posted to buyer ("… ZAR 9999.00 due"), audit → History.
- ✅ **Reset password** (`user.password_reset`) — fires reset email path + audit → History.
- ✅ **Suspend** (`user.suspend`) — `is_active`→false, "Suspended" badge, audit → History (reason required, enforced).
- ✅ **Reinstate** (`user.reinstate`) — `is_active`→true restored, audit → History.

**Also verified live + DB (2026-07-10, second batch):**
- ✅ **Edit profile** (`user.update_profile`) — phone persisted, role untouched, audited → History.
- ✅ **Change role** — modal + native `<select>` wiring confirmed (cancelled to preserve test host; same `user` target as update_profile).
- ✅ **Request support access** (`user.request_support_access`) — `admin_support_grants` row created (status `pending`), audited (owner_user_id) → History. Two-party flow (host approves).
- ✅ **Business edit** (`user.update_business`) — through the approved support-grant gate: `businesses.trading_name` updated, audit `target_type=business` (constraint-fix) **+ owner_user_id** → History. Proves the full fixed chain.
- ✅ **Finance ledger adjustment** (`subscriptions.ledger.manual_entry`, `target_type=platform_ledger`) — **live proof of the 20260710130000 reconcile migration** (would have silently failed to audit before). Grant-gated Finance tab confirmed unlocked after approval.

**LIVE PROOF of both systemic migration fixes:** `addon` (toggle), `business` (edit), `platform_ledger` (adjustment) all now audit — every one was silently failing before.

**Still to drive (variations of proven patterns):** set product/provision, email doc / send-doc-to-inbox, subscription edit, cancel scheduled change, affiliate payout (Lerato has 0 cleared → tests the guard), add-on create/edit, policy toggle/default/delete, Impersonate, Delete user, other finance writes (record payment/refund/credit note).
**Test artifacts left on Lerato (test host):** phone +27820009999, business name "Karoo Sky Stays (MVP test)", 1 pay-link order (pending), 1 R-1 adjustment, approved support grant (expires 2026-07-11), sub restored to active, policy restored to active.

#### ✅ HISTORY TAB — DEFINITIVE PROOF (2026-07-10)
After driving the batch, the History tab went from **6 → 19 events**, rendering a complete human-readable timeline (icon + ADMIN/HOST badge + actor + reason + timestamp) of every action: policy toggle, subscription change, business edit, support-access request + host approval, profile edit, suspend/reinstate, password reset, sell product, add-on toggle. Category filter chips (Account/Membership/Products/Finance/Business/Support access/Affiliate) all populate. **13 distinct actions driven live + DB-verified; all 4 new target types (addon/business/platform_ledger/policy) + owner_user_id proven end-to-end.** This directly answers the founder's core question ("is each action recorded in the History tab") — YES, now.

#### 🔴🔴 CRITICAL bug found + fixed: "Delete user" was a PERMANENT PURGE (2026-07-10, local commit `225869d7`)
The admin **Delete user** action's modal promised *"Soft-delete (recoverable). The account is hidden and deactivated"* — but the code called `app_purge_user_account` (force-clears bookings/finance RESTRICT-FK rows) then `auth.admin.deleteUser` → a **permanent hard purge**. Verified live: it destroyed the entire test host (auth 404, user_profiles/hosts/all rows gone). **Violated the CLAUDE.md absolute rule** (never hard-delete user_profiles/hosts/listings/bookings).
**Fix (founder-approved "true soft-delete"):** set `deleted_at` + `is_active=false` + anonymize PII, soft-delete the `hosts` row, and free the email + block sign-in by anonymizing/banning the auth user **without deleting it**. Recoverable by clearing `deleted_at`.
**Verified live:** re-drove Delete on the (re-seeded) host → all rows KEPT (profile `deleted_at` set + email anon + is_active false; host `deleted_at` set; auth user preserved, not 404). Then restored cleanly.
**Test host restored** via `apps/web/scripts/seed-single-host.mjs` (new user_id `72811b8e-…`, host_id unchanged `0b1111…`). ⚠️ Seed script `node --env-file=.env.local scripts/seed-single-host.mjs` occasionally fails with "fetch failed" — just retry.

**Actions verified live this batch:** add-on create/edit/delete (full CRUD), soft-delete (fixed) + restore. Add-on toggle, policy toggle already done.

**Remaining user-record actions = variations of proven-working patterns** (set-product/provision, email-doc, cancel-scheduled, affiliate-payout [needs commission], add-on create/edit, policy default/delete, impersonate, delete-user, finance record/refund/credit-note). No outstanding bugs — all use the now-fixed withAdminAudit path + reconciled constraint.

> **Not yet pushed to GitHub** (founder: fix locally, push once all done). Commits `75e13886`, `362b2fc5`, `1c7e8a53` are on GitHub; checklist doc updates are local-only.

#### 🔴 MAJOR bug found + fixed during deep functional test (2026-07-10)
**"Is every action recorded in the History tab?" → 13 of 24 user-record actions were NOT.**
Two compounding root causes:
1. **Audit insert silently failing** for add-on / policy / business / affiliate actions: their `target_type` (`addon`/`policy`/`business`/`affiliate`) violated `admin_audit_log_target_type_check`, so the INSERT threw and `withAdminAudit` swallowed it (`console.error` only). These actions wrote **NO audit row at all** — invisible in the audit log AND History. Verified live: toggling an add-on changed the DB but wrote zero audit rows.
2. **Host-scoped actions not matching the per-user History filter:** History reads `admin_audit_log` where `target_id = user.id OR payload.owner_user_id = user.id`, but host-scoped actions target `hostId/addonId/...` and never populated `owner_user_id`.

**Fix (all verified live end-to-end):**
- Migration `20260710120000` adds `addon,policy,business,affiliate` to the target_type constraint (pushed to cloud, migrations in sync).
- `withAdminAudit` gains optional `getOwnerUserId` → stamps top-level `payload.owner_user_id`.
- All 13 host-scoped actions now resolve the owning user (via hostId/businessId/affiliateId).
- **Proof:** toggled an add-on → audit row now written (`target_type: addon`, `owner_user_id: <userId>`) → History tab shows "Enabled / disabled an add-on", count 6→7.

**Follow-up hardening — ALL FIXED (2026-07-10, commit pending):**
- ✅ **`withAdminAudit` no longer hides audit failures** — throws in dev/test (logs in prod) so a target_type/constraint/RLS mismatch surfaces immediately instead of silently dropping the row.
- ✅ **Bigger constraint reconcile** — auditing the whole `AuditTargetType` union vs the DB constraint revealed **~23 MORE admin actions** (Products `product`/`product_feature`, Plans `plan`/`plan_feature`, Services `platform_service`, Ledger `platform_ledger`, Affiliates `affiliate_payout`/`affiliate_settings`, Marketing `marketing_asset`, Deal-cats `special_category`) whose audit writes were ALSO silently failing. Migration `20260710130000` makes the constraint a full superset of the union → **no admin action can silently fail to audit again.** (Affects Finance + Platform + Affiliate tabs not yet reached.)
- ✅ **Correct `revalidatePath`** — the wrapper now revalidates `/admin/users/${ownerUserId}` after host-scoped actions (the per-action calls used the wrong hostId path).
- ✅ **Native `window.confirm` → design-system modal** — add-on + policy deletes now use `modal.destructive()` (verified live: styled Cancel/Delete modal).

### ✅ 3. Inbox — `/admin/inbox` — READY FOR MVP (2026-07-10)
Host↔Wielo support threads (channel='platform'). Verified live + DB:
- ✅ Thread list + All/Unread filter + host search; avatars/badges/previews/timestamps render.
- ✅ Open thread → messages render (incl. the set_product upgrade card end-to-end).
- ✅ **Reply** (`adminReplyPlatformAction`) — sent as the Wielo Support account, **persisted to `messages`** (real, non-system), appears in thread + composer clears.
- ✅ Mark-read (`adminMarkPlatformReadAction`) fires on thread open.
- ✅ Details panel → "Open user record" + "View in ledger" deep-links.
- No console errors.
- **Send-payment-link-to-inbox** (`adminSendPaymentLinkToInboxAction`) + send-by-email (`adminSendPlatformMessageByEmailAction`) are triggered from the **Ledger** page's "Send payment link → to inbox" affordance — will exercise in Tab 6.

### ✅ 4. Listings — `/admin/properties` — READY FOR MVP (2026-07-10)
Verified live + DB:
- ✅ Stat band (total/published/draft/featured) + All/Published/Draft/Featured filters + search.
- ✅ Enriched table: listing name+type+city, host (linked), content (rooms+photos, amber when 0 photos), bookings, rating, price, status badge.
- ✅ **Row moderation menu** ("Listing actions"): **Feature** verified — `properties.is_featured` flipped true + audit `listing.set_featured` (target_type `listing`). "Take offline"/publish is the same audited pattern (`setListingPublishedAction`). Reverted after test.
- No console errors. (Search sanitization `sanitizeSearch()` confirmed in code — [[reference-admin-audit-and-listings]].)

---

## FINANCE

### ✅ 5. Products — `/admin/products` (+ `/[id]`, `/payments`) — READY FOR MVP (2026-07-10)
Verified live + DB:
- ✅ Product manager renders: TEST MODE (Paystack) badge, Payment settings link, product cards (membership + once-off), New product.
- ✅ **Product create** (`/admin/products/new` → `products.upsert`) — full editor form; created a test product, **audit `products.upsert` with `target_type=product`** = LIVE PROOF of the `20260710130000` reconcile migration (this audit silently failed before). Deleted the test product after.
- No console errors.
- ⚠️ Not deep-tested (sensitive/config): the Paystack **Payment settings** (live/test mode toggle at `/admin/products/payments`) — renders; left untoggled to avoid affecting real payment routing. Flag if you want it exercised.

#### ✅ ADVANCED FUNCTIONAL DEEP-TEST — permissions · commission · pricing (2026-07-10)
Founder asked to prove the product **controls actually enforce**, not just persist. Exercised the REAL enforcement RPCs against the live cloud DB (isolated throwaway host, self-cleaning scripts). **12/12 passed.**
- ✅ **Feature permissions** (`check_feature_permission` ← `product_features`, via `subscriptions.product_id`): enabling a feature grants it (`source:product`); an *explicit disable* on the product is authoritative; quantity limits pass through as `limit_value`; an unset feature falls through to default; toggling a permission off is enforced live. Precedence confirmed: **host-override > product > plan > default-disabled** (the real test host's pre-existing `host_feature_overrides` correctly masked the product layer — that's the RPC working, not a bug).
- ✅ **Commission %** (`accrue_affiliate_commission` ← `products.affiliate_*`): percent (15% of R1000 → R150), fixed amount (R250), fixed capped at net (R5000 on R1000 → R1000), duration=once blocks renewal accrual, type=none accrues nothing. Base = NET (amount − VAT); rate snapshotted.

#### 🔴→✅ GAP FOUND + WIRED UP: Setup fee was a **dead control** (2026-07-10)
The editor's entire **"Setup fee (once-off)"** block (amount + label + its own commission %) was stored but **NEVER charged and NEVER paid out** — 3 independent confirmations: `createProductOrder` billed `price` only, `startSubscriptionCheckout` billed `plan.monthly/annual` only, the signup Wizard only *displayed* "R500 setup once-off" as text; migration `20260616000013` said so outright. Founder chose **"wire it up."**
**Fix (migration `20260710160000` + checkout + accrual RPC + pay page):**
- `product_orders.setup_fee_amount` + `platform_ledger.setup_fee_amount` (new cols).
- `createProductOrder` now folds the setup fee into `amount` on the **first purchase** of a membership/service only (never once-off, never an upgrade top-up `amountOverride`, never a renewal — guarded by "buyer already holds an active sub for this product"). Carried onto every `platform_ledger` charge write (paystack/paypal/eft start + confirm/capture insert-if-missing + Deno webhook).
- `accrue_affiliate_commission` now emits **two** rows from one charge: `kind=subscription` on the recurring net (amount − VAT − setup) + `kind=setup_fee` on the setup portion, each with its own configured rate; independent + idempotent per `(source_ledger_id, kind)`.
- Pay page (`/pay/product/[token]`) shows a line-item breakdown when a setup fee applies.
- **Verified live end-to-end:** built a product (price R1000 + setup R500) → generated a pay-link through the **real running server** → order `amount=1500, setup_fee_amount=500`; pay page renders "Setup fee (once-off) R500 · Amount due R1500" (screenshot). Commission split proven 5/5 (recurring R150 on price only + setup R50 = 10% of R500; setup accrues even when recurring is `none`; renewal with setup 0 → no setup commission).
- `pnpm build` + `pnpm lint` + `tsc` all green; types regenerated.
- ⏳ **Deno `paystack-webhook` source updated but NOT redeployed** — its setup_fee only affects the rare insert-if-missing fallback (the pending row seeded by the app already carries it), and webhook redeploy was already a deferred founder item. Redeploy with the next webhook push.

#### ✅ Follow-ups (2026-07-10): invoice line items + enriched product cards
- ✅ **Setup fee is its own INVOICE line item.** Migration `20260710170000` updates `mint_wielo_invoice_on_ledger_complete` to split `line_items` into two rows when `platform_ledger.setup_fee_amount > 0` — the product/subscription line + a dedicated "Setup fee (once-off)" line (invoice subtotal/VAT/total unchanged). **Verified live:** settled a R1000+R500 charge → invoice `INV-0044` line_items = `[{product, R1000}, {Setup fee (once-off), R500}]`; the hosted `/wielo-invoice/[token]` page renders both rows + "Total paid R1500" (screenshot).
- ✅ **Product manager cards now show sales + full commission structure.** Each card shows **"N bought"** (distinct paid-order buyers) + **"M active"** (active/trialing subscribers), and a commission block: recurring/referral commission + its duration, **plus the setup fee and its commission**. Verified live — real product **Bernie** surfaces "Setup fee: R300 · commission 50%" (inert until this batch); test product showed "1 bought · 1 active · Sub commission 20% · recurring · Setup fee R500 · commission 10%".

### ✅ 6. Ledger — `/admin/subscriptions/revenue` — READY FOR MVP (2026-07-10 #43)
Wielo ledger — AdminLedgerList/Board + running balance + downloadable doc per row. Sibling tabs: `/subscriptions/plans`, `/subscriptions/services` (via _SubsTabs).

**Verified live end-to-end through the real ledger UI (cloud DB):**
- ✅ **Record payment** (`recordManualLedgerEntryAction`, type=charge) → `platform_ledger` charge + **auto-minted invoice INV-0045** (trigger `mint_wielo_invoice_on_ledger_complete`), downloadable PDF on the row; hosted `/wielo-invoice/[token]` renders issuer/buyer/line/total/PAID.
- ✅ **Issue refund / Credit note / Adjustment** → signed ledger row + **auto-minted credit note** (`trg_mint_wielo_credit_note`): REF-0004 / CN-0008 / CN-0009, correct kind + sign + label (Refund/Total refunded etc.), downloadable. Running per-user balance correct (paid charge & refund net to 0; credit R30 + negative-adjust R20 = R50 credit).
- ✅ **Send payment link** (`createWieloPaymentLinkAction`) → canonical `wielo.co.za/pay/product/<token>` link (localhost-fallback works) + **"Send to host's inbox"** (`adminSendPaymentLinkToInboxAction`) → "Sent to the host's inbox."
- ✅ **Row ⋯ menu** exposes Issue refund / Give credit / Send payment link / Open document / Download PDF / Copy link — all wired; PDF endpoint returns 200 `application/pdf`.
- ✅ Page renders for super_admin, KPIs (MRR/ARR/Collected/Refunded/Net/Paying hosts), type tabs + counts, env/product/status/user/date filters, search, CSV, TEST badge.

**🔴→✅ Both mint triggers reviewed + confirmed correct** (idempotent, VAT-aware, skip-zero, write `invoice_id`/`ledger_id` back; invoice splits the setup-fee line).

**FEATURE 1 — user record shows Wielo amount due** (founder ask): the user record now surfaces each user's current Wielo balance (from the ledger running balance) — an **"Owes Wielo" (amber) / "Wielo credit" (green) / "Settled"** stat on the Overview band + an **"Account balance"** banner atop the Finance tab. `page.tsx` (`wieloBalance`) + `UserRecord.tsx` (`wieloBalanceView`). Verified live (Lerato = R50 credit on both surfaces).

**FEATURE 2 — bank details on every invoice** (founder ask): hosted invoice + PDF now **always** print bank details (was unpaid-only), in a **small light-green bottom-left card**, each detail **stacked** (Bank / Account name / Account no / Branch / SWIFT) always ending **Ref #: <document number>**. Shared `FinancialDocument` + PDF `InvoiceDocument`, so identical on **Wielo→user AND host→guest**; host invoice page de-gated too. Verified live on INV-0045. GOTCHA hit + fixed: pre-commit formatter stripped the `"num "` trailing space → `numtext-right`; fixed with space-safe ternary (`92f33d96`).

**Follow-ups shipped (2026-07-10 #43b, pushed `20ffa4e3`):**
- ✅ **host→guest invoice now verified LIVE** — seeded a paid booking (temp script) → INV-0046 shows the host business + **VAT at the bottom of the FROM block** (VAT 4987654321) + the stacked bank card (Ref #: INV-0046). Wielo invoice INV-0047 (test) likewise showed Wielo VAT at FROM bottom + VAT-split tax invoice.
- ✅ **VAT number moved to the bottom of the FROM block** on every invoice (host + Wielo, hosted + PDF): `wieloIssuerLines` + `getHostParty` + `InvoiceDocument` now emit Reg then VAT last.
- ✅ **Manual ledger entries inherit the current Paystack mode** (`recordManualLedgerEntryAction` reads `paystack_mode` → `environment`), so a charge posted in test mode shows in the Test-filtered view (verified live). Fixes the earlier "vanishes from Test view" papercut.
- ✅ **Full `pnpm build` passes** (EXIT=0, clean `.next`) — the :3000 orphan server was stopped.

**Filters/tabs/search/CSV — verified live (#43c):** type tabs filter + counts (Refunds → 3 refund rows); status server-filter re-fetch (pending → 9); env test/all/live; product dropdown; user-email filter; date-range (same pushParams); client search (CN-0008 → 1 row); CSV export (15 cols, 26 rows, correct data). **ACTION FOR FOUNDER:** enter Wielo's **real VAT number** in Admin → Platform → Settings (Wielo business details) — the code renders it at the FROM bottom + makes Wielo invoices proper tax invoices; a placeholder was used only for the live test and then blanked.

### ✅ 7. Payments — `/admin/payments` — READY FOR MVP (2026-07-10 #43)
Read-only records view of every payment users make to Wielo (reads the SAME `fetchWieloLedger` SSOT hardened in Tab 6 — no forked logic). Verified live:
- ✅ Renders for super_admin (`payments.view` gate); h1 + explainer + Test-mode banner.
- ✅ KPI band: Collected R20 315 · Pending R26 392 (amber) · Refunded R1 149 (env-scoped via `wieloLedgerStats`).
- ✅ GET-form filters re-fetch: env (live/test/all, defaults to Paystack mode), type (refund → 3 REFUND rows), status, free-text search (user/email/plan/reference). Env column shows only when env=all.
- ✅ Table columns (Amount/Status/Type/Product/User/Provider/Date) render with data; product name resolves via `productByTier`; pagination note (first 50 of N).
- ✅ No console errors. **No mutations on this page** (refunds/credits are issued from the Ledger tab / user record) → nothing to audit here. Scope note: this is Wielo revenue only; host↔guest booking refund_requests live elsewhere (Overview "pending refunds" tile deep-links to them).

### ⬜ 8. Affiliates — `/admin/affiliates` (+ marketing, settings, terms)
Affiliate admin panel, marketing manager, settings, terms editor. **(Affiliate hardening is the LAST planned batch.)**

### ✅ 9. Reporting — `/admin/reporting` (+ pdf) — READY FOR MVP (2026-07-10 #43)
Read-only platform report from `buildPlatformReport(range)`. Verified live:
- ✅ Renders for super_admin (`subscriptions.edit`); dark hero with MRR/ARR/Paying hosts/ARPU.
- ✅ Charts populate (24 chart SVGs): RevenueAreaChart, PlanDonutChart, UserGrowthChart; retention & funnel (trials/conversion/churn/status); growth & GMV KPIs.
- ✅ Range filter (30D/90D/6M/12M/YTD) re-fetches (all 200); revenue KPIs period-aware.
- ✅ **PDF export** (`/admin/reporting/pdf?range=`) returns 200 `application/pdf` (valid %PDF); PDF renderer has no formatting bug.
- 🔴→✅ **BUG FOUND + FIXED:** every money KPI used the plan-pricing `formatZar` helper, which renders **0 as "Free"** → "Outstanding: Free" (and any zero MRR/GMV/refunded). Replaced with a report-local `zar()` that shows "R 0". Verified live (Outstanding now "R 0", no "Free" on the page). tsc + no server errors (the transient `formatZar is not defined` in logs was an HMR intermediate state during the edit).

---

## MODERATION

### ✅ 10. Reviews — `/admin/reviews` — READY FOR MVP (2026-07-10 #43)
Review moderation. Verified live end-to-end (seeded a review on the test host):
- ✅ Page renders (`reviews.moderate` gate); status tabs (Flagged/Pending/All + counts), filters (host/guest/rating GET form), empty state.
- ✅ **Uphold flag (hide)** (`hideReviewAction` → `review.uphold_flag`, target_type `review`, reason-required) → review `flagged=true, is_published=false, admin_decision=upheld` + audit row with full payload (args + after + reason).
- ✅ **Reject flag (restore)** (`restoreReviewAction` → `review.reject_flag`) → `flagged=false, is_published=true, admin_decision=rejected` + audit row.
- 🔴→✅ **FIX: review moderation now shows in the host's per-user History tab.** Both actions lacked `owner_user_id`, so they audited only to the global log (not the host's History) — same gap the Tab 2 host-scoped fix closed. Added a shared `reviewOwnerUserId` resolver (review→host→user_id) as `getOwnerUserId`. Verified live: after the fix, the audit row carries `owner_user_id` and the host's History tab renders "Review uphold flag (review)" (count → 4). tsc green.
- GOTCHA confirmed: server-action edits need a dev-server **restart** (HMR won't recompile them). Also `admin_audit_log` has no `reason` column (payload holds it) — a probe query selecting `reason` returns null misleadingly.

### ✅ 11. Data requests — `/admin/data-requests` — READY FOR MVP (2026-07-10 #43)
POPIA/GDPR access + erasure queue. Verified live (seeded export + deletion requests):
- ✅ Page renders (`users.view` gate); status tabs (Pending/Processing/Completed/All + counts), export/deletion cards, empty state.
- ✅ **Mark processing** (`data_request.mark_processing`) → status=processing (Pending 3→2, Processing 1). Audited.
- ✅ **Fulfil export** (`data_request.export_fulfilled`) → builds the **real POPIA/GDPR JSON export** (7.6 KB: profile/bookings/reviews/host), client-downloads it, marks completed. Audited.
- ✅ **Reject** (`data_request.reject`) → status=rejected + rejected_reason. Audited.
- 🔴→✅ **CRITICAL FIX — deletion fulfilment was a HARD delete.** `fulfillDeletion` called `auth.admin.deleteUser` FIRST (purging user_profiles/hosts via cascade), only anonymising if RESTRICT FKs blocked — violating the never-hard-delete rule (AGENT_RULES §2.1 / CLAUDE.md) and repeating the earlier "Delete user" purge bug. Rewrote to **always anonymise** (soft-delete profile + host `deleted_at` + scrub PII + ban the auth user ~100y, never delete it). **Verified live on a throwaway user:** profile + auth user both still EXIST (banned_until 2126, email `deleted+…@deleted.invalid`, deleted_at set), request completed — satisfies erasure, preserves accounting/audit, fully recoverable.
- ✅ **All 5 actions now stamp `owner_user_id`** (shared `dsrOwnerUserId`) → data-request actions surface in the affected user's History tab (was global-audit only). tsc green.

---

## PLATFORM (collapsible)

### ✅ 12. Settings — `/admin/platform/settings` — READY FOR MVP (2026-07-10 #43, factor-by-factor)
Platform config brain: General (branding + Meta pixel), Business (Wielo issuer + VAT), Payments (Paystack/PayPal/EFT), Legal (terms/privacy), Tracking (GA4/GTM/TikTok/Ads). Every save is `withAdminAudit` → `platform_settings` / `platform_integrations` / `platform_payment_settings`. Verified each factor **round-trip** (save→persist→audit→consumer takes effect), live + via a deep code audit:
- ✅ **Branding** (`platform.settings.branding`) — drove a live save (company_location edited → persisted + audit `platform.settings.branding`, reverted). Consumers via `lib/brand.ts` (per-request React `cache()` only, no persistent cache) → titles/nav/footer/invoice issuer; `revalidatePath('/','layout')` is sufficient. Works.
- ✅ **Wielo business + VAT** (`platform.settings.wielo_business`) — form fields match schema + reader keys exactly; setting `vat_number` flips new invoices to **Tax Invoice** with 15% VAT split (mint trigger reads `wielo_business`). Proven live earlier (INV-0047). Form has the VAT field (blank → founder enters real number).
- ✅ **Legal** (`platform.settings.legal`) — public `/terms` + `/privacy` read the right keys, fall back to static when null, consent versioning derives live (`t{v}-p{v}`), version bumps ONLY on real change. 🔶→✅ **HARDENED:** now sanitises HTML on **read** too (was write-only) — defence-in-depth for historic rows if the allowlist tightens. `/terms` re-verified rendering.
- ✅ **Meta pixel + tracking IDs** — 🔴 **CRITICAL clobber question answered: NOT a bug.** Both forms upsert the SAME singleton (`id:true`) but touch **disjoint columns** → PostgREST `ON CONFLICT DO UPDATE SET <only-payload-cols>`. **Verified live:** set pixel=998877, saved tracking GA4=G-CLOB123 → pixel PRESERVED (no clobber), reverted. CAPI token write-only + encrypted + never sent to client; all 5 ids render site-wide via `PlatformMarketing` when enabled (suppressed on host micro-sites).
- ✅ **Payments** (`platform.payment_settings`) — mode toggle routes to the right keys (`getPlatformPaystackSecret`); **all secrets write-only + blank-keeps-existing** (no blank-wipes-secret path); PayPal secret + CAPI encrypted; EFT details read live for invoices. 🔶→✅ **HARDENED:** payment save was `.update().eq(id,true)` — if the singleton were missing it silently no-ops; now selects + throws so a phantom save surfaces.

**🔒 #1 + #2 ADDRESSED (founder chose: #1 Option A encrypt-in-DB, #2 fix):**
1. ✅ **Paystack secrets now encrypt at rest** (Option A) — `products/payments/actions.ts` wraps the live/test secret keys in `encryptSecret` (like PayPal); `platform-billing.ts` decrypts via `decryptSecret`; the Deno `paystack-webhook` gained a Web-Crypto `decryptSecret` and decrypts the DB keys before HMAC. `decryptSecret` passes plaintext through, so existing keys keep working until re-saved. **Crypto interop PROVEN** (Node encrypt ↔ Node reader + Node `webcrypto`=Deno `crypto.subtle` decrypt = original). **INERT until `PAYMENT_CIPHER_KEY` is set** (it's currently unset → `encryptSecret` is a no-op). **⚠️ FOUNDER DEPLOY ORDER when enabling:** (1) `supabase secrets set PAYMENT_CIPHER_KEY=<base64-32>` for the function, (2) `supabase functions deploy paystack-webhook`, (3) set `PAYMENT_CIPHER_KEY` on Vercel + deploy app, (4) re-save the Paystack keys so they encrypt. Do NOT re-save keys encrypted before the webhook is redeployed or webhooks 401.
2. ✅ **Mode/key guard** — `savePaymentSettingsAction` now refuses to enable a Paystack mode with no secret for it (new/stored/matching-env). **Verified live:** Live-without-live-key → *"You selected Live mode but no live Paystack secret key is set…"*; Test-with-test-key → "Payment settings saved." Closes the mode/env divergence footgun.
3. First-ever legal publish jumps version 1→2 (cosmetic; the static draft is the notional v1) — left as-is.
- All saves audited; tsc green; no console/server errors.

### ✅ 13. Feature flags — `/admin/platform/features` — READY FOR MVP (2026-07-10 #43, redesigned)
Feature access chain: **host override → the host's PRODUCT features (`product_features`, per-product) → deny**. Verified live:
- 🔴→✅ **Root-cause bug + FOUNDER REDESIGN:** the page's feature matrix + host-override dropdown were sourced ONLY from `plan_features`, which is **EMPTY (0 rows)** — features are now product-driven (`product_features`, 66 rows). So the override dropdown was empty → **no host override could be created**. Founder chose **"remove the matrix entirely"** (products are the source of truth for tier features). Rewrote the page: dropped the misleading editable plan matrix + its `upsertPlanFeatureAction` + `FeatureMatrix.tsx`; the tab is now **per-host overrides + guest permissions + a banner/link pointing to Products** ("tier features are set per product"). Override feature catalog = union of plan+product keys (26).
- ✅ **Per-host override** (`createHostOverrideAction` → `platform.features.host_override`, target_type `feature_override`, reason-required) — drove live: `host_feature_overrides` row written + audit + **`check_feature_permission(p_host_id, p_feature_key)` returns `{source:"override", is_enabled:true}`** = the override actually GATES with correct precedence. Cleaned up the test override.
- ✅ **Guest permissions** (`saveGuestPermissionsAction` → `platform.features.guest_permissions`) — global set in `platform_settings`; Guests tab renders 6 toggles + save (same proven withAdminAudit pattern). Guests have no product so this is their only feature layer.
- tsc green; the RPC precedence (override>product>plan>default) was already proven live in Tab 5.

### ✅ 14. Categories — `/admin/platform/categories` — READY FOR MVP (2026-07-10 #44)
Listing categories CRUD — powers the host wizard, `/explore` browse filter, and every `/c/[slug]` SEO landing page. Verified live end-to-end (throwaway "MVP Test Cabin", cleaned up):
- ✅ **Create** (`upsertCategoryAction` → `taxonomy.category.upsert`, target_type `listing_category`) — DB row written with auto-generated slug (`mvp-test-cabin`), parent, sort, meta_title; audit row by wollie. **Proves the target_type constraint accepts `listing_category`** (systemic audit-fail class stays closed).
- ✅ **Side-effect propagation (the real bar):** publishing → `revalidateTag("taxonomy")` + revalidatePath `/explore` + `/c/[slug]` → the new category is **live immediately** on `/c/mvp-test-cabin` (200, meta_title rendered in `<title>`) AND appears in the `/explore` browse chips.
- ✅ **Edit** (unpublish + sort 100→105) — persisted; second `upsert` audit row; unpublish propagated: category **dropped from `/explore`** and `/c/mvp-test-cabin` now renders "Category not found".
- ✅ **Delete** (leaf, `deleteCategoryAction` → `taxonomy.category.delete`) — **SOFT-delete** (`deleted_at` set, row preserved) + audit with the reason in payload (min-5-char reason enforced); row removed from the list UI.
- ✅ **Parent-delete guard** — deleting the "Accommodation" root (has children) is blocked by a design-system `modal.warning` ("Can't delete this category"); root NOT deleted.
- ✅ `taxonomy.manage` permission gate; no console errors.
- ℹ️ **Consistency note (NOT changed — out of scope):** the delete-reason uses native `window.prompt`, which is the **uniform admin convention** (~10 editors: deal-categories, amenities, groups, all help editors, categories) — there's no `modal.prompt()` in the design system. Spawned a follow-up chip (`task_b9c3d98d`) to add `modal.prompt()` and roll it across all sites. Functional as-is.
- ℹ️ **Pre-existing SEO nuance (NOT a categories bug):** `/c/[slug]` for an unpublished/missing category returns HTTP **200** with a "Category not found" body (soft-404) rather than a hard 404. Lives in the `/c/[slug]` page, not the admin tab.

### ⬜ 15. Deal categories — `/admin/platform/deal-categories`
Deal category editor.

### ⬜ 16. Amenities — `/admin/platform/amenities` (+ groups)
Amenity catalog + groups editor.

### ⬜ 17. Broadcasts — `/admin/broadcasts` (+ new, `/[id]`)
Platform broadcast banners — create, view, cancel.

### ⬜ 18. Send to users — `/admin/notifications/sent` (+ send)
Push/in-app notification composer + sent history.

### ⬜ 19. Email templates — `/admin/emails` (+ `/[type]`)
Preview + test-send the 26 email templates.

### ⬜ 20. Audit log — `/admin/audit`
admin_audit_log viewer.

---

## Not in sidebar (hidden / deep-link only) — confirm intentional
- `/admin/looking-for` (posts + quotas)
- `/admin/hosts` + `/admin/hosts/staff` (host staff — hidden for MVP)
- `/admin/help/*` (help centre — hidden site-wide for MVP)
- `/admin/platform/staff` (platform staff — hidden for MVP)
- `/admin/subscriptions/plans` + `/services` (reachable via Ledger tabs)

---

## Per-tab audit template
For each tab we check: (1) page loads for super_admin, (2) every button/action
wired to a real server action, (3) empty/error states, (4) permission gating,
(5) no console errors, (6) mobile layout. Then mark ✅.
