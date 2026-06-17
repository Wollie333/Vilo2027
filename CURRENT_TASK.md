# Vilo — Current Task

> Reset at the start of every session. This is the session contract.

**Active focus:** **Website CMS pivot + `listings → properties` rename (Property + Channels model).**

> **RESUME ANCHOR (multi-session project).** Branch: `feat/website-property-restructure`.
> Plan: `~/.claude/plans/ok-it-has-come-spicy-snail.md`. Rename checklist + progress log:
> `RENAME_LISTINGS_TO_PROPERTIES.md` (repo root). To continue in a fresh session: read
> those two files + `git log --oneline -15`, then do the next unchecked phase.
>
> **Sequence:** Phase 0 = full `listings→properties` rename in 5 green checkpoints
> (R0 inventory ✓ → R1 leaf tables → R2 core tables → R3 `listing_id→property_id` cols →
> R4 routes+i18n). THEN the website build (plan §1+): Property+Channels, per-business
> `host_websites` CMS, subdomains + custom domains, sidebar/IA restructure, product gating.
> Ledger/booking core is NOT touched. Each phase: migration → `db push --linked` → gen types
> → code sweep → `pnpm build`+`pnpm lint`+query-sweep → commit → (optionally start fresh session).
>
> **Status:** R0 done (inventory); R1 done (8 leaf tables, commit `ca78d20`); R2 done
> (7 core tables `listings→properties` + core children; migration
> `20260617000200_rename_r2_core_tables.sql`; 30 fns recreated; 112 code files + 4
> scripts swept; type-check/lint green; live verify green). **R3 done** (migrations
> `20260617000300` cols `listing_id→property_id` on 20 tables + `listing_type→
> property_type` + `whole_listing_discount_pct→whole_property_discount_pct` +
> `clicked_listing→clicked_property` + `listing_view_events→property_view_events`;
> 36 fns recreated by mechanical swap; 104 source files + edge fn swept;
> `20260617000400` drops a stale pre-SSOT `get_listing_policy_summary(uuid)` overload;
> build + type-check + lint green; verify-policy-resolver + 13 RPCs live-green;
> `track-listing-view` edge fn redeployed + smoke-tested green). **R4 done** — routes +
> i18n labels, **no DB migration**: route folders renamed (`listing/[slug]`→`property/[slug]`,
> `dashboard/listings`→`dashboard/properties`, `admin/listings`→`admin/properties` +
> `[listingId]`→`[propertyId]`, iCal `[listing_id]`→`[property_id]`) with every path-string
> + import swept (typedRoutes OFF → swept by hand); `messages/en.json` + `af.json` app-UI
> "Listing"→"Property" value swaps (fr/de/pt are empty stubs); host sidebar item
> "Listings"→"Properties". Build+lint green; 0 route strings remain. Commit `852bfea`
> (routes) + i18n commit. **Deferred to website §5:** the ~50 *hardcoded* "Listing" page
> headings/labels (extract to i18n during the IA pass, don't hardcoded-swap now).
> **The R0–R4 physical rename is COMPLETE.** **Website build STARTED** (plan §8 — 15
> phases). **W1 (Data foundation) DONE** — migration `20260617000500_website_foundation.sql`
> created 7 additive tables (`host_websites`, `website_pages`, `website_properties`,
> `website_rooms`, `website_blog_categories`, `website_blog_posts`, INSERT-only
> `website_domain_events`) + owner/admin RLS + `update_updated_at` triggers + public
> `website-assets` bucket & host-scoped object policies + `plan_features` seed (4 new
> keys × 4 plans, open pre-MVP). Added the 4 keys to `lib/products/features.ts` and the
> shared Zod section union at `apps/web/lib/website/sections.schema.ts` (co-located, NOT
> `packages/schemas`, to avoid a pnpm-install risk — deviation noted). Pushed; types
> regenerated; build+lint+type-check green; `scripts/verify-website-foundation.mjs` 🎉.
> **Naming note:** channel table is `website_properties(property_id)` (authored post-rename).
> **W2 (Sidebar IA, plan §5) DONE** (commit `1770a98`) — config-only re-author of
> `dashboard/_components/Sidebar.tsx` into 5 groups: always-open daily driver
> (Overview/Calendar/Bookings/Inbox/Guests) + collapsible Properties/Channels/Finances/
> Insights. New gated **Website** row (NEW badge) → `/dashboard/website` + a `ComingSoon`
> placeholder page (replaced in W6). Folded rows removed (Rooms/Seasonal/Listing-extras/
> Add-ons/per-property Policies — already editor tabs); account Policies+Staff kept in
> footer; "Channels"→"OTA channels"; Affiliates under Insights. Build+lint+type-check green.
> **Deferred:** (a) business/website switcher → W6 (first consumer is the per-business site;
> a `vilo_active_business` cookie now would be a no-op — views are all-businesses, Ledger/
> Guest-record use `?business=`); (b) Policies/Staff as Settings tabs (route move); (c) the
> ~50 hardcoded "Listing" headings → i18n sweep.
> **W3 (shared section components + renderer, plan §2/§8.3) DONE** (commit `12873de`):
> the ONE presentational component set (preview === public) — `lib/site/themes.ts`
> (5 presets → `--site-*` vars via `buildSiteVars`), `components/site/SiteThemeRoot`
> (scopes the vars), `SiteChrome` (header/nav/footer + Book CTA), `lib/site/types.ts`
> (auto-populate `SiteData` shapes + `dataFor`), 13 `components/site/sections/*` +
> `_shared`, and `SectionRenderer` (switch(type), passes live `data` to auto sections +
> an `asset` path→URL resolver to hero/host_bio). Pure presentational, no fetching, read
> `--site-*` only. Temp harness at `dashboard/website/preview` (sample data + preset
> switcher; sample sections validated through W1 `sectionsSchema`). Build+lint+type-check
> green. **W4 (public site routes + loadSitePage, plan §8.4) DONE** (commit `8f66b7f`):
> `lib/site/loadSitePage.ts` (service-role; `resolveSiteRef` ?site/host-header,
> `loadSiteContext` brand/theme/nav + published-only-unless-preview, `loadSitePage`
> page-by-path + published/draft sections + auto-populate data for gallery/rooms/location/
> reviews/blog, `loadSiteBlogPost`) + routes under **`app/[locale]/site/*`** (home,
> `[...slug]`, `blog/[postSlug]`, host-aware `sitemap.xml`+`robots.txt`, `not-found`;
> all force-dynamic) + `SitePageView` (shared frame + public-bucket asset resolver).
> Testable via `/<locale>/site?site=<sub>`. `scripts/verify-website-site-loader.mjs` 🎉.
> **KEY DEVIATION:** mounted under `[locale]/site/` NOT a `(site)` root group — `_`-prefixed
> folders (`__site`) are non-routable in Next, and a 2nd route-group root layout can't
> coexist with the non-grouped `[locale]` root. Booking CTAs deep-link the engine. Chrome
> reads live columns (published_snapshot fast-path → W10).
> **W5 (middleware host routing, plan §8.5/§3) DONE** (commit `de12cdf`):
> `lib/site/host.ts` pure classifier (`classifyHost` app vs {site,ref}, `RESERVED_SUBDOMAINS`,
> `siteRewritePath`, `isSeoFile`) — FAIL-SAFE (no `NEXT_PUBLIC_ROOT_DOMAIN` ⇒ all app, opt-in
> by env). `middleware.ts`: classifier FIRST; tenant host → rewrite `/<defaultLocale>/site<path>`
> + `x-vilo-site-host`, NO next-intl/NO session (no cookies on tenant hosts); app hosts UNCHANGED;
> sitemap.xml/robots.txt added to matcher. `host.test.ts` 10 tests (the mandated app-routing-
> unchanged guard) — vitest 49/49 green. `ENV_VARS.md` + new `WEBSITE_HOSTING.md` (DNS/Vercel ops,
> reserved subs, `?site=` pre-DNS testing). **OPS TODO (founder):** set `NEXT_PUBLIC_ROOT_DOMAIN=
> vilo.site`, add wildcard `*.vilo.site` DNS + Vercel project domain (the on-switch + DNS are
> external; code is ready and inert until then). Shell `<html lang>` is `en` for tenants (site
> language still drives content via business default_language) — refine later if wanted.
> **W6 (create-site flow + builder shell, plan §8.6) DONE** (commit `8161446`): replaced the W2
> ComingSoon placeholder. `/dashboard/website` landing (dark hero + per-business create/manage;
> single business w/ site → editor). `createWebsiteAction` (subdomain reserved-check via shared
> `RESERVED_SUBDOMAINS`, one-site-per-business + global subdomain uniqueness, seeds starter Home+About
> pages + syncs properties/rooms as visible channel membership). `lib/website/subdomain.ts`+tests
> (`deriveSubdomain`/`validateSubdomain`→error codes). `[websiteId]` editor shell: `layout` (name +
> address + Preview `?site=&preview=1` + disabled Publish + tab bar Overview-live / rest "coming soon")
> + Overview (checklist + counts) + `loadWebsiteEditorData` (owner-scoped). New `website` i18n
> namespace (52 keys); help migration `20260617000600`. build+lint+type-check green; vitest 54/54.
> **STILL DEFERRED:** the business/website switcher (kept deferred — the per-business create/manage
> cards already handle multi-business; revisit if the editing flow needs a global active-business).
> **W7 (Brand & Theme tabs, plan §8.7) DONE** (commit `<pending>`): `[websiteId]/brand` +
> `[websiteId]/theme` routes wired live in `WebsiteTabs` (Overview/Brand/Theme live; rest "coming
> soon"). **Brand**: logo upload browser→Storage into public `website-assets` (signed-URL pattern:
> `createWebsiteLogoUploadUrl`→`uploadToSignedUrl`→`registerWebsiteLogoAction`, path `{websiteId}/…`)
> + name + tagline → `host_websites.brand` jsonb; `removeWebsiteLogoAction` clears path + deletes
> object. **Theme**: 5 preset swatches + accent/font/radius overrides (empty=inherit preset) + a live
> `--site-*` preview via `buildSiteVars` → `host_websites.theme` jsonb. `saveBrandAction`/
> `saveThemeAction` (+ `patchSiteJson` merge), owner-scoped `assertWebsiteOwnership` + pre-MVP
> `assertWebsiteFeature` short-circuit (§3.4); `brandSchema`/`themeSchema`. New shared
> `lib/website/assets.ts` (`websiteAssetUrl`) — SSOT path→public-URL, adopted by `loadSitePage`
> (logo now resolves) + `SitePageView.siteAsset`. **NO DB schema change** (brand/theme cols + bucket
> from W1); help migration `20260617000700` pushed; +44 `website` i18n keys (en). build+lint+
> type-check green; `scripts/verify-website-brand-theme.mjs` 🎉.
> **Next: W8 — Home + About section builder** (plan §8.8): accordion + reorder + click-to-edit +
> inline preview + desktop/phone toggle; Zustand draft store; `saveDraftSectionsAction`. Fresh
> session per phase.

_(Previous focus below — hardening features for MVP — remains valid context.)_

## ✅ Done this session (2026-06-16) — Vilo product payments: reporting + invoices + thank-you + Meta Pixel + test mode
- Fixed: a Vilo product/subscription purchase paid with Paystack test keys
  "stopped" after payment and never showed in admin payments/ledger/reporting.
  Root cause: product orders settled only via the webhook. Now they settle on
  return (`confirmProductOrderByReference`), with the webhook as backstop.
- Post-payment **thank-you one-pager** + **auto-issued Vilo invoices**
  (`vilo_invoices`, minted by a `platform_ledger` trigger; public page + PDF;
  admin **Vilo business details** form). User **Settings → Transaction history**
  lists purchases with invoice downloads.
- **Admin-managed Meta Pixel** (Platform settings) + shared `firePurchase`
  (fbq Purchase with dynamic value + `eventID`; CAPI plumbed, not wired).
- **Test/Live tagging** (`environment`) + admin Payments Live/Test/All filter;
  live KPIs exclude test. Plan: `~/.claude/plans/when-a-user-pays-snuggly-bonbon.md`.
- **TODO before launch:** set the Paystack **test** webhook URL in the dashboard
  (backstop in test mode); fill Vilo business details for the invoice issuer;
  wire the Meta Conversions API server post; full i18n pass on the new strings.

## (Earlier) ✅ Affiliate programme (Phases 1–8)
- Full enterprise affiliate programme for Vilo products, open to any user
  (anchored on `user_profiles.id`, not host). Mounted at `/portal/affiliates`.
- 30-day cookie tracking + permanent binding; commission accrual/clearing/
  clawback engine (RPCs + crons); affiliate Overview/Products/Marketing/Payouts;
  payout requests with per-method fee; admin management + settings + the
  user-record Referrals tab. Migrations `…010`–`…018`; `verify-affiliate-ledger.mjs`
  16/16. Plan: `~/.claude/plans/flickering-tinkering-ripple.md`.
- **TODO before launch:** redeploy `paystack-webhook` (live accrual); add Supabase
  env vars to Vercel **Preview** scope (preview builds fail prerendering `/login`
  without them); platform-wide i18n pass covering portal/admin/affiliate strings;
  setup-fee commission when billing charges it as a separable amount.

## (Earlier) Harden each feature to 100% for MVP — Reviews feature, end-to-end.

## ✅ Done this session (2026-06-13) — Guest Reputation (hosts rate guests, cross-host)
- Built `host_review_guest.md` end-to-end: `guest_ratings` table (cross-host
  read RLS, own-row write, one living review per host/guest), `hostCanRateGuest`
  eligibility (completed/no-show), `upsert/deleteGuestRatingAction`, a new
  **Reputation** tab on the Guest Record (aggregate + your review + other hosts),
  and a `FormModal` rate-a-guest flow. Extracted shared `CategoryStars`.
- Migrations `20260613000020_create_guest_ratings.sql` +
  `20260613000021_help_guest_ratings.sql` pushed; types regenerated. `pnpm
  build` + `pnpm lint` green.
## ✅ Done this session (2026-06-13) — Ledger ↔ multi-business (Phases 1–2)
- Plan `LEDGER_MULTIBUSINESS_PLAN.md`. Confirmed finance **documents already**
  render the listing's business (no work). **Txn now business-aware** (derived
  via booking→listing→business_id; `fetchHostTransactions` businessId filter that
  scopes rows + running balance). **Business selector on the Ledger** + on the
  **Guest Record Finances tab** (server-side `?business=`; headline balance stays
  all-businesses). Also fixed the portal `in_app_notifications` user-scope.
