# Wielo — Wiring Audit (2026-07-16, re-run 2026-07-22)

> **The question this answers:** *"Which features exist in the code but have never actually run?"*
>
> Not "does it compile" — everything compiles. Not "does it lint" — everything lints.
> **Does anything call it?**

---

## 🔄 Re-run 2026-07-22 — current inventory

`node scripts/audit-wiring.mjs` flagged **74** exported symbols across 1601 files.
Each was then re-checked by hand: **70 genuinely have no source caller, 4 were
audit false positives.**

### ⚠️ Read this before believing any wiring result

Three things make a naive grep lie, and all three bit during this re-run:

1. **`.next/` webpack cache is binary and contains every symbol name.**
   `markNoShowBookingAction` looked like it had 4 references; all four were build
   cache. Use `grep -I` and exclude `/.next/`.
2. **There are git worktrees INSIDE the repo** —
   `.claude/worktrees/mystifying-nightingale-a746a8/` and
   `worktrees/vilo-integration/` (see `git worktree list`). They hold full copies,
   so every symbol appears "defined twice". Exclude them.
3. **Use word boundaries.** `toggleProductActive` matched
   `toggleProductActiveAction` on a substring search and looked wired. It is not —
   it is a wrapper whose only "caller" was its own body.

The check that is actually trustworthy:

```bash
grep -rnI "\bSYMBOL\b" apps supabase packages emails scripts \
  | grep -v node_modules | grep -v "/\.next/" | grep -v "\.claude/worktrees" \
  | grep -vE "export (async )?(function|const|default|type|interface) SYMBOL\b"
```

**The audit script is a lead list, not a kill list** — it produced a ~5% false
positive rate (`loadBuildBoard` is imported and called in `build/page.tsx`).
Per `RULES.md` §3, prove each one individually before deleting.

### A. Unwired server actions — 22 (highest signal: features with no caller)

| Area | Symbols |
|---|---|
| **Website builder** (9) | `saveSavedSectionAction`, `deleteSavedSectionAction`, `savePageSeoAction`, `saveWebsiteRoomsAction`, `setWebsiteLayoutAction`, `saveRoomDetailOverrideAction`, `checkSubdomainAvailabilityAction`, `listWebsiteBookablePropertiesAction`, `getWebsiteFormForEditorAction` |
| **Admin toggles** | `toggleProductActive`, `togglePlanActiveAction`, `toggleServiceActiveAction` |
| **Host features** | `markNoShowBookingAction`, `deletePolicyAction`, `assignCancellationPresetAction`, `passOnPostAction` |
| **Admin misc** | `suggestCampaignSlugAction`, `markComplete` (data-requests), `adminSendPlatformMessageByEmailAction`, `previewDealCategoryKey` |
| **Reports** | `fetchScheduledReportsAction` |
| **External reviews** | `replyToExternalReviewAction` |

### B. Unwired React components — 20
`AcademyCards`, `ComingSoon`, `CompletedSetupHeader`, `FirstLoginHero`,
`SetupSidePanel`, `RoomsGroupCard`, `CurrencyInput`, `PickCard`, `RadioCard`,
`VisibilityChips`, `HeaderInspector`, `FooterInspector`, `NavHeaderPreview`,
`LiveNote`, `CopyLinkButton`, `RangeRow`, `ColorField`, `CreateWebsiteCard`,
`FALLBACK_CHIP_ICONS`, `SettingsHero`.

### C. Unwired lib helpers — 28
Notable clusters rather than the full list:

- **The entire external-reviews fetch/reply layer**: `fetchGoogleReviews`,
  `postGoogleReviewReply`, `refreshGoogleToken`, `fetchFacebookReviews`,
  `postFacebookReviewReply`, `decryptFacebookToken`. Consistent with the
  integration being blocked on Google/Meta approval — built ahead of access.
- **Website analysis**: `analyzeSeo`, `extractSectionsText`, `analyzeA11y` — a
  whole SEO/accessibility analyser with no entry point.
