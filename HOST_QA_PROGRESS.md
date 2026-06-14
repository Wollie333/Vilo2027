# Host-Side Feature Verification — Progress Tracker

> **Durable across days.** This is the file to read first when resuming. It
> records what's verified, what's next, how to re-seed, and the working method.
> Full plan: `C:\Users\Wollie\.claude\plans\i-want-to-start-cosmic-lerdorf.md`.

## Goal
Walk every host-side feature (`/dashboard/**`) in dependency order and confirm
each works **100%** before moving to the next, fixing broken code on the spot.

## How to resume (daily)
1. Read this file + the "Activity log" at the bottom.
2. Start the app: from `apps/web` run `pnpm dev` → http://localhost:3000
3. Log in as the demo host (below). Re-seed if data looks off.
4. Continue at the first ⬜ feature in the checklist.

## Demo data / login
- **Seed command:** from `apps/web` → `pnpm seed:demo` (idempotent, safe to re-run)
- **Script:** `apps/web/scripts/seed-demo.mjs` (Cloud, service-role key from `.env.local`)
- **Host login:** `host@vilodemo.com` / `ViloDemo123!`
- **Guest login:** `guest@vilodemo.com` / `ViloDemo123!`
- **Seeded:** 2 listings (Seaview Cottage = whole_listing; The Vines = flexible/rooms),
  2 rooms, 2 add-ons, seasonal pricing, 5 bookings (pending/confirmed/completed/
  cancelled/rooms), 4 payments, 1 pending refund request, 3 auto-invoices,
  1 conversation, 1 review.

## Working method (per feature)
1. **Audit** (can be a sub-agent, see below): read page + server actions + RLS;
   check RHF+Zod, server-action-only mutations, feature gate, no `any`, Realtime cleanup.
2. **Static gate:** `pnpm build` + `pnpm lint` + `pnpm type-check` (from `apps/web`).
3. **Live check:** founder runs the flow in the browser; reports breakage.
4. **Fix** → re-run static gate → founder re-checks.
5. Mark ✅ here + note any deviation, then move on.