- **Remaining (Phase 3, next chunk):** `business_id` on `guest_credit_ledger`
  (per-business store credit) + populate it on credit write-paths; headline still
  nets all. Then verify (2-business + shared guest) + help + ship.
- **Still parked:** guest-portal build plan (portal is ~95% built; only QA tracker exists).

## ✅ Done this session (2026-06-10) — Calendar: select a range on the grid + inline book
- **Industry-standard range selection on the month grid.** Tap check-in → later
  check-out; nights highlight, a **Selected range** card shows (listing picker,
  est. total, live booked/blocked conflict check). Actions: **Block** the nights
  (`setManualBlocksAction`) or **Create booking**.
- **Inline quick-book modal** (no page change) — compact `FormModal` over the
  calendar, dates locked, guest + price + payment; posts to the existing
  `createManualBookingAction` (SSOT, not forked). **Open the full editor**
  deep-links the wizard with listing + both dates for rooms/add-ons.
- Also fixed the single-day Availability panel from a UI re-review (booked rows
  open the booking; real status label; past dates read-only).
- Help: `20260610180007_help_calendar_inline_booking.sql` (re-upsert
  `managing-your-calendar`). `tsc` + `eslint` green on changed files. Commits
  `d22f8eb`, `5673295`.

## ✅ Done this session (2026-06-10) — Calendar: manage availability + book from it
- **Wired the calendar's existing-but-unused block actions into the UI.** New
  right-rail **Availability** panel (per listing for the selected day:
  Open/Booked/Blocked) with one-tap **Block**, **Open up** (unblock) and **Book**
  (deep-links the new-booking wizard with listing + check-in prefilled).
