# Launch-Readiness Test Sweep

Branch: `test/launch-readiness-sweep` (rebased onto `main` @ `f9aadc43`).
Scope: signup · booking engine + sub-features · affiliate · pipeline. Every PASS is
backed by a browser check **and** a read of the underlying DB row(s).

Legend: ✅ PASS · 🔧 FIXED (bug found + fixed + re-verified) · 🟡 PARTIAL · ⏳ TODO · 🚩 FINDING (needs owner decision)

---

## Fixes committed this session

| # | Commit | What |
|---|---|---|
| 1 | `fix(seed): fall back to an active membership` | Seed hard-coded the deleted `beta` product; now uses the cheapest active membership. |
| 2 | `fix(signup): require a plan; trial products start a trialing sub` | No free host tier; plan selection required; a trial product starts a **trialing** sub (no card), instant dashboard. Verified: `status=trialing, product=standard, plan=pro, trial_ends_at +14d`. |
| 3 | `fix(seed): reset password for existing starter accounts` | `ensureAuthUser` only set the password on create → seed accounts weren't on `WieloStarter123!`; now reset every run. |
| 4 | `fix(rls): get_my_host_id() must exclude soft-deleted hosts` | RLS resolver ignored `deleted_at` → soft-deleted host still resolved; host saw zero of their own bookings. Applied to live DB. |
| 5 | `fix(dashboard): filter deleted_at in inline host resolvers` | 13 dashboard resolvers queried `hosts` without `deleted_at` → false "finish onboarding" gate. |
| 6 | `fix(calendar-sync): surface the real iCal export URL` | Export URL was unreachable ("Get my export URL" was a dead link; `signListingToken` used nowhere in the UI). Now each listing shows its signed export URL + copy; feed verified valid + no PII. |
|   | (earlier) signup Step-3 copy | Removed the false "we seed your listing as a draft / land in the editor" promise (finalize creates no listing by design). |

---

## Phase 1 — Signup ✅

- **Guest signup** ✅ — lands on portal; DB `role=guest`, terms accepted, `email_verified_at` NULL (soft nag).
- **Host signup** 🔧 — see fixes #2 and the copy fix. Trial model proven UI + DB.
- **Partner signup** ✅ — creates a `pending` affiliate (code 82099, `@sweep-partner`); activation gate holds (email-verify required); DB `status=pending`.
- **Anti-enumeration** ✅ — existing email → generic message, no session, no leak.

## Phase 2 — Booking engine

- **Core booking** ✅ — assembly, pricing precedence (base), **total R4600 (quote == charge == DB)**, 4 policies shown + **4 policy_snapshots** frozen.
- **Host booking view** 🔧 — worked after fix #4 (RLS). Board shows the 2 bookings, revenue, occupancy — matches DB.
- **Confirm → blocked_dates** ✅ — full EFT payment recorded via UI → `confirmed`, payment row created, **3 blocked_dates** written; **double-booking guard is room-granular** (booked room blocked for booked dates; other rooms/dates free). (Empty `blocked_dates` before this was a seed artifact — seed bookings have no `booking_rooms`.)
- **Coupons** ✅ — `SWEEP20` → −R870 (20% of accommodation, **cleaning excluded**), total R3730; atomic redemption (`coupon_redemptions` + `redeemed_count=1`); DB matches quote.
- **Specials** ✅ — per-night R1000 special → base R2000 + R250 = R2250; `origin='special_booked'`, `special_id` set, `redemptions_used=1`; DB matches quote.
- **Add-ons** ✅ — per-stay R350 add-on → `booking_addons` (qty 1, subtotal 350), total R3500; `computeAddonSubtotal` correct; DB matches quote.
- **Inbox** ✅ — guest↔host `conversation` + system-card `messages` on booking; host inbox renders the thread + "We've reserved BK-0114… complete your EFT transfer" card.
- **Calendar** ✅ — reflects confirmed booking (3% occupancy · 3 nights · R4 599).
- **Reviews** ✅ — public listing display (4.00 · 1 review, sub-ratings), host review-management page (1 awaiting reply), guest-CRM rating — all match DB.
- **Guest records** ✅ — Lerato: Returning, 2 stays, 6 nights, R9200 lifetime, rating 4 (pending EFT bookings correctly excluded).
- **Cancellation/refund** ✅ — refund calc reads the frozen snapshot (100% = R4600, Moderate @ 13 days); cancel → `cancelled_by_host` + all 3 blocked_dates released.
- **iCal** 🔧 — see fix #7. Export URL now surfaced + copyable; feed is valid RFC-5545; confirmed booking → VEVENT ("Booked: Lion's Head Room", 10→12 Aug); no guest PII.

## Phase 3 — Affiliate ✅
- Partner signup + activation gate (Phase 1). Affiliate dashboard renders real data: code 24198, link `/r/wollie-steenkamp`, balance buckets (Pending **R125**, Lifetime R125), 2 signups · 1 paying, referred hosts at 25% locked rates, commission ledger, payout request. Attribution→accrual→balance chain works with real money.