- Others: `computeRefundForDays`, `getCreditWallets`, `loadWizardContext`,
  `loadSampleRoomDetail`, `loadRoomEditorData`, `roomPriceLabel`, `ORIGIN_META`,
  `FEATURE_BY_KEY`, `NEW_TYPE_SCHEMAS`, `SITE_PRESET_NAMES`, `QUOTES_ONLY_HOME`,
  `isTourDone`, `isRegisteredType`, `isFormTemplateKey`, `isAutoPopulate`,
  `pageKeyFromHref`, `resolveButtonStyle`, `getTemplateById`, `EMAIL_FIELD_TYPE`.

### D. Orphan DB function — 1 of 114 project-owned
`get_listing_availability` — no caller in app, cron or migrations.

### What the shape suggests

The **website builder accounts for ~15 of the 70** (9 actions, 5 components,
plus the analysers). That is consistent with Phase 6b being mid-build rather than
abandoned — these are probably *not yet* wired rather than dead. The
**external-reviews layer** is similarly built-ahead-of-approval.

By contrast, single orphans in shipped areas — `markNoShowBookingAction`,
`deletePolicyAction`, `assignCancellationPresetAction` — *look* like genuine gaps:
a host-facing capability that exists server-side with no way to trigger it.
**Tracing showed they are not** (see below). Every one turned out to be superseded
by a wired, richer implementation. A symbol having no caller says nothing about
whether the CAPABILITY is missing — check for a replacement before concluding
anything.

**Nothing was deleted on the strength of this list.** Each entry needs the §3
proof and its own commit.

### 🔒 Founder decisions 2026-07-22 — DO NOT DELETE

- **Website builder (~15 symbols)** — actively being built on a **sub-branch**.
  Not dead; not yet wired. Leave alone.
- **External-reviews fetch/reply layer** — the feature **must be completed**, it
  is simply not there yet (also blocked on Google/Meta approval). Leave alone.
- **Deletion is a last resort generally.** Re-coding something we already built
  wastes more than the dead code costs.

### 🔍 Traced 2026-07-22 — the five host/admin orphans

The question asked was whether these are *crucial*, since several sit near money.
**Only one is.**

| Symbol | Verdict | Money? |
|---|---|---|
| **`markNoShowBookingAction`** | ⚫ **DELETED — dangerous duplicate** (`2026-07-22`) | it would have been |
| `deletePolicyAction` | 🟢 superseded by `retirePolicyAction` (wired) | no |
| `assignCancellationPresetAction` | 🟢 redundant shortcut | no |
| `fetchScheduledReportsAction` | 🟢 redundant | no |
| `passOnPostAction` | 🟡 incomplete feature, skews one stat | no |

**⚫ `markNoShowBookingAction` — deleted, and worth reading why.**

My first pass here claimed this was a *real gap* — "a host cannot record a
no-show at all" — and proposed wiring the button. **That was wrong**, and §4 of
this very document had already said so on 2026-07-16. Believe §4.

**No-show already works.** `BookingActions.tsx` shows a **"No-show"** button
(`UserX` icon) for `status === "confirmed"`. It calls `forfeitBookingAction` →
`lib/bookings/forfeit.ts`, which sets:

```
status: "no_show",  payment_status: "forfeited",  balance_due: 0,
cancelled_by: "host",  cancellation_reason: "No-show / abandoned"
```

…plus the FRF statement, the guest notification, and the `on_booking_cancelled`
trigger releasing blocked dates. The `no_show` filter on the bookings board is
live; it reads 0 only because no test booking has been forfeited yet.

`markNoShowBookingAction` was a **superseded, simpler duplicate** that set
`status: 'no_show'` and **nothing else** — no `payment_status`, no `balance_due`
reset, no statement, no notification. Wiring it (as very nearly happened) would
have produced bookings marked `no_show` while the payment records still showed
money outstanding: **two divergent money paths writing conflicting state.**

That is exactly the "money is the spine — never fork it" rule, and it is why this
particular dead code was worth deleting rather than annotating — it existed only
to be mis-wired, and it nearly was.

**🟢 The three redundant ones** — capability is NOT missing, so nothing is broken:
- `deletePolicyAction`: policies are **retired**, not deleted, because they are
  snapshotted into bookings — hard delete would break historical refund maths.
  `retirePolicyAction` is wired and is the correct design.