- **Block dates** top-bar button → canonical `FormModal` to block/open a whole
  range listing-wide (`setManualBlocksAction`); booked + quote-held nights left
  untouched. Single-day toggle uses `toggleBlockedDateAction`.
- **New-booking prefill** — `/dashboard/bookings/new` honours `?listing=&checkIn=&checkOut=`
  (validated server-side); `ManualBookingForm` seeds listing/dates/picker month.
- Help: `20260610170000_help_calendar_manage.sql` (`managing-your-calendar`).
  `tsc` + `lint` green. Commits `73ae1f9`, `f95a48f`.

## ✅ Done this session (2026-06-10) — Inbox: one chat design (host = guest)
- **Single source of truth for the inbox.** Extracted shared components in
  `components/inbox/` (`ConversationList`/`ConversationRow`, `ChatMessageWall`,
  `ChatComposer`, `ChatThreadHeader`, `InboxAvatar`) used by BOTH the host inbox
  and the guest portal.
- **Host inbox reworked to the guest's two-pane WhatsApp layout.** Removed the
  folder rail, deal **pipeline**, tabs, pagination, assignee, follow-up/snooze and
  internal notes. Kept: quick-reply templates, a slim Booking/Details slide-out,
  archive/un-archive, pin. Deep links (`?c=`, `?f=enquiries`) + full-bleed intact.