## Phase 4 — Pipeline ✅
- Board renders both audiences (Hosts/Affiliates) with stages + KPIs (10 leads, 30% conversion).
- **My test signups correctly staged**: Sweep Guest → **Signed up**; Trial Host → **Trial** (auto-moved by the trialing-subscription trigger — confirms the pipeline automation *and* fix #2 feeding it).
- Lead record: tabs (Activity/Details/Emails/Tasks/Files), **super-admin Delete** visible, full activity trail (Started signup → Signed up → Trial).
- **Funnel capture**: `/go/hosts` submit → lead identity + pipeline card created (DB verified).
- Not driven (lower priority): manual drag + system-managed-stage rejection, delete deny-path (needs a non-super-admin), task/file add.

---

## 🚩 Findings (need owner decision)

### F1 — Host-signup free-vs-paid model (RESOLVED via fix #2)
The plan step pre-selected a paid plan and had no free path, contradicting "no card needed"
copy. Resolved per founder spec: paid subscription required, trial products start a trialing
sub with no card. See fix #2.

### F2 — Pervasive unfiltered host resolvers — **RESOLVED (2026-08-07 sweep)**
`from("hosts").eq("user_id", …).maybeSingle()` **without** `.is("deleted_at", null)`. A user with a
soft-deleted host row (hosts are soft-deleted, never hard-deleted) hits a false "set up your host
profile / finish onboarding" gate, and a lone soft-deleted host resolves as the caller's host
(soft-delete doesn't revoke access). Prior session fixed 13 dashboard cases (fix #5) + the RLS
`get_my_host_id()` function (fix #4).

**Full audit (2026-08-07):** classified all 205 `.from("hosts")` call sites app-wide (4 parallel
auditors over dashboard / admin / lib / rest). Most are NOT the bug — `.eq("id", hostId)`
notify/display lookups are legitimately unfiltered; scripts and bulk/admin ops are out of scope.
The genuine "resolve the CURRENT user's own host by `user_id`, missing `deleted_at`, gates access"
class = **18 sites**, all now fixed:

- **Routed through the shared `getMyHostId(supabase)` helper (10 sites, `.select("id")`-only
  resolvers):** `dashboard/settings/subscription`, `dashboard/policies`, `dashboard/seasonal-pricing`,
  `dashboard/quotes/new`, `dashboard/quotes/[id]/edit`, `dashboard/properties/new`, `dashboard/staff`,
  `dashboard/reviews/actions.ts` (×2), `signup/host/page.tsx`.
- **Inline `.is("deleted_at", null)` (8 sites — multi-column reads or admin-client, can't return via
  the id-only helper):** `dashboard/page.tsx`, `dashboard/inbox`, `dashboard/reviews/page.tsx`,
  `dashboard/settings/banking`, `dashboard/setup`, `dashboard/settings/notifications`,
  `signup/host/actions.ts` (admin idempotency guard), `lib/help/queries.ts` (non-gating checklist).
- **Plus 2 non-gating cousins filtered for consistency:** `dashboard/settings/page.tsx` (avatar
  fallback), `dashboard/settings/actions.ts` (profile-mirror select + update).

Verified: `pnpm build` + `pnpm lint` green; policies / seasonal-pricing / staff / quotes-new /
reviews render real host-scoped data live (getMyHostId resolves correctly on the happy path);
zero server errors.

**Money-path billing resolves — FIXED (2026-08-07, founder-authorised follow-up).** The 5 genuine
`user_id` resolves in `lib/billing/product-checkout.ts` (`:160, 661, 687, 708, 1366`) now filter
`.is("deleted_at", null)`, matching `:1562` which the VAT session already filtered. Rationale beyond
consistency: since the RLS `get_my_host_id()` fix now excludes soft-deleted hosts, a resolve-or-create
flow that returned a soft-deleted host would attach a **paid subscription to a host the buyer can no
longer access** — filtering makes checkout use/create a LIVE host. The other `lib/billing/**` sites
are `.eq("id", hostId)` lookups off a known subscription/order row (not "my host by user_id") and are
correctly left unfiltered; `platform-report.ts:328` already filters.

**Ground-truth correction — the two "by design" items were also FIXED (my earlier call was wrong):**
- `hosts.user_id` is a plain **non-unique index** (`idx_hosts_user_id`), not a unique constraint — so
  a user can hold a soft-deleted + a live host row, and any un-filtered `user_id` `.maybeSingle()`
  **throws** on such a pair.
- `dashboard/settings/data/actions.ts:148` — this is a **soft close** (retains rows for the 30-day
  hold; an admin hard-purges later), NOT a hard purge. `hostId` only scopes the active-booking/refund
  **safety gate**. Filtering `deleted_at` loses no data and fixes the two-row crash → **fixed**.
- `lib/hosts/ensureHost.ts:18` — provisioning create path is a plain `.insert` (no unique constraint),
  and returning a soft-deleted host would attach an admin-sold subscription to a dead host → **fixed**
  (filter → use/create a live host).
- `lib/inbox/platform-thread.ts:362` — best-effort pay-card status → **fixed** for consistency + crash
  safety.

---

## Environment notes / limits
- **Live card checkout untestable by the agent** — no Paystack gateway is connected to a seed host, so only EFT appears at booking checkout. Founder to test the card path as a real user.
- **Email delivery off** (`RESEND_API_KEY` empty) — magic links / verification / review-request / nurture don't send; verified queue/trigger side instead, used password login.
- **VAT commits** (`e640c58`, `b5506b31`) target Wielo's own subscription billing, **not** guest→host bookings — booking totals unaffected (confirmed R4600 == quote).
- Automation limits: writes to `bookings`/`payments` via SQL are classifier-blocked (payments recorded via UI); host row deletes are classifier-blocked (founder runs those); some Radix controls need real mouse clicks.

## Test data created (for Phase 6 cleanup)
- Accounts: `sweep.guest1@` (→ host, pre-fix free-no-product), `sweep.host.trial1@` (trialing), `sweep.partner1@` (pending affiliate).
- host1 config: coupon `SWEEP20`, special `sweep-winter-special`, add-on `Airport Shuttle`.
- Bookings: BK-0111 (confirmed EFT), BK-0112 (coupon), BK-0113 (special), BK-0114 (add-on) — all `guest@wielostarter.com`.