- `assignCancellationPresetAction`: a wrapper that resolves a
  flexible/moderate/strict preset then calls `setListingPolicyAction`, which IS
  wired. `PolicyPicker` already lets a host choose "locked presets + their own",
  so cancellation policy — and therefore refund percentage — is fully reachable.
- `fetchScheduledReportsAction`: `dashboard/reports/page.tsx:500` queries
  `scheduled_reports` server-side; its four siblings are all wired.

**🟡 `passOnPostAction`** — "Not a Fit" on a Looking-For request. Doubly
incomplete: nothing calls it, **and** nothing filters the browse view on
`looking_for_passes`. But the table IS read by `analytics_looking_for_stats`,
which counts "posts viewed" from passes-or-responses — so with the table
permanently empty, that host stat **silently undercounts**. No money impact; a
quiet reporting inaccuracy, and another instance of the §8.1 pattern.

## Why this exists

`view_count` was fixed on 2026-07-16 and the autopsy is the whole reason for this document.
The feature had a table, a trigger, a server action, a UI, and a lifecycle doc describing how it
all worked. Every piece existed and had been ticked off. The only missing thing was the single
line that **calls** the action — `recordPostViewAction` had never been invoked by anything, ever.
It built green, linted green, and had never once run. The lifecycle doc confidently described a
call site that was never written.

That is not a one-off. It is the dominant failure mode of this codebase, and it is invisible to
every check we run, because **nothing on this platform has ever executed** (0 properties,
0 bookings, 0 Looking-For posts). "Done" has meant "the code exists".

So this audit asks the only question that catches it: **what invokes this?**

## Method (and how to re-run it)

Mechanical, then verified by hand. Never trust the output of step 1 alone — see *False positives*.

```bash
node scripts/audit-wiring.mjs          # exported runtime symbols with zero references
node scripts/generate-schema-doc.mjs   # regenerates docs/SCHEMA.md + its automated red flags
```

`docs/SCHEMA.md` is generated from the **live** database and re-runs the DB-side trap checks
(orphaned crons, unset Vault secrets, unpinned `search_path`, RLS-crossing triggers) on every run.

### False positives this sweep must survive

Each of these fooled the first version of the detector. Keep them in mind before believing a hit:

1. **Next.js entrypoints** (`page.tsx`, `route.ts`, `generateMetadata`, …) are exported and never
   imported *by design*. Excluded.
2. **The `withAdminAudit` pattern.** `export const fooAction = withAdminAudit(...)` is often used
   only by a thin `export async function foo()` in the *same file*. Same-file references must
   count, or every audited admin action reads as dead. (This produced ~745 false hits at first.)
   ⚠️ Note: some client components import the `withAdminAudit` const **directly**
   (`PlanEditor.tsx:60`), so callability cannot be used to infer deadness either way.
3. **Transitive death.** A file whose only caller is itself dead looks alive. `ListingSettingsDialog`
   and `SetupChecklist` are dead only because their sole importers are dead.
   **Re-run the sweep after each deletion pass until it reaches a fixed point.**
4. **A DB object may be superseded rather than unwired** — `next_invoice_number` uses a *sequence*,
   so `platform_counters` is dead, not a live counter. Always ask what *reads* it.

---

## 🚨 0.1 CRITICAL — our own fix took the public site down (FIXED `20260716340000`)

**`20260716320000`, the migration directly below, broke every public page for every
signed-out visitor — for ~24 hours, on live.** Found 2026-07-16 pt11 while rehearsing
something unrelated (the external-review mapping); one probe step asked "can `anon`
actually see this now?" and got an error that had nothing to do with the feature.

That migration looped over every `SECURITY DEFINER` function `anon` could execute and
revoked it, keeping an allowlist of four. Correct for the ~85 privileged RPCs it was
aimed at. But five of the functions it swept up are **not RPCs** — they are the helpers
the **RLS policies themselves call**: `get_my_host_id()`, `get_my_host_id_as_staff()`,
`get_my_role()`, `is_super_admin()`, `has_admin_permission(text)`.