- Deleted `PipelineControl.tsx`/`ConversationNotes.tsx` + 4 dead actions. DB
  `pipeline_stage` column + guest auto-advance left in place (harmless).
- Help: `20260610160000_help_inbox_redesign.sql` (new `using-your-inbox`; corrected
  `enquiry-pipeline-inbox`) — **pushed to remote**. `tsc` + `lint` green.

## ✅ Done this session (2026-06-10) — Party guests → guest records + relationships
- **Party members become guest records.** Each named person on a booking's
  `additional_guests` is materialised into `host_contacts` (deduped by email) so
  the host can open/message/tag them individually — they show in the Guests
  directory + have a working record automatically (`_host_guest_rows` UNIONs
  `host_contacts`).
- **`guest_relationships`** table + RLS links each party member ↔ the lead booker
  (one row per direction, tagged with the booking). New **Relationships** tab on
  the guest record; **Guests** tab on the booking record (replaces "Guest")
  showing lead + party with per-member record links + an **Add guest** action.
- **Single-source materialiser** — `_materialize_booking_party()` called by an
  `AFTER UPDATE OF status` confirm trigger AND the ownership-checked
  `materialize_booking_party()` RPC (lazy fallback on the booking record +
  Add-guest). Checkout party manifest now requires name + email; thank-you page
  lists the party. Migrations `20260610150000`, `20260610150001` (help).