## Parallelization with sub-agents
The **live + fix loop stays sequential** (it's founder-driven and dependency-ordered).
What we parallelize is the **read-only code-audit** ahead of each live session:
- Before each work session, fan out **3–4 audit sub-agents at once**, one per
  upcoming feature, each returning a findings list (bugs, missing gates, `any`
  usage, broken imports, RLS gaps). Audits are read-only so they can't collide.
- We then sit down and do the live+fix loop with the issues already mapped.
- **Don't** parallelize fixes to interdependent features (e.g. bookings ↔ payments)
  — apply those sequentially to avoid conflicting edits.
- Good independent-audit batches: {Help, Notifications, Staff}, {Quotes, Invoices,
  Add-ons}, {Subscription, Banking, Host profile}, {Seasonal pricing, Calendar, iCal}.

## Checklist (foundation → leaf)
Status: ⬜ not started · 🟦 in progress · ✅ done · ⚠️ done w/ caveat

- [✅] **0. Demo seed script** — idempotent, verified (triggers fire, no counter inflation).
- [🟦] 1. Onboarding setup wizard — `/dashboard/setup`. Full rework code-complete on branch
  `feat/setup-wizard-rework` (all build/lint/type-check green); **awaiting founder live check**.
  FLOW: `/signup/host` → host+draft listing → `/dashboard` checklist → `/dashboard/setup`
  5 steps **Profile → Banking → Listing → Policies → Review** → publish → `/dashboard`.
  Rework done: 1a shared completion (fixes "incomplete after publish"); 1b full RoomEditorSheet
  (details+photos+amenities, create-first); 1c shell redesign (dark hero, progress ring, step
  chips, active glow, globals CSS); 1d About WYSIWYG + banking reveal; 1e guest-preview review
  with per-section Edit buttons + confetti on publish. Earlier: avatar-hang fix (StepProfile).
- [⚠️] 2. Host profile — lives at `/dashboard/settings` (`/dashboard/settings/host` is a redirect).
  Code audited: RHF+Zod, server-action-only mutations, RLS-scoped host update, no `any` ✅.
  Fixed: (a) leftover `viloplatform.com` handle hint → relative public path (`1bfe568`);
  (b) avatar size limit mismatch 8MB client vs 5MB server → aligned to 4MB both sides, under
  the Vercel Server-Action body cap (`8194853`). **Founder live-check pending.**
- [⚠️] 3. Banking details — `/dashboard/settings/banking`. Code audited CLEAN, no changes:
  all 12 actions auth-gated via `resolveHost()`; account numbers + gateway secrets encrypted
  at rest and decrypted server-side ONLY for outbound Paystack calls (never returned to client);
  no `any`, no stray logs; RHF+Zod (schemas.ts); logo upload resizes client-side to ≤512px
  before posting (no body-cap risk). **Founder live-check pending.**
- [⚠️] 4. Subscription & billing — `/dashboard/settings/subscription`. Code audited CLEAN:
  switch/cancel/reactivate actions all auth-gated (`getMyHostId`), Zod-validated, RLS-scoped,
  no `any`/logs; PlanPicker `plan ===` checks are switcher UX, not feature gates. **Known gap
  (launch-blocker, NOT a bug):** real Paystack/PayPal subscription billing is intentionally
  stubbed pre-MVP — `switchPlanAction` records state only; wire provider + webhooks before
  launch (founder ops/keys). **Founder live-check pending.**
- [⚠️] 5. Listings (portfolio/new/edit/photos/amenities) — `/dashboard/listings`. Audited:
  all 20 edit actions auth-gated (`assertOwnership`), no `any`/logs; photos use the direct
  browser→Storage pair (`createListingPhotoUploadUrl` + `registerListingPhotoAction`, no body
  cap); publish gate enforces required fields + `hostHasValidEft` + full `computeSetupCompletion`
  at the app layer AND the `trg_listing_requires_bank` DB trigger. Fixed: removed the dead
  `uploadListingPhotoAction` (8MB-through-action body-cap footgun, zero callers) (`cfd0e64`).
  **Founder live-check pending** (editor tabs, photo upload UX, publish flow).
- [⚠️] 6. Rooms — `/dashboard/rooms` (cross-listing overview; the room editor lives under
  #5). Audited CLEAN: no `any`/logs; the only mutation (`setBookingModeAction`) is the
  auth-gated listings action; page reads are explicitly `host_id`-scoped (the dashboard
  query gotcha — public-readable tables filtered to the owner). **Founder live-check pending.**
- [⚠️] 7. Seasonal pricing — `/dashboard/seasonal-pricing`. Audited CLEAN (best-in-codebase
  gating): all 5 actions auth-gated (`getHost`); create/update/copy use the real
  `check_feature_permission` RPC (`seasonal_pricing` seeded `true` for free in mig
  `…000008`, so reachable pre-MVP); delete/toggle skip the gate by design (manage existing
  owned rules); thorough ownership (`assertRuleOwnership`/`assertListingOwnership`/room→listing);
  Zod; no `any`/logs. **Founder live-check pending.**
- [⚠️] 8. Add-ons — `/dashboard/addons`. Audited: 9 actions auth-gated, host-scoped, no
  `any`/logs, Zod. Fixed: add-on image upload had no client guard + 8MB server limit (Vercel
  body-cap footgun) → added client type+4MB guard, server capped to 4MB (`43b471f`). (3rd
  instance of this upload pattern — see avatar #2, listing-photo #5.) **Founder live-check pending.**
- [⚠️] 9. Availability calendar — `/dashboard/calendar`. Audited: mutations are
  auth-gated Server Actions (`assertListingOwnership`), reads host-scoped, guest
  embed FK-pinned, no `any`/logs, no uploads. `nightsBetween` (bookings/new) is
  UTC-consistent — NOT the off-by-one an audit suspected (verified). Minor POLISH
  (not fixed): `calendar/actions.ts:29` casts the embedded `host` via `unknown`
  (RLS-mitigated); RangeActionCard est-total uses the check-in night's rate only
  (UI estimate; server pricing is correct). **Founder live-check pending.**
- [⚠️] 10. iCal calendar-sync — `/dashboard/calendar-sync`. **Fixed a real BLOCKER:**
  `removeIcalFeedAction` admin-deleted `blocked_dates` by a client-supplied
  `feedId` BEFORE any ownership check → a host could wipe another host's imported
  blocks. Now verifies ownership via the RLS client first (mirrors
  `syncIcalFeedAction`). Rest clean: token export is timing-safe + token-gated,
  parser defensive (can't clobber confirmed bookings — scoped to `source='ical'`),
  30s fetch timeout, errors surface to `last_error`. **Caveats for founder (ops/
  spec, not code bugs):** (a) `ICAL_TOKEN_SECRET` undocumented in ENV_VARS.md and
  falls back to `SUPABASE_SERVICE_ROLE_KEY` for HMAC — document the dedicated var
  + drop the fallback before launch; (b) impl derives feed tokens from secret+
  listing_id rather than a per-listing `ical_export_token` column (AGENT_RULES
  §2.6) — reconcile spec vs impl (per-feed rotation isn't possible today).
- [✅] 11. Bookings board + detail — `/dashboard/bookings`. Audited CLEAN, no
  changes: status transitions are auth-gated + ownership-checked Server Actions
  using the AFTER-UPDATE-OF-status pattern (triggers fire), optimistic-concurrency
  guard on status; reads host-scoped + guest embed FK-pinned; balance derived from
  COMPLETED payments (`sumPaidFromRows`), never the stale column; no `any`/logs;
  keydown listener cleaned up. **Founder live-check pending.**
- [⚠️] 12. Manual booking — `/dashboard/bookings/new`. Audited: `createManualBooking`
  is auth-gated + listing-ownership-checked; availability enforced server-side via
  RPC; add-ons re-priced from catalog; status UPDATE fires triggers (confirmed
  writes blocks directly since INSERT won't); prefill params validated; no `any`/
  logs; Zod both sides. **Deliberately NOT changed:** the server trusts the host's
  entered nightly/cleaning amounts — for a HOST booking their OWN listing this is
  correct (comps/discounts), not the guest-checkout "never trust client price"
  case. **Founder live-check pending.**
- [⚠️] 13. Quotes — `/dashboard/quotes`. Audited CLEAN: all host mutations
  ownership-checked (`assertOwnership`), public accept/decline token-gated +
  status-rechecked; totals computed server-side (host-entered custom prices are
  by-design); convert reuses the canonical pending→confirmed trigger path;
  per-business numbering + PDF/public business resolution intact; no `any`/logs;
  RHF+Zod. **Hardening note (not fixed — low real risk):** public token pages
  compare `accept_token` with `!==` rather than a constant-time compare; the
  better pattern (used by invoices) is to query BY token. Revisit if tightening.
  **Founder live-check pending.**
- [⚠️] 14. Payments — `/dashboard/payments`. Audited CLEAN on the criticals:
  card charges use the HOST's own Paystack (`getHostPaystack`), never the platform
  key; webhook is HMAC-verified + idempotent on `provider_reference`; ledger maths
  all via `lib/payments/ledger.ts` (balance = COMPLETED inbound only); service-role
  server-only. **FIXED:** deleted a leftover `/debug-analytics` page that printed
  env-var presence + the service-role key's length + RPC output to ANY logged-in
  user (auth-gated, not admin-gated). POLISH (Deno edge fn, left): the Paystack
  webhook re-declares INBOUND + rounds without `round2`'s EPSILON — minor drift
  risk vs the TS ledger. **Founder live-check pending.**
- [⚠️] 15. Refunds — `/dashboard/refunds`. Audited: host actions ownership-checked,
  amounts clamped server-side (≤ requested / ≤ total), status history append-only,
  voided refunds excluded from the live ledger, force-dynamic, no `any`/logs.
  **FIXED:** `actioned_by` was never set on approve/decline/host-initiated → the
  status-history trail lost the actor; now set to `host.userId`. **Documented
  follow-ups (need a migration / not yet reachable — deliberately not rushed):**
  (a) `approveRefundAction`/`declineRefundAction` accept `status='escalated'` but
  RLS `host_action_refunds` only permits pending/failed updates — reconcile when
  escalation is built; (b) `lib/email/resolvers/refund.ts` queries a deprecated
  `refunds` table (latent — email worker not live; needs column remap to
  `refund_requests`); (c) voiding a completed refund doesn't reverse
  `payments.refunded_amount`. **Founder live-check pending.**
- [✅] 16. Invoices — `/dashboard/invoices`. Audited CLEAN, no changes: generation
  is trigger/server-only; public page + PDF token-gated (`hosted_token`) +
  force-dynamic, no cross-host leak; per-business snapshot (identity + banking) +
  per-business numbering intact; amounts from canonical stored totals; add-on
  invoices re-price from catalog; INSERT-only invariants respected. Only a benign
  `as unknown as` embed cast (POLISH). **Founder live-check pending.**
- [✅] 17. Inbox + templates — `/dashboard/inbox`. Audited CLEAN: Realtime subs
  cleaned up on unmount; id-space correct (conversations.host_id=hosts.id,
  messages.sender_id=user_profiles.id); all mutations auth-gated + ownership-checked
  (assertConversationOwnership/assertTemplateOwnership); embeds FK-pinned; no
  attachment upload through a Server Action; templates are literal placeholders
  (no injection). **Founder live-check pending.**
- [⚠️] 18. Notifications — `/dashboard/notifications`. Audited: page reads correctly
  `user_id`-scoped (post the portal fix), RLS owner-only, force-dynamic, subs
  cleaned up. **FIXED:** deleted dead `lib/notifications/enqueue.ts` (zero callers,
  incomplete — the real path is `dispatchEvent`). **Noted (not fixed):** the two
  Realtime subscriptions (NotificationsList, useNotifications) don't pass a
  `filter: user_id=eq.…` — RLS already scopes Realtime so it's not a leak, just an
  efficiency/clarity POLISH; and mark-read could add `.eq("user_id",…)` for
  defense-in-depth (RLS already blocks). **Founder live-check pending.**
- [✅] 19. Reviews — `/dashboard/reviews`. Audited CLEAN: hosts can only respond/
  flag (`protect_review_content` makes rating/body immutable); **the on_review_published
  trigger DOES bump hosts/listings avg_rating + total_reviews (resolves the old
  caveat — fires on publish INSERT and the is_published UPDATE)**; one review per
  booking (UNIQUE); photo signed-uploads scoped to the booking folder, no
  Server-Action body upload; RLS public=published-only. **Founder live-check pending.**
- [⚠️] 20. Staff — `/dashboard/staff`. Audited: all mutations `requireHost()`
  (OWNER only — staff can't escalate); tokens `gen_random_bytes(32)`, expiring,
  single-use; accept verifies email match; seat limit via `check_feature_permission`;
  RLS owner-manages/staff-read-own. **FIXED:** the invite email linked to
  `/invite/{token}` (404) — corrected to the real `/staff/accept/{token}` route.
  **Noted (deferred email system, not a code bug):** `inviteStaffAction` doesn't
  dispatch the email yet (host shares the copyable invite link from the page);
  wire when the notification/email worker goes live. **Founder live-check pending.**
- [⬜] 21. Help center — `/dashboard/help/*`
- [⬜] 22. Settings hub + Data/Privacy + Notification prefs — `/dashboard/settings`
- [⬜] 23. Dashboard home KPIs — `/dashboard` (last — aggregates everything)

> Stubs (confirm placeholder only, not built out): `/dashboard/reports`, `/dashboard/channels`.

## Known caveats to revisit
- Seeded published review does NOT bump `hosts.avg_rating` / `total_reviews`
  (rating trigger likely keys on a publish transition). Re-check at #19 / #23.
- 1 extra listing/rooms/addon rows exist from earlier testing under a different
  host — the demo host only sees its own 2 listings (RLS-scoped). Harmless.

---
## Static-gate baseline (2026-05-28)
- `pnpm type-check` → clean ✅
- `pnpm lint` → 1 pre-existing warning only: `app/dashboard/help/_components/PopularArticles.tsx:137`
  (`aria-pressed` on role=tab). Fix when we reach #21 Help.
- `pnpm build` → not yet run.

## Activity log (latest first)
- **2026-06-14 (cont.)** — Audited #17–#20 (parallel). #17 Inbox + #19 Reviews
  CLEAN (Reviews confirmed the avg_rating publish trigger works — old caveat
  resolved). **Fixes:** deleted dead `lib/notifications/enqueue.ts` (#18); fixed
  the Staff invite email URL `/invite/{token}` → `/staff/accept/{token}` (#20).
  Noted (not bugs / deferred): notifications Realtime user_id filter (RLS already
  secures it), staff invite-email dispatch (deferred email worker). tsc + build
  green. **NEXT: founder live-checks #17–#20; then #21 Help / #22 Settings hub +
  Data/Privacy + Notification prefs / #23 Dashboard home KPIs (last).**
- **2026-06-14 (escalation removal)** — Removed the refund escalation feature
  end-to-end (cron, status, email/notification/template, UI, copy) — commit
  `0f40e4d`, migration `20260614000001`. Also set `ICAL_TOKEN_SECRET` on Vercel
  (all 3 envs) via the REST API; installed Doppler CLI.
- **2026-06-14 (follow-ups, walked through with founder)** — Fixed the three
  documented items. (1) Refund email resolver now reads `refund_requests` (was a
  non-existent `refunds` table) with requested/approved amount mapping. (2)
  Refund approve/decline aligned to RLS (`pending`/`failed`); dropped the moot
  `escalated` branch — **clarified: Vilo never holds funds (direct host↔guest
  payments/refunds), so platform escalation/adjudication is meaningless.** Fuller
  escalation removal (guest-escalate flow, admin dispute queue,
  `refund_escalated_admin` email, refunds page.tsx tab, status enum) is a tracked
  follow-up. (3) iCal `secret()` now requires `ICAL_TOKEN_SECRET` (no service-role
  fallback); documented in ENV_VARS.md; founder set it in Doppler dev + local.
  All green (tsc + eslint + build). **Remaining iCal caveat:** per-listing
  `ical_export_token` column vs AGENT_RULES §2.6 (per-feed rotation) — deferred.
  **Refund caveat still open:** voiding a completed refund doesn't reverse
  `payments.refunded_amount`. **NEXT: founder live-checks #9–#16; then audit #17
  Inbox / #18 Notifications / #19 Reviews / #20 Staff.**
- **2026-06-14 (cont.)** — Audited the finance batch #13–#16 (parallel). #16 Invoices
  CLEAN; #13 Quotes clean (timing-safe-token noted, not a real-world risk). **Fixes:**
  deleted the leftover `/debug-analytics` page (#14 — leaked service-role key length
  to any logged-in user); set refund `actioned_by` on approve/decline/host-initiated
  (#15). Documented (not rushed): refund escalated-vs-RLS mismatch, the email
  resolver's deprecated `refunds`-table query, and voided-refund refunded_amount
  reversal — all need a migration or aren't yet reachable. Clean `pnpm build` +
  tsc + eslint. **NEXT: founder live-checks #9–#16, then audit #17 Inbox / #18
  Notifications / #19 Reviews / #20 Staff.**
- **2026-06-14** — Audited #9–#12 (parallel read-only audits). #11 Bookings CLEAN.
  #9 Calendar clean (verified the suspected `nightsBetween` timezone bug is a
  false alarm — UTC-consistent). #12 Manual booking clean (host-entered prices are
  by-design, not the guest-checkout vuln). **Fixed one real BLOCKER in #10 iCal:**
  `removeIcalFeedAction` now checks feed ownership (RLS client) BEFORE the admin
  `blocked_dates` delete — previously a host could wipe another host's ical blocks
  by passing their feedId. Static gate green (tsc + eslint). Logged iCal ops/spec
  caveats (ICAL_TOKEN_SECRET doc/fallback; ical_export_token spec gap) for founder.
  **NEXT: founder live-checks #9–#12, then I audit #13 Quotes / #14 Payments / #16
  Invoices (finance batch I now know well from the ledger work).**
- **2026-06-04** — Feature #1 wrap-up: the `feat/setup-wizard-rework` branch was already
  fully merged into `main` (0 commits ahead), so the stale remote branch was deleted — no
  merge needed, nothing reverted. Audited feature #2 (Host profile, at `/dashboard/settings`):
  code is sound; fixed two concrete issues in small commits — the `viloplatform.com` handle
  hint (`1bfe568`) and the 8MB-client/5MB-server avatar limit mismatch → 4MB both sides under
  the Vercel body cap (`8194853`). Then audited #3 Banking — clean, no changes needed (secrets
  encrypted + server-only, all 12 actions auth-gated, logo resizes client-side before upload).
  **NEXT: founder live-checks Host profile + Banking, then #4 Subscription.**
- **2026-06-04 (cont.)** — Audited #4 Subscription & billing — code clean (switch/cancel/
  reactivate actions auth-gated + Zod + RLS, no `any`/logs; PlanPicker checks are switcher UX).
  Only gap is real provider billing, stubbed pre-MVP — a launch-blocker, not a bug. No code
  changes. **NEXT: founder live-checks #2/#3/#4, then #5 Listings.**
- **2026-06-04 (cont.)** — Audited #5 Listings — high-risk surfaces clean: 20 edit actions
  auth-gated, photos use direct browser→Storage uploads, publish gate enforces EFT + completion
  (app + DB trigger). Removed the dead `uploadListingPhotoAction` body-cap footgun (`cfd0e64`).
  **NEXT: founder live-checks #2–#5, then #6 Rooms.**
- **2026-06-04 (cont.)** — Audited #6 Rooms (`/dashboard/rooms`) — clean, no changes: mutation
  via the auth-gated `setBookingModeAction`, page reads explicitly `host_id`-scoped. **NEXT:
  founder live-checks #2–#6, then #7 Seasonal pricing.**
- **2026-06-04 (cont.)** — Audited #7 Seasonal pricing — clean, no changes (gold-standard:
  real `check_feature_permission` gate, seeded for free, thorough ownership + Zod). **NEXT:
  founder live-checks #2–#7, then #8 Add-ons.**
- **2026-06-04 (cont.)** — Audited #8 Add-ons. Fixed the add-on image upload body-cap footgun
  (no client guard + 8MB server → 4MB both sides, `43b471f`) — 3rd instance of this pattern.
  Rest clean (auth-gated, host-scoped, Zod). **NEXT: founder live-checks #2–#8, then #9 Calendar.**
- **2026-05-29 (setup redesign):** Decoded the real `Setup Flow (standalone).html`
  mockup (web-archive: gzip+base64 JSX resources extracted via Node) and rebuilt
  `/dashboard/setup` to match: single-scroll page, sticky left ProgressRail (% bar +
  section list + Publish), page intro + circular % ring, stacked SectionCards with
  scroll-spy glow, and a **live browser-frame preview** (desktop/mobile) of the public
  listing. Publish → confetti (Groot Baas Wollie likes it — keep) + "You're live" modal.
  New `SetupPreview.tsx`; `SetupWizard.tsx` rebuilt; removed `StepReview.tsx`. Tokens:
  peek shadow (tailwind), focus-ring + pick-card (globals). On `origin/main` (6a50d82),
  deploying. Step-card INTERNALS still use existing styling (offer pick-cards / capacity
  steppers / amenity chips not yet pixel-matched to mockup) — possible follow-up polish.

- **2026-05-28** — Built + verified the idempotent demo seed (Step 0: triggers fire,
  no counter inflation). Established static-gate baseline (type-check clean, 1 lint
  warning in Help). Audited feature #1 (Onboarding) — no blockers, flow completes;
  corrected flow understanding (5 steps, no payment step); 2 minor bugs logged.
  **NEXT: founder live-checks Onboarding in browser** (fresh signup → walk wizard).
  App code unchanged so far except `seed:demo` script + `scripts/seed-demo.mjs`.
- **2026-05-29** — Fixed avatar-upload hang in `StepProfile.tsx` (try/finally + 8 MB /
  image-type guard + input reset). Branch-code finding was a false positive; no change.
- **2026-05-29 (later)** — Onboarding rework COMPLETE in code (1a–1e). 1a/1d/1b pushed to
  `origin/main`. A concurrent `feat/policy-manager` track collided in the shared worktree;
  per founder, published it to main (a3fb60d). Resumed 1c/1e on branch
  `feat/setup-wizard-rework` (off integrated tip, pushed). 1c = wizard shell redesign +
  `globals.css` setup utilities; 1e = StepReview guest-preview + per-section Edit + confetti.
  All green (clean-cache build). **NEXT: founder live-checks the whole wizard, then merge
  `feat/setup-wizard-rework` → main and mark #1 ✅.**
- **2026-05-29 (wizard rework, approved plan):** Building feature #1 rework in increments.
  DONE so far (all build+lint+type-check clean):
  • **1a Shared completion** — new `lib/setup/completion.ts`; rewired both
    `SetupWizard.computeInitialDone` AND `lib/help/queries.ts fetchGettingStartedState`.
    Fixes the "incomplete after publish" bug (policies now needs cancellation_policy +
    check-in + check-out; photos & rooms now counted; experiences skip check-in/out).
  • **1d WYSIWYG About** — added rich-text About field to StepListing (reuses
    `RichTextEditor`); folded its save into the renamed "Save details" button (one fewer
    button). `saveListingPatchAction` now sanitises description on input (sanitiseListingHtml).
    Added `description` to Listing type + setup page fetch.
  • **1d Banking reveal** — setup page now passes full decrypted account number + swift_code;
    StepBanking card shows holder/bank/number(masked+eye-reveal)/branch/SWIFT in full.
    BankAccount type swapped account_last4 → account_number + swift_code. ADR-009 added.
  REMAINING for #1: 1b (full RoomEditor in a sheet — create-first flow), 1c (wizard shell
  redesign: dark hero, progress ring/stepper, dotgrid, confetti, one-save-per-step, globals CSS),
  1e (visitor-style review preview with per-section Edit; remove plan card).
  **NEXT:** founder can live-check 1a/1d now (About field saves+renders; banking card shows
  full details w/ reveal; dashboard checklist completes after publish). Then I continue 1b/1c/1e.