🔑 **A policy calling a function the reader cannot EXECUTE does not evaluate false — it
RAISES.** And permissive policies are OR'd with **no guaranteed short-circuit**, so a
`public_read_*` policy sitting beside a `host_manage_*` one does not save you. Proven on
live as role `anon`, each a plain `SELECT`:

```
properties       -> 42501 permission denied for function get_my_host_id_as_staff
reviews          -> 42501 permission denied for function get_my_host_id
external_reviews -> 42501 permission denied for function get_my_host_id
blocked_dates, addons, property_rooms, specials, coupons, hosts  -> same
```

**Why it went unnoticed for a day** is this document's own thesis, turned on its author:
nothing has ever run (0 properties, 0 bookings), and the pages that *do* prerender use
`createAdminClient()` — service_role, which bypasses RLS. `..320000` verified its RPCs
**over real HTTP** and never once read a **table** as `anon`. The negative control was run
on the wrong surface.

**Fixed** by granting the five back to `anon`. Safe, and a different species to the other
85: each keys solely on `auth.uid()` and takes **no caller-supplied identity**, so `anon`
gets `NULL`/`false` and learns only "I am nobody". Compare `fetch_primary_kpis(p_host_id)`,
which hands you any host's revenue if you know their id — those stay revoked. Verified:
10/10 tables read as `anon`; `apply_wielo_credit` and `fetch_primary_kpis` still `42501`;
over real HTTP with the real publishable key, public tables `200`, kpis `401`.

📌 **Now auto-flagged** — `generate-schema-doc.mjs` red flag 6 fails on any function named
in a policy that `anon` can't execute, and flag 3 **excludes** RLS helpers so the two
can't argue and lure the next reader into re-breaking it.

---

## 🚨 0. CRITICAL — `anon` could mint credits and settle payouts (FIXED `20260716310000`)

Found by asking the audit's question of the DB grant layer. **Proven on live in a rollback**, as role
`anon` with no JWT claims at all:

```sql
SET LOCAL ROLE anon;
SELECT apply_wielo_credit('<host>','quote',500,'grant',...);   -->  605
```

500 Wielo credits minted into a host's wallet by a signed-out caller. And the surface is reachable:
`POST /rest/v1/rpc/is_super_admin` with the **publishable** key returns `200` — that key ships in the
browser bundle by design. So this was open to anyone on the internet. Same exposure for
`settle_affiliate_payout`, `set_affiliate_status`, `create_affiliate_payout` — all of which take
*"who am I"* as a caller-supplied `p_admin` argument and never verify it, because they were only ever
meant to be called by trusted server code.

**Root cause is a Postgres default, not a typo.** `CREATE FUNCTION` grants `EXECUTE` to **PUBLIC**
automatically, and `anon` inherits through PUBLIC. Every `REVOKE ALL ON FUNCTION … FROM anon` in this
repo was therefore a **no-op** — revoking a grant `anon` never directly held while the inherited
PUBLIC grant stayed. `SECURITY DEFINER` runs as owner and bypasses RLS, so each one is an RLS bypass
with a public URL.

**Fixed** for the 7 money-movers + `record_guest_post` (looped by name so overloads can't be missed;
every legitimate caller uses the service-role client, so nothing broke). **Verified by re-running the
attack:** it now returns `42501: permission denied for function apply_wielo_credit`.

### ✅ The rest of the surface is closed too (`20260716320000`) — 89 → 4

The other 80 were worse than they looked. **Proven as `anon`:**

```sql
SET LOCAL ROLE anon;
SELECT fetch_primary_kpis('<host>', '2020-01-01', '2030-01-01');
--> {"adr": {...}, "revpar": {...}, "revenue": {...}}     -- it RETURNED.
```

Any host's revenue, ADR and RevPAR, to an anonymous caller who knows a `host_id` — and host ids are
not secret. Zeros only because there are no bookings yet. Same for `fetch_host_guests` (guest PII),
`fetch_guest_demographics`, `fetch_revenue_trend`, plus writers like `ensure_booking_invoice`.