## ✅ Done earlier (2026-06-10) — Reviews to MVP
- **Photos on reviews** — public `review-photos` bucket + `review_photos` table;
  token-gated signed upload from the (account-less) submit form; one reusable
  `ReviewPhotoGrid` (lightbox) on listing / dashboard / admin / portal / confirm.
- **Delayed request** — checkout enqueues `review_request_queue(send_at=+5min)`;
  `/api/review-request-worker` + `drain-review-requests` cron drain it via one
  SSOT `lib/reviews/request.ts → sendReviewRequest()` (email + in-app + thread
  card). Old daily queuer → paid-aware 24h backstop.
- **Fixed broken plumbing** — emailed review link had no token (resolver now
  signs it); added the missing in-app builder; fixed tokenless portal CTA.
- **Publish immediately** (was 48h); `protect_review_content()` makes reviews
  immutable (hosts may only respond); host **Review link** card on bookings.
- **Eligibility** — only completed **+ paid** stays (refunded-after-stay still
  counts). Help articles `how-reviews-work` (host) + `leaving-a-review` (guest).
- **Ops TODO (founder, one-time):** Vault `review_request_worker_url`; confirm
  `NEXT_PUBLIC_SITE_URL`. Probe: `scripts/verify-reviews.mjs` (green).

<details><summary>Previous focus — Finances are the spine</summary>

## ✅ Done (2026-06-08)
- **Reporting wired to the ledger** — new **Cash position** panel on Analytics
  (Collected/Outstanding/Refunded/Net cash + lifetime collection bar) sourced
  from `fetchHostTransactions`, so Reports, Ledger and Finances agree. Added
  canonical `txnFlows` (SSOT for collected/refunded/credits/charged); `txnStats`
  builds on it. Booked-value (accrual) vs cash explainer added; refund-rate
  labels disambiguated. Help article `reports-cash-position` (live). All 12
  analytics RPCs probed green against the real schema.
- **Booking-flow follow-ups** — live per-room availability + whole-place toggle
  (`b063d76`).
- **Host-Paystack spine fix** — guest card payments now charge the **host's own**
  connected Paystack (not the platform key); success-page verify uses the host
  key. `getHostPaystack` is the SSOT (`8a83d31`).
- **Pay-now link** — `bookings.pay_token` + public **`/pay/[token]`** page (card
  on host Paystack or EFT) + host **Payment link** card (Copy / WhatsApp /
  Email) on the Payments tab. Shared `startBookingPayment` core
  (`d6cffe3`, `3cd1134`). Help article `send-a-payment-link` applied.
- **Guardrails added** — AGENT_RULES **§4.7** (wire into the ledger, never fork
  the maths) + **§4.8** (booking card → host gateway). See
  `[[feedback_ledger_single_source_of_truth]]`.

</details>

## ▶ Next
1. **Test bookings end-to-end** with the host's connected Paystack test account
   (guest checkout card path + the `/pay/[token]` link). Founder-driven.
2. **Pay-link in the guest message thread** — deferred fast-follow (needs
   conversation lookup/creation; Copy/WhatsApp/Email cover resend today).
3. ✅ **Single-source-of-truth consolidation pass** (founder request) — DONE for
   the payments/finance audit: one `round2` (lib/format), one `INBOUND_KINDS` +
   `sumPaidFromRows`, success page via `confirmHostCardPaymentByReference`, one
   `requireHost()` adopted across ~14 action files, `getHostPaystack` in the
   banking link action, one `nightsBetween`. _Deliberately left:_ per-page
   `fmtDate` formatters (intentionally divergent — not forced).

---

<details><summary>Previous task — Booking Redesign — COMPLETE</summary>

**Plan:** see **`BOOKING_REDESIGN_PLAN.md`** (repo root) — full, buildable, phased.
**Designs:** `C:\Users\Wollie\Downloads\Listing 3.0.html` (listing) +
`C:\Users\Wollie\Downloads\Booking Flow.html` (checkout).

## Start here
1. Read `BOOKING_REDESIGN_PLAN.md` end-to-end.
2. Build phase-by-phase (§4), committing + pushing after each; `pnpm build` +
   `pnpm lint` green every time; tick the §5 Progress box.
3. Resolve the §3 flags (add-on units, in-flow availability, listing cleanup)
   in-phase — flag the founder before any schema change.

> Goal: listing page is **display-only** with **two CTAs** — **Reserve**
> (→ self-contained 3-step Rooms→Details→Payment flow) and **Request a quote**
> (→ existing modal). Guests cannot select rooms or book on the listing itself.

</details>

<details><summary>Previous task — Guest Record (CRM) — COMPLETE</summary>

**Plan:** `GUEST_RECORD_PLAN.md` · **Design:** `Guest Record.html`. Feature
complete (see Progress below).
</details>