Each of the 80 was classified by **who actually calls it and with which client** — `createAdminClient()`
is service-role and never needs the anon grant; `createServerClient()` acts as `anon` only when the
visitor is signed out. Revoked PUBLIC + anon, granted back `authenticated` + `service_role`. **anon
keeps exactly 4**, all read-only and genuinely reachable signed-out: `fetch_platform_commission_saved`,
`get_listing_policy_summary`, `product_units_sold`, `check_feature_permission`.

**Safe because the public booking flow never runs as anon** — `lib/bookings/persist.ts` and
`lib/website/siteCheckout.ts` both use `createAdminClient()`. Verified over **real HTTP with the real
publishable key**: the two public RPCs return `200`; `fetch_primary_kpis`, `apply_wielo_credit` and
`fetch_host_guests` all return `401 / 42501 permission denied`.

> ⚠️ **STILL OPEN — IDOR, a different bug.** These functions take `p_host_id` as an argument and never
> verify the caller owns that host. Any **signed-in** user can still read another host's KPIs by passing
> their id. This migration removed the *unauthenticated* exposure — the difference between "needs
> nothing" and "needs a free account". Closing it needs an ownership check inside each function: its own
> pass, and it belongs in `SECURITY_CHECKLIST.md`.

---

## 🔴 1. LIVE BUGS — broken right now, on production

### ✅ FIXED `20260716300000` — `check_guest_post_quota` threw on every call
**Proven on live** by calling it:
```
ERROR: 42P01: relation "looking_for_quotas" does not exist
CONTEXT: PL/pgSQL function check_guest_post_quota(uuid) line 24
```
`20260716200000_consolidate_wielo_credits.sql` (shipped **yesterday**) dropped `looking_for_quotas`,
but the function still reads it. PL/pgSQL binds table names late, so the `DROP` succeeded and left
the function raising at runtime. The live DB has the function and not the table — visible in
`packages/types/database.types.ts`, which lists `check_guest_post_quota` and no `looking_for_quotas`.

**Why nobody noticed: all three call sites fail OPEN.**
- `portal/looking-for/actions.ts:121` — `if (quotaError) { console.error(...); // Continue anyway }`
- `portal/looking-for/page.tsx:112` — error discarded; `remaining_*` defaults to 999 → hint never shows
- `record_guest_post_and_check` → `portal/looking-for/actions.ts:188` — `recErr` logged and swallowed

**Blast radius:** the guest post cap is entirely unenforced (a guest can post unlimited requests);
the "X requests left" hint has silently vanished; and because the function raises *before* its
insert, `looking_for_usage` records **no `guest_post` rows at all** — the usage log is quietly empty.

**Resolution — guest posting is uncapped for MVP, deliberately and visibly.** There was no per-guest
limit source left to point at, and inventing one would have been inventing product policy: guests have
no subscription (`lib/guests/permissions.ts` is explicit that guest capabilities are GLOBAL booleans
with no limit concept), `looking_for_quotas` keyed limits by `plan_id` while every guest sits on the
product-less `free` baseline, and CLAUDE.md's pre-MVP policy requires every feature be OPEN on `free`
anyway. So the cap is gone rather than fake. `check_guest_post_quota` and the misnamed
`record_guest_post_and_check` are dropped; `record_guest_post` records the action log and **does not
swallow its error** — the fail-open habit is exactly what hid a hard `42P01` for a day. When a cap is
wanted, add a `plan_features` key and gate via `check_feature_permission` (the mandated SSOT).

📌 **The root cause is worth remembering.** `..200000`'s own comment justified the drop:
*"Admin-editable since 20260628100000 and read by NOTHING."* That was false — the table **was** read,
by a **DB function**, not by TypeScript. The author checked app code and missed the database. That
blind spot is precisely what `audit-wiring.mjs` sweep 2 now closes.

---

## 🟠 2. UNWIRED FEATURES — the `view_count` class

The feature is built and expected to work. Nothing calls it.

> ✅ **The first three are WIRED (2026-07-16 pt11).** Wiring each one uncovered a
> second fault *underneath* it that would have made the button fail on its first
> click. Adding the caller alone would have shipped three green, broken features —
> which is the same mistake in a new coat. Details in each row.