## One-line summary
Add a **Guests** sidebar item (after Bookings); a Guests list (`/dashboard/guests`); a CRM **Guest
Record** page (`/dashboard/guests/[gkey]`) — identity + verifications, lifetime stat band, tabs
Overview/Bookings/Messages/Payments/Notes; two-way linked with Booking Details. New tables:
`guest_notes`, `guest_tags`, + `user_profiles` verification columns. Guests are keyed by a unified
`gkey` (user_profiles.id, or `e_<base64url(email)>` for email-only manual-booking contacts).

> **ARCHITECTURE CHANGE (2026-06-06):** founder chose to **reuse & extend** the
> existing `host_contacts` (tags/notes/blocked, deduped by email) + `message_templates`
> (full CRUD in `inbox/actions.ts`, `{{guest_name}}` tokens) instead of the plan's
> parallel `guest_contacts`/`guest_tags`/`guest_flags`/new-templates tables. Only
> `guest_notes` is genuinely new. `gkey` is a URL/resolution scheme, not a stored
> column. Inbox **Contacts tab + page removed** (Guests supersedes it). Keep it lean.

## Progress (Guest CRM build)
- ✅ **Phase 1** schema — extended host_contacts (+country/email_consent/blocked_*),
  new `guest_notes`, user_profiles verify cols, seeded message_templates. (commit 59856e8)
- ✅ Inbox Contacts tab + page removed. (632aa71)
- ✅ **Phase 2** RPCs — `_host_guest_rows`, `fetch_host_guests`(+`_summary`),
  `fetch_guest_record`; demo-host probe green. (e627e55)
- ✅ **Phase 3** sidebar entry + badge + `/dashboard/guests` list (KPI strip, segments,
  search, density, sort, pagination, rows). (06f0f76)
- ✅ **Phase 4** Add guest modal + filters + selection/bulk Tag·Export + CSV/vCard
  actions on host_contacts (lazy upsert). (d2d9092)
- ✅ **Phase 5** Guest Record shell — identity + stat band + Overview/Bookings/Payments + prev/next. (5a332e0)
- ✅ **Phase 6** Messages + Notes tabs (+ template picker) + Templates manager. (6aebc9b)
- ✅ **Phase 7** Booking↔record link + record More-menu (tag/block/export/new-booking). (cc8c089)
- ✅ **Phase 8** Help article (`guests-crm`) + CHANGELOG.
- ✅ **Phase 9** Bulk mailer — guest_marketing + guest_broadcasts + RPCs;
  lib/guests/broadcast.ts (Resend, server-side); sendBroadcastAction (monthly cap);
  BroadcastModal ("Email guests"); public /unsubscribe/[token]; per-guest opt-out.
  **Build-only — not deployed/sent.** Uses existing RESEND_API_KEY +
  EMAIL_FROM_ADDRESS + NEXT_PUBLIC_SITE_URL (no new env, no edge fn — sends from a
  Server Action like the rest of the app). Founder to do the first live-send test.
- ✅ **Extra (founder request):** record **Reviews** + **Finances** (invoices/
  quotes/refunds/credit-notes) tabs; POPIA marketing-consent control (locked,
  opt-out only); per-host isolation confirmed (already enforced by RLS).

**Feature complete.** Remaining before real email use: set a verified Resend
sender domain and run a live-send smoke test; consider AAL2/MFA restore (separate).

Probes: `scripts/verify-guest-crm-p1.mjs`, `verify-guest-crm-p2.mjs` (run from apps/web).

---

## ✅ Previously completed (this session group)
- **Analytics variable-mismatch fix** — 12 RPCs realigned to the real schema; missing tables created.
- **Unified shell theme** — host dashboard, guest portal, super admin all on `ClassicShellFrame` +
  `AppHeader` + `GmailNav` (collapsible 76px rail); founder tweaks (no compose, no plan card, no header
  New-booking, thin scrollbar).
- **New Booking 5-step wizard** — `ManualBookingForm` re-laid into Property → Dates & guests → Guest →
  Price & extras → Payment, real logic preserved.