| What | Evidence | Blast radius |
|---|---|---|
| ✅ **Bookmarks fake success** — WIRED | `RequestCard.tsx:271` — `onClick={() => setIsBookmarked(!isBookmarked)}`, pure local `useState(false)` at `:46`. `toggleBookmarkAction` (`looking-for/actions.ts:258`) is the only writer of `looking_for_bookmarks`. | **Worse than `view_count`: it lies to the user.** The icon fills brand-primary so the host believes it saved, then it resets on refresh. "Saved Requests" is a live sidebar item (`Sidebar.tsx:156`) that renders its empty state forever. **Fault underneath:** the action itself `await`ed its insert/delete and **discarded the error**, returning `{success:true}` unconditionally — so wiring the button would have moved the lie from the component into the action. Now: errors returned, host resolved from the session (was a client-supplied `hostId`), `is_bookmarked` seeded from the DB, 23505 treated as the state the host asked for. |
| ✅ **Hosts cannot dispute a review** — WIRED | `flagReviewAction` (`dashboard/reviews/actions.ts:238`) has no caller. `ReviewCard.tsx:155` renders a read-only "Flagged" *badge* — no button exists. | Every downstream consumer is built: host "Flagged" tab (`FilterTabs.tsx:50`), an admin queue that **defaults** to the flagged tab (`admin/reviews/page.tsx:92`), an `/admin` counter (`admin/page.tsx:57`). **Two faults underneath, both fixed in `20260716330000`:** (1) `review_flags` has had **RLS enabled and ZERO policies since May** (`20260501000007:65`), so the insert raised `42501` — proven on live; the action could *never* have succeeded. (2) The "unique check on (review_id, flagged_by)" its comment claims **never existed**. Both now real, rehearsed with 6 controls. Also: the admin queue never read `review_flags`, so the host's typed explanation went nowhere — now surfaced under "Host said:". |
| ✅ **External reviews can never appear** — WIRED | `mapExternalReviewToPropertyAction` is the only writer of `external_reviews.property_id`; the sync Edge Function never sets it (`external-reviews-sync/index.ts:314` omits the column). The public query hard-filters `.eq("property_id", listingId)` (`property/[slug]/reviews-data.ts:158`). | `property_id` is permanently NULL, so **no external review can ever render on any property page** — the entire public point of the feature. `getHostPropertiesAction` exists to fill a mapping dropdown that was never built (`ExternalReviewsHub.tsx:712` renders the name read-only). **Dropdown built**; an unmapped review now says "Not shown on a page" instead of rendering nothing. Rehearsed on live: host maps → 1 row → persists → the public query returns it; another host → 0 rows. ⚠️ **The rehearsal is what caught the `anon` regression in §0.1** — the public-visibility step failed for a reason that had nothing to do with this feature. |
| **Cannot reply to an external review** — 🔴 FOUNDER | `replyToExternalReviewAction` (`lib/external-reviews/actions.ts:649`) has no caller; the Hub has no textarea/button. | Hosts see replies made on Google/Facebook directly, but can never compose one from Wielo. **Left for the founder:** wiring the button is trivial, but the action posts the reply to Google/Facebook via the `external-review-reply` Edge Function — unverifiable without real OAuth connections + a real external review, and the audit's own lesson is that wiring these blind ships "green + broken". Needs a real external-review account to test against. |
| ✅ **Brochure can never be removed** — WIRED (2026-07-17) | Was: `removeHostBrochureAction` (`quotes/actions.ts:307`) had no caller; the UI offered only "Include" and "Replace". | Now: `QuoteForm.tsx` imports `removeHostBrochureAction` and renders a "Remove brochure" button beside "Replace" (in the Terms-&-reply step's brochure block). tsc + lint green; the action nulls `brochure_path`/`brochure_name`. ⚠️ **Live click not witnessed** — the block is 3 steps deep in the quote wizard, which resisted automation this session; the button is code-correct and sits in the same conditional as the live "Replace" button. |

> **📌 The external-reviews docs are wrong.** `CURRENT_TASK.md` and `docs/lifecycles/README.md` say
> the feature is blocked on missing Vault secrets. Only the **cron half** is. The manual **Refresh**
> button is live and **bypasses Vault entirely** (`actions.ts:286` calls the Edge Function directly
> with the service-role key). Set every Vault secret today and reviews would *still* sync into a
> table no property page can read. It is blocked on a **missing dropdown**, not a secret.

---

## 🟡 3. FOUNDER DECISIONS

1. **The plan-key billing lane.** `startPlanCheckoutAction` is dead, **but there is no revenue gap** —
   hosts subscribe via `PlanPicker.tsx:53` → `switchToProductAction` → Paystack, and signup's paid
   path is live at `signup/host/actions.ts:232`. The dead action is the **sole** reachable caller of
   `switchPlanAction` and `startSubscriptionCheckout` (`lib/billing/platform-billing.ts:49`).
   Delete all three, or park for Phase 3 — **do not delete piecemeal**.
   (`isPlatformBillingConfigured` must stay; still used at `actions.ts:353`.)
2. **Website builder capability loss.** Commit `57e262da` ("delete old builder (phase 6)") removed
   every caller of per-page SEO (`savePageSeoAction`), the SEO coach (`analyzeSeo`), the
   accessibility checker (`analyzeA11y`), saved sections, site-width layout, and room overrides.
   V3 re-wired only 5 actions and references none of these. The RoomBuilder loss was signed off;
   **per-page SEO + a11y + saved sections look like unintended collateral** — they were deliberately
   added one commit earlier (`4b630629`). Site-level SEO survives via a different action, which
   masks the per-page gap. Re-wire into V3, or delete ~10 exports + 2 analyzer files.
3. **`passOnPostAction`** — PREMATURE. No caller **and no reader**: the browse query never filters
   passes, so wiring the button alone would hide nothing. Build both halves or delete action + table.

---

## 🟢 4. SAFE DELETES — verified replacement exists

Each was traced to a **live, working** replacement (the replacement was confirmed to render/persist,
not merely assumed from a comment).

> **Status (2026-07-17):** the two whole-unit deletes with the clearest safety + security value are
> done — `platform_counters` (dropped) and `entitlements.ts` (deleted). The remaining rows are
> individual dead exports scattered **inside otherwise-live files**; deleting those safely means
> re-verifying each export is still unreferenced (the audit is from pt11 and the codebase has moved)
> and editing live files one by one. That is a focused batch of its own, deliberately NOT bundled into
> an unrelated session — bulk-deleting ~35 exports from live files late in a long change is exactly the
> kind of move that introduces a regression the audit was written to prevent. Do it as its own pass.

| Symbol | Superseded by |
|---|---|
| `check_host_quote_quota` (DB) | Credits: `spendQuoteCredit` (`quotes/actions.ts:917`) + `unlockLead`. Deliberate replacement; `looking_for_quotas` dropped in `..200000`. |
| `get_listing_availability` (DB) | `listing_is_available_whole` / `room_is_available`. ⚠️ **It ignores bookings entirely — wiring it would be a regression.** |
| `get_host_inbox_stats` (DB) | Computed inline (`inbox/page.tsx:112`). |
| `get_host_refund_stats` (DB) | Computed inline. Also counts `status='escalated'`, a state removed in `20260614000001`. |
| ✅ `platform_counters` (table) — **DROPPED** (`20260717000700`) | Sequences (`next_invoice_number` → `seq_invoice_number`). **Nothing read it** — proven: `SELECT count(*) FROM pg_proc WHERE prosrc ILIKE '%platform_counters%'` = 0, only superseded migrations referenced it. It was also the only table with **no RLS** + full `anon` RW. Dropped; invoice/credit-note numbering (sequence-based) unaffected — verified 27 invoices intact + `next_invoice_number` still resolves. |
| `deletePolicyAction` | `retirePolicyAction` (`RetirePolicyModal.tsx:63`) — strictly safer; reassigns listings first. |
| `assignCancellationPresetAction` | `PolicyPicker` → `setListingPolicyAction` (real policy rows). |
| `markNoShowBookingAction` | `forfeitBookingAction` (`BookingActions.tsx:165`), which sets `status:'no_show'` itself and does more. ⚠️ The two disagree on semantics (`TRANSITIONS.noShow` says dates stay blocked + no guest notice; forfeit releases dates *and* notifies) — deleting the dead one removes the contradiction. |
| `markComplete` + `markCompleteAction` | `fulfillExport` / `fulfillDeletion`. Coverage is total: `CHECK (request_type IN ('export','deletion'))`. |
| `adminSendPlatformMessageByEmailAction` | `adminSendPaymentLinkToInboxAction`. **Its comment lies** — claims the revenue ledger calls it. |
| `togglePlanActiveAction`, `toggleServiceActiveAction`, `toggleProductActive` (+ its const) | An "Active" checkbox inside each editor, saved via the normal upsert. |
| `RoomsGroupCard` **+ `ListingSettingsDialog`** | `rooms/page.tsx` defines its own `ListingGroupCard`. The dialog is transitively dead. Booking-mode switching survives at `BasicTab.tsx:176`. |
| `FirstLoginHero` **+ `SetupChecklist`** | `OnboardingDashboard`. `SetupChecklist` is transitively dead. |
| `CreateWebsiteCard` | `CreateWebsiteButton` (`website/page.tsx:145`); gating intact. |
| `loadWizardContext` | `loadWizardAccount.ts` (the V1 wizard shipped and works). |
| `saveWebsiteRoomsAction` | Rooms auto-pull on publish (`9123ab57`, deliberate). |
| 8 × google/facebook helpers | The Deno Edge Functions reimplement them locally. ⚠️ **Delete the named exports only** — sibling OAuth exports in the same files are live. Duplication is a real drift hazard (two star-rating mappings). |
| `SetupSidePanel`, `CompletedSetupHeader`, `AcademyCards`, `ComingSoon`, `SettingsHero`, `previewDealCategoryKey`, `checkSubdomainAvailabilityAction` | Superseded/never-adopted UI. |
| ✅ `lib/products/entitlements.ts` (**whole module**) — **DELETED** (2026-07-17) | `lib/products/featureGate` → `hostHasFeature`. Confirmed zero importers before deleting; build green after. |
| Trivial unused helpers | `getCreditWallets`, `isRegisteredType`, `isPlatformPayPalEnabled`, `getActiveMetaPixelId`, `randomId`, `getCronLabel`, `isValidCron`, `businessDisplayName`, `getListingBusinessId`, `formatAggregatedRatingTooltip`, `isWideRoute`, `useBranding`. |

---

## ⚪ 5. Systemic — from `docs/SCHEMA.md`'s automated red flags

- **4 Vault-gated crons whose secrets are unset** — they report `succeeded` while doing nothing:
  `drain-looking-for-notifications`, `poll-website-domains`, `publish-scheduled-posts`,
  `sync-external-reviews`. Founder-only (`vault.create_secret` per environment).
- **74 `SECURITY DEFINER` functions with no pinned `search_path`.** Each resolves object names via
  the caller's path. Fix is mechanical: `SET search_path = public, pg_temp`.
- **1 `SECURITY INVOKER` trigger writing to another RLS table** —
  `tr_help_article_feedback_counters` on `help_article_feedback` → `help_articles`.
  **Verified safe**: its only writer is `vote_help_article`, which is `SECURITY DEFINER`, so the
  trigger runs as owner and bypasses RLS. Left as-is; the check is worth keeping.
- **`isAuthorized()` in `external-reviews-sync/index.ts:25` can never return false** — both branches
  `return true`, so the shared-secret gate is decorative. Mitigated (not exploitable) because
  functions deploy without `--no-verify-jwt` (`deploy-functions.yml:36`) so the platform verifies
  the JWT — but note the public **anon key is a valid JWT**, so the effective gate is weak. Worth a
  real check or an honest comment.

---

## The rule this audit exists to enforce

**A feature is not done when the code exists. It is done when something calls it and you have
watched it run.** Until the smoke test happens, treat every ⚠️ in `CURRENT_TASK.md` as unproven.
