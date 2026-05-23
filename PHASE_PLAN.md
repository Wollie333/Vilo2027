# Vilo Platform — Phase Plan

**Version:** 1.3 (parallel-track section added 2026-05-23)
**Last Updated:** May 2026
**Current Phase:** Phase 0 closed out 2026-05-23. **Phase 1 — Foundation** is next.
**Status key:** ✅ Done · 🔄 In progress · ⬜ Not started · 👤 User action required · 🕑 Deferred-by-design (wire just-in-time)

> This is the single source of truth for build order. Update checkboxes as tasks complete. When a phase finishes, add a `CHANGELOG.md` entry and update "Current Phase" above.

---

## Parallel Execution Tracks

**Purpose:** Allow multiple Claude Code agents to work on Vilo at the same time without colliding on files or duplicating work. Each track owns a **disjoint set of file paths**; agents must stay strictly inside their track's owned paths.

> **Before any agent picks up work from this phase plan, it must first identify which track it belongs to and confirm the scope is inside that track's owned paths.** If the task crosses tracks, stop and ask the user.

### Rules of engagement

1. **One agent per track per session.** Two agents must never run inside the same track at the same time.
2. **Stay inside owned paths.** If a task needs to edit a file outside the track's ownership list, stop and ask the user — never silently expand scope across tracks.
3. **Branch per session.** Each parallel session works on a branch named `track/<n>-<short-slug>` (e.g. `track/3-ical-feeds-migration`) and merges to `main` via PR. Track 1 (main line) may push directly to `main` when no parallel sessions are open.
4. **Pull before you start.** Every parallel session begins with `git checkout main && git pull && git checkout -b track/<n>-…`.
5. **Per-track task file.** Track 1 owns the canonical `CURRENT_TASK.md`. Other tracks use `CURRENT_TASK.track-<n>.md` at the repo root and reset it at the start of each session.
6. **Append-only `CHANGELOG.md`.** Each track appends its own dated entry. Never rewrite another track's entry.

### Shared zones (paths any track may need to touch)

| Path | Coordination rule |
|------|-------------------|
| `supabase/migrations/` | New migration files only. Two tracks may add migrations in parallel; if they touch the same table, the second-to-merge rebases and re-timestamps. |
| `packages/types/database.types.ts` | Regenerated **in the same commit as the migration that changed the schema**, by the track that wrote the migration. Other tracks `git pull --rebase` before continuing. |
| `packages/schemas/` | Each track owns a sub-folder (e.g. `packages/schemas/booking/`). Never edit another track's schemas. |
| `packages/utils/` | Same rule as schemas — track-owned sub-folders. |
| `CHANGELOG.md` | Append-only per track. |
| `CLAUDE.md`, `RULES.md`, `AGENT_RULES.md`, `CONVENTIONS.md`, `ARCHITECTURE.md`, `DEVSTACK.md`, `ENV_VARS.md`, `PHASE_PLAN.md` (this file) | User-edited only. Agents propose changes in conversation; user accepts. |

### Track definitions

#### Track 1 — Main Line (Foundation → Booking → Host Tools)
The critical path. Owns the host-facing app and core booking engine. This is the largest track.

**Owns (file paths):**
- `apps/web/app/(auth)/` *(complete through Phase 1 slice 3)*
- `apps/web/app/(onboarding)/` (to be created)
- `apps/web/app/dashboard/` **except** `dashboard/listings/[id]/calendar/` (Track 3)
- `apps/web/middleware.ts`
- `apps/web/lib/supabase/`
- `supabase/functions/booking-*`, `host-*`, `subscription-*`, `policy-*`, `review-*`, `paystack-*`, `paypal-*`, `eft-*`, `refund-*`, `register-push-token`

**Owns in phase plan:** Phase 1 Auth & Users · Host Onboarding Wizard · Listing Editor · Phase 2 Booking Flow · Paystack · PayPal · Manual EFT · Host Booking Dashboard · Availability Calendar · Policy Manager · Free Tier Enforcement · Experience Listing · Phase 3 Inbox · Reviews · Subscriptions · Policy Manager · Phase 4 Refund Manager.

**Next step:** Host onboarding wizard (Phase 1 §Host Onboarding Wizard).

**Depends on:** Nothing. **Blocks:** Track 4 needs a published listing schema before it can wire real data.

---

#### Track 2 — Email Templates
Pure React Email components — no runtime collisions with any other track.

**Owns:**
- `emails/` (entire workspace except `package.json`, which all tracks read but only Track 2 edits)
- Template implementations for every entry in `EMAIL_TEMPLATES.md`

**Owns in phase plan:** Every "Email Templates — Phase N" sub-section across Phase 1–4.

**Next step:** Build the Phase 1 + Phase 2 templates per `EMAIL_TEMPLATES.md`. Edge Functions on Track 1 reference templates by name; missing templates only fail at runtime, not build.

**Depends on:** Nothing — layout component already scaffolded.

---

#### Track 3 — Booking Sync (iCal)
Self-contained Phase 2 module. Carves one route out of Track 1's dashboard.

**Owns:**
- `supabase/functions/ical-import/`
- `supabase/functions/ical-export/`
- `supabase/functions/ical-sync-all/`
- `apps/web/app/dashboard/listings/[id]/calendar/` (carved out of Track 1)
- New migration: `ical_feeds` table + `packages/schemas/ical/`
- `apps/mobile/src/app/calendar-sync/` (mobile counterpart)
- `BOOKING_SYNC.md` updates

**Owns in phase plan:** Phase 2 Booking Sync (iCal / External Calendars).

**Next step:** Write the `ical_feeds` migration and scaffold the two Edge Functions per `BOOKING_SYNC.md`. UI tab can scaffold against a stub listing ID until Track 1's listing editor lands.

**Depends on:** Track 1 finishing the listing editor before the calendar tab plugs into a real listing context. Edge Functions and migration are independent and can ship first.

---

#### Track 4 — Public Directory & Listing Detail
Guest-facing surface. Lives in a separate URL space from Track 1's `/dashboard`.

**Owns:**
- `apps/web/app/explore/`
- `apps/web/app/listing/[id]/`
- `apps/web/app/[handle]/` (host public profile)
- `supabase/functions/directory-*`
- `supabase/functions/listing-detail/`
- `supabase/functions/host-profile/`
- `supabase/functions/pricing-preview/`
- `apps/web/app/_components/directory/` (new sub-folder for directory-only components)

**Owns in phase plan:** Phase 2 Vilo Directory · Listing Detail Page · Host Public Profile Page.

**Next step:** Scaffold `/explore` UI with mock data and write the `directory-search` Edge Function shell. Swap mocks for real data once Track 1 ships the listing editor.

**Depends on:** Track 1 publishing the listing schema and producing at least one published listing for end-to-end testing. UI shells build in parallel against mocks until then.

---

#### Track 5 — Legal & Marketing Polish
Static content and marketing-site additions.

**Owns:**
- `apps/web/app/privacy/`
- `apps/web/app/terms/`
- `apps/web/app/cookies/`
- `apps/web/app/help/`, `about/`, `contact/` (if added)
- `apps/web/app/_components/home/` — **refinements only**, do not delete components that Track 1 or Track 4 already imports

**Owns in phase plan:** Phase 5 Legal & Compliance · marketing-site upkeep.

**Next step:** Ship `/privacy` and `/terms` pages — footer links to them currently 404. Cookie consent banner follows.

**Depends on:** Nothing.

---

#### Track 6 — Mobile App (Expo)
Separate workspace, separate package boundary.

**Owns:**
- `apps/mobile/` **except** `apps/mobile/src/app/calendar-sync/` (Track 3)

**Owns in phase plan:** Phase 0 NativeWind wiring · Phase 4 React Native Mobile App (entire section).

**Next step:** Finish NativeWind wiring (Phase 0 ⬜), then mirror the web auth UI in mobile screens.

**Depends on:** Track 1 for the Server Action / Edge Function API surface — mobile calls the same Edge Functions, so contract changes on Track 1 propagate here. Pull `database.types.ts` after every Track 1 schema change.

---

### Allocation guidance (which tracks to run together)

| Setup | Recommended tracks | Rationale |
|-------|-------------------|-----------|
| 1 worker | Track 1 | Critical path only — fastest single-thread progress. |
| 1 main + 1 parallel | Track 1 + Track 2 | Emails are pure components, zero collision risk. |
| 1 main + 2 parallel | Track 1 + Track 2 + Track 5 | Adds legal pages — also zero collision with Track 1. |
| 1 main + 3 parallel | Track 1 + Track 2 + Track 3 + Track 5 | Adds iCal sync — touches its own Edge Functions + one carved-out dashboard route. |
| Aggressive (all tracks) | 1 + 2 + 3 + 4 + 5 + 6 | Requires a **daily sync** where the user merges all open PRs, regenerates `database.types.ts`, and resolves any shared-zone conflicts before tracks pull and continue. |

### When a track must cross into another's territory

Stop. Surface it to the user. Options in order of preference:
1. Hand the cross-cutting change to the owning track to do in its next session.
2. Pair-handoff: this track writes a stub or interface, the owning track fills it in.
3. User permits a one-time encroachment, documented in the PR description.

Never silently edit another track's owned paths.

---

## Phase 0 — Pre-Build Setup
**Goal:** Everything scaffolded and configured before a single feature line is written.

### Infrastructure
- ✅ Create Supabase project (single project `Vilo2027`/`zlcivjgvtyeaszikqleu` in Frankfurt — staging deferred, see ADR-015)
- ✅ Link Supabase CLI to project
- ✅ Create GitHub repository (`Wollie333/Vilo2027`, private)
- ✅ Set up monorepo structure (`apps/web` + `packages/types`; `apps/mobile` pending)
- ✅ Configure `pnpm-workspace.yaml` and `turbo.json`
- ✅ Set up Doppler — project `vilo2027` with `dev`/`stg`/`prd` configs, 21 secrets imported. Vercel + Supabase integrations connected. **Known gap (accepted):** only the `dev`→Vercel Development sync exists; `stg`→Preview and `prd`→Production are blocked by the Developer (free) plan's one-sync-per-integration limit. All configs hold identical values per ADR-015, so impact is nil until staging/production diverge.
- ✅ Create `.env.example` from `ENV_VARS.md` template
- ✅ Configure Vercel project — live at https://vilo2027.vercel.app/ (Root Directory `apps/web`, env vars synced from Doppler `dev`, `vercel.json` framework pin per ADR-017)
- ✅ Create Expo EAS project — UUID `50664ed2-d876-4edd-aab0-6a984fbdfca7` linked in `apps/mobile/app.json`; slug updated to `vilo2027` to match
- 🕑 Sentry projects (web + mobile) — **deferred** to the week before public launch. No users = no errors to capture. Placeholder env var `NEXT_PUBLIC_SENTRY_DSN` lives in Doppler.
- 🕑 PostHog project — **deferred** to the week before public launch. No users = no analytics. Placeholders `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` live in Doppler.

### Next.js Web App
- ✅ Bootstrap with `create-next-app` (TypeScript, Tailwind, App Router)
- ✅ Install web dependencies (core set — Mapbox/Tiptap/etc. installed when first needed)
- ✅ Configure `tailwind.config.ts` with Vilo brand tokens
- ✅ Initialise shadcn/ui (`components.json` + `lib/utils.ts` written; component installs ongoing)
- ✅ Add shadcn/ui components — 18 installed (button, input, card, label, badge, skeleton, form, dialog, sonner, separator, avatar, alert, tabs, select, checkbox, textarea, dropdown-menu, sheet)
- ✅ Set up TypeScript path aliases (`@/*`)
- ✅ Configure ESLint + Prettier + Husky + Commitlint
- ✅ Configure Supabase SSR client (`lib/supabase/client.ts`, `server.ts`, `middleware.ts`)

### Expo Mobile App
- ✅ Bootstrap with `create-expo-app` (Expo SDK 56, TypeScript, Expo Router included by default)
- ✅ Install mobile dependencies (`@supabase/supabase-js`, `expo-secure-store`, `react-native-url-polyfill`, `@tanstack/react-query`, `zustand`)
- ⬜ Configure NativeWind + Tailwind (metro/babel/global.css wiring — deferred to first UI session)
- ✅ Configure Expo Router (included in `default` template — file-based routing in `src/app/`)
- ✅ Configure EAS build profiles (`eas.json` — development / preview / production)
- ✅ Configure Supabase client with Expo SecureStore adapter (`src/lib/supabase.ts`)

### Database
- ✅ Apply all migrations (000000 → 000017) from `supabase_database.md`
- ✅ Apply v1.1 migrations (Refund Manager + Policy Manager — 9 files written, all applied)
- ✅ Seed `platform_settings` and `plan_features`
- ✅ Seed default policy templates
- ✅ Generate TypeScript types: `packages/types/database.types.ts` (3479 lines)
- ⬜ Verify all RLS policies apply correctly in Supabase Studio (user verification step)
- ✅ Create 6 Storage buckets — all live (`listing-photos`, `host-avatars`, `host-covers` public; `eft-proofs`, `message-attachments`, `refund-requests` private); MIME types and size limits per `supabase_database.md` §17.

### CI/CD
- ✅ Create GitHub Actions workflows: `ci.yml`, `deploy-web.yml`, `deploy-functions.yml`, `db-migrate.yml`, `mobile-preview.yml`
- 🕑 Connect Doppler → GitHub Secrets integration — deferred (CI workflows not yet running end-to-end; wire when first workflow needs real secrets)
- ✅ Connect Doppler → Vercel integration (one sync active; see "Set up Doppler" note above for plan-limit gap)
- ✅ Verify first deployment to Vercel succeeds — live at https://vilo2027.vercel.app/

### Email
- 🕑 Set up Resend account + verify `viloplatform.com` domain — **deferred**, domain not yet registered. Supabase Auth's built-in email templates handle verification + password reset for Phase 1. Wire Resend when the first branded transactional email (booking confirmation, welcome) is built.
- ✅ Create `emails/` directory with React Email setup (as `@vilo/emails` workspace package)
- ✅ Create email layout component (`emails/components/Layout.tsx` with Vilo brand colours + Inter font)
- ⬜ Verify preview server works (`pnpm --filter @vilo/emails dev`) — requires user verification
- ✅ Sample template scaffolded: `emails/templates/WelcomeHost.tsx` (one of 26 from `EMAIL_TEMPLATES.md`)

---

## Phase 1 — Foundation
**Goal:** Auth working, first listing creatable, host dashboard shell live.
**Weeks:** 1–3

### Auth & Users
- ⬜ Sign-up flow (email + password)
- ⬜ Google OAuth integration
- ⬜ Email verification flow
- ⬜ Login / logout
- ⬜ Password reset via email
- ⬜ Magic link login
- ⬜ `user_profiles` auto-create trigger (`handle_new_user`)
- ⬜ JWT custom claims hook (inject `user_role`)
- ⬜ Auth middleware (`middleware.ts`) — route protection by role
- ⬜ Guest account creation flow (`/register`)
- ⬜ Host sign-up flow (`/signup/host`)

### Host Onboarding Wizard
- ⬜ Step 1: Personal details
- ⬜ Step 2: Property/experience type selection
- ⬜ Step 3: Create first listing (basic info, draft only)
- ⬜ Step 4: Plan selection (Free → pay nothing, Paid → subscription)
- ⬜ Step 5: Welcome screen + dashboard redirect
- ⬜ `hosts` row creation with auto-generated handle
- ⬜ `subscriptions` row creation (Free: no payment, Paid: Paystack/PayPal)

### Listing Editor (Accommodation — Basic)
- ⬜ Basic info tab (name, type, description with Tiptap)
- ⬜ Photos tab (drag-and-drop upload → Supabase Storage)
- ⬜ Location tab (address + Mapbox pin)
- ⬜ Rooms & capacity tab
- ⬜ Amenities tab
- ⬜ Pricing tab (base rate, weekend rate, cleaning fee)
- ⬜ Policies tab (check-in/out time, house rules, cancellation policy)
- ⬜ Booking settings tab (instant booking toggle, payment methods)
- ⬜ Publish listing (`is_published = true`)
- ⬜ Auto-generate listing slug (trigger)
- ⬜ Auto-generate PostGIS location from lat/lng (trigger)

### Email Templates — Phase 1
- ⬜ Email layout base component (shared header + footer)
- ⬜ `email-verification` (Supabase Auth built-in — configure template)
- ⬜ `password-reset` (Supabase Auth built-in — configure template)

---

## Phase 2 — Core Booking
**Goal:** Guests can find, view, and book listings. Payments processed.
**Weeks:** 4–6

### Vilo Directory
- ⬜ `/explore` search page (full-text + filters + sort)
- ⬜ Directory listing card component
- ⬜ Map view (web: Mapbox GL JS + `react-map-gl`)
- ⬜ Filters panel (type, dates, guests, price, amenities, instant book)
- ⬜ `directory-search` Edge Function
- ⬜ `directory-featured` Edge Function
- ⬜ `directory-nearby` Edge Function
- ⬜ `listing-detail` Edge Function
- ⬜ `host-profile` Edge Function
- ⬜ `listing_rankings` cache + `recalculate_listing_ranking` pg_cron job
- ⬜ `directory_search_logs` inserts

### Listing Detail Page
- ⬜ Photo gallery + lightbox
- ⬜ Price breakdown calculator (`pricing-preview` Edge Function)
- ⬜ Availability calendar (read-only, `availability` Edge Function)
- ⬜ Reviews section (read-only)
- ⬜ Host profile snippet
- ⬜ Share button + QR code (`qrcode.react`)
- ⬜ Map with approximate location

### Host Public Profile Page
- ⬜ `viloplatform.com/[handle]` — all published listings, bio, reviews
- ⬜ Handle redirect (old → new on handle change)

### Booking Flow
- ⬜ Booking summary page (`/listing/[id]/book`)
- ⬜ Payment method selection (Paystack / PayPal / EFT)
- ⬜ `booking-create` Edge Function (validate, price-check, create record, init payment)
- ⬜ Policy acknowledgement checkbox + `policy_acknowledged` field
- ⬜ `snapshot_booking_policies` called at booking creation

### Paystack Integration
- ⬜ Initialize transaction (guest card payment)
- ⬜ Paystack Popup / redirect
- ⬜ `/webhooks/paystack` Edge Function (signature verify, update payment + booking)
- ⬜ `booking/[id]/success` and `booking/[id]/failed` pages
- ⬜ Idempotency check on `provider_reference`

### PayPal Integration
- ⬜ `@paypal/react-paypal-js` SDK setup
- ⬜ Create Order (intent: CAPTURE for instant, AUTHORIZE for request-to-book)
- ⬜ Capture / Void authorization
- ⬜ `/webhooks/paypal` Edge Function (signature verify, update payment + booking)

### Manual EFT Flow
- ⬜ EFT booking creation (`status = pending_eft`)
- ⬜ Banking details display (from `eft_banking_details`)
- ⬜ Proof of payment upload (`eft-proof-upload` Edge Function)
- ⬜ 48-hour expiry cron job
- ⬜ Host confirmation flow

### Host Booking Dashboard
- ⬜ Booking list (filter by status, date, listing)
- ⬜ Booking detail panel
- ⬜ Confirm / Decline / Cancel actions
- ⬜ Mark Check-In / Check-Out
- ⬜ `booking-confirm` Edge Function
- ⬜ `booking-cancel` Edge Function
- ⬜ 24-hour auto-cancel cron job (no host response)

### Availability Calendar (Host)
- ⬜ Monthly view (`react-big-calendar`)
- ⬜ Colour-coded bookings (confirmed/pending/blocked)
- ⬜ Drag-to-block dates
- ⬜ Unblock dates
- ⬜ `blocked_dates` insert/delete

### Policy Manager — Phase 2
- ⬜ Policy Library UI (`/dashboard/settings/policies`)
- ⬜ Cancellation Policy Builder (visual rule editor + presets)
- ⬜ Booking Terms editor (Tiptap)
- ⬜ Privacy Policy editor (editable default template)
- ⬜ `policy-create` Edge Function
- ⬜ `policy-update` Edge Function (increments version)
- ⬜ `policy-assign` Edge Function
- ⬜ Policy assignment in listing editor (Policies tab)
- ⬜ Policy display on listing detail page (guest-facing)

### Experience Listing
- ⬜ Experience listing editor (schedule, duration, participants, meeting point)
- ⬜ Experience booking flow (session date selection)

### Booking Sync (iCal / External Calendars)
- ⬜ `ical_feeds` table migration
- ⬜ iCal export: generate unique feed URL per listing (`/ical/[listing_id]/[token].ics`)
- ⬜ iCal import: host adds external feed URL (Airbnb, Booking.com, etc.)
- ⬜ `ical-import` Edge Function — fetch, parse, diff, block conflicting dates in `blocked_dates`
- ⬜ `ical-export` Edge Function — generate RFC 5545 compliant `.ics` feed
- ⬜ pg_cron: re-sync all active feeds every 15 minutes (`ical-sync-all`)
- ⬜ Calendar Settings UI tab in listing editor (`/dashboard/listings/[id]/calendar`)
- ⬜ Add feed form: URL input + source label (e.g. "Airbnb", "Booking.com", "Custom")
- ⬜ Feed list: show last synced time, status (active/error), date count imported
- ⬜ Feed error handling: mark feed `status = error`, notify host via dashboard alert
- ⬜ Sync conflict display: blocked dates from external feeds shown in a distinct colour on the host calendar
- ⬜ Mobile: Calendar Sync settings screen

### Free Tier Enforcement
- ⬜ `check_feature_permission` RPC integrated across UI and Edge Functions
- ⬜ Inline upgrade prompt component (not blocking modal)
- ⬜ Feature gates: `direct_booking`, `payment_*`, `instant_booking`, `calendar_management`

### Email Templates — Phase 2
- ⬜ `booking-request-host` (see `EMAIL_TEMPLATES.md`)
- ⬜ `booking-confirmed-guest`
- ⬜ `booking-confirmed-host`
- ⬜ `booking-declined-guest`
- ⬜ `eft-instructions-guest`
- ⬜ `eft-proof-received-host`

---

## Phase 3 — Inbox, Reviews & Subscriptions
**Goal:** Real-time communication working. Review system live. Subscription billing complete.
**Weeks:** 7–9

### Inbox & Messaging
- ⬜ Conversation list (host + guest views)
- ⬜ Message thread (real-time via Supabase Realtime)
- ⬜ System messages (booking status changes)
- ⬜ File attachment upload
- ⬜ Pre-booking enquiry flow
- ⬜ Enquiry → booking conversion
- ⬜ Canned replies (Pro+ feature: `message_templates`)
- ⬜ Inbox search (by guest name / keyword)
- ⬜ Mark resolved / archive
- ⬜ Unread badge (web nav + mobile tab)

### Reviews
- ⬜ Review request email (pg_cron: 24h after checkout)
- ⬜ Review submission form (token-gated link)
- ⬜ `review-submit` Edge Function
- ⬜ 48-hour auto-publish cron job
- ⬜ Host review dashboard
- ⬜ Host response (inline)
- ⬜ Flag review for moderation
- ⬜ Review aggregate recalculation (trigger: `on_review_published`)

### Subscriptions
- ⬜ Paystack Subscription plans (Basic / Pro / Business)
- ⬜ PayPal Subscription plans
- ⬜ 14-day trial logic
- ⬜ `subscription.create` webhook → activate plan
- ⬜ `invoice.payment_failed` webhook → grace period
- ⬜ Grace period (5 days) → restrict account (cron job)
- ⬜ Subscription dashboard (`/dashboard/settings/subscription`)
- ⬜ Upgrade flow (with proration)
- ⬜ Annual billing switch
- ⬜ Cancellation flow
- ⬜ `subscription_history` logging on every state change
- ⬜ `host_feature_overrides` table + admin UI

### Policy Manager — Phase 3
- ⬜ Policy snapshotting in `booking-create` (`snapshot_booking_policies`)
- ⬜ Policy included in booking confirmation email
- ⬜ Policy snapshot viewer on guest booking detail page
- ⬜ Automatic policy-based refund calculation in `booking-cancel` (`calculate_policy_refund_amount`)

### Email Templates — Phase 3
- ⬜ `booking-cancelled-host`
- ⬜ `booking-cancelled-guest`
- ⬜ `review-request-guest`
- ⬜ `new-review-host`
- ⬜ `staff-invite`
- ⬜ `subscription-welcome`
- ⬜ `subscription-expiring`
- ⬜ `subscription-failed`
- ⬜ `subscription-restricted`

---

## Phase 4 — Admin, Refunds, Mobile & Polish
**Goal:** Super admin panel complete. Refund Manager live. Mobile app functional.
**Weeks:** 10–13

### Super Admin Panel
- ⬜ Dashboard KPIs (hosts, bookings, MRR, churn)
- ⬜ Host management (view, suspend, unsuspend, impersonate)
- ⬜ Guest management (view, ban)
- ⬜ Booking management (all bookings, CSV export)
- ⬜ Payment management (all payments, manual EFT approval)
- ⬜ Review moderation queue
- ⬜ Subscription management (manual adjustments)
- ⬜ Directory controls (feature, hide, verify, ranking weights)
- ⬜ Search analytics view
- ⬜ Feature flag override per host (`host_feature_overrides`)
- ⬜ Impersonation (with audit log + session tracking)
- ⬜ `admin_audit_log` writes on every admin action
- ⬜ Platform settings editor (`platform_settings`)
- ⬜ Policy oversight + default template management

### Refund Manager
- ⬜ Refund dashboard (host: Pending / Approved / Declined / All)
- ⬜ Refund detail panel (policy entitlement calculator)
- ⬜ Host approve refund → `refund-process` Edge Function (Paystack / PayPal / EFT)
- ⬜ Host decline refund → `refund-decline` Edge Function
- ⬜ EFT manual refund (mark-as-sent)
- ⬜ Guest refund request form (`refund-request` Edge Function)
- ⬜ Guest escalation (`refund-escalate` Edge Function)
- ⬜ Admin dispute queue (`refund-admin-decision` Edge Function)
- ⬜ 72-hour auto-escalation cron job
- ⬜ Refund status history (`refund_status_history` trigger)
- ⬜ Refund notifications (all state transitions — see `EMAIL_TEMPLATES.md`)

### React Native Mobile App
- ⬜ Auth flows (login, register, Google OAuth)
- ⬜ Guest: Explore tab (directory + map view)
- ⬜ Guest: Listing detail + booking flow
- ⬜ Guest: My Bookings + booking detail
- ⬜ Guest: Inbox
- ⬜ Guest: Account settings
- ⬜ Host: Dashboard (KPIs)
- ⬜ Host: Listings (list, detail, create)
- ⬜ Host: Bookings (list, detail, confirm/decline)
- ⬜ Host: Calendar
- ⬜ Host: Inbox
- ⬜ Host: Settings + subscription
- ⬜ Push notification registration (`register-push-token` Edge Function)
- ⬜ Deep linking (`vilo://` scheme)
- ⬜ Offline graceful handling

### Testing
- ⬜ Unit tests: Zod schemas, price calculation, refund calculation (`vitest`)
- ⬜ Component tests: booking form, auth forms (`@testing-library/react`)
- ⬜ E2E: guest search → book → payment (`playwright`)
- ⬜ E2E: host sign-up → create listing → confirm booking
- ⬜ E2E: auth flows (sign-up, verify, login, logout)

### Monitoring
- ⬜ Sentry configured for web (`sentry.client.config.ts`, `sentry.server.config.ts`)
- ⬜ Sentry configured for mobile (`Sentry.init()` in `_layout.tsx`)
- ⬜ Source maps upload in CI
- ⬜ PostHog events: booking funnel, directory search, upgrade prompts, subscription conversion
- ⬜ PostHog privacy: IP anonymisation enabled

### Email Templates — Phase 4
- ⬜ `refund-request-host`
- ⬜ `refund-approved-guest`
- ⬜ `refund-declined-guest`
- ⬜ `refund-completed-guest`
- ⬜ `refund-escalated-admin`
- ⬜ `refund-admin-override-host`
- ⬜ `eft-refund-sent-guest`
- ⬜ `account-suspended`
- ⬜ `feature-override-expiring`

---

## Phase 5 — Launch Readiness
**Goal:** Secure, live, first beta hosts onboarded.
**Week:** 14

### Security Review
- ⬜ Full RLS policy audit (every table checked)
- ⬜ Webhook signature verification confirmed on Paystack + PayPal
- ⬜ `service_role` key confirmed server-side only (grep codebase)
- ⬜ EFT banking details confirmed encrypted at app layer
- ⬜ Input sanitisation audit on all Edge Function endpoints
- ⬜ Rate limiting confirmed on public directory endpoints
- ⬜ Content Security Policy headers configured in `next.config.ts`
- ⬜ No `console.log` in production builds (CI check)

### Payments Go-Live
- ⬜ Paystack live keys activated + webhook URL registered
- ⬜ PayPal live credentials activated + webhook registered
- ⬜ EFT banking details entered for test host account
- ⬜ End-to-end payment test (card, PayPal, EFT) on production

### Legal & Compliance
- ⬜ Privacy policy page (`/privacy`) — legal team content
- ⬜ Terms of service page (`/terms`) — legal team content
- ⬜ Cookie consent banner (web)
- ⬜ POPIA data deletion request flow in account settings
- ⬜ Supabase region confirmed: `af-south-1` (Cape Town) — currently provisioned in `Central EU (Frankfurt)`; migration required before launch (see `DECISIONS.md` ADR-015)

### Environment
- ⬜ Staging environment mirroring production schema
- ⬜ All environment variables in Doppler production config
- ⬜ Vercel production environment variables synced from Doppler
- ⬜ Supabase production Edge Function secrets set

### App Stores
- ⬜ App Store Connect listing created (iOS)
- ⬜ Google Play Console listing created (Android)
- ⬜ App Store screenshots + metadata
- ⬜ EAS Submit configured (`eas.json`)
- ⬜ First production build submitted (`eas build --platform all --profile production`)

### Beta Launch
- ⬜ 5–10 beta hosts onboarded manually
- ⬜ Feedback channel set up (Slack / WhatsApp group)
- ⬜ On-call process for first 2 weeks post-launch
- ⬜ Sentry alerts configured for error spikes
- ⬜ PostHog dashboards configured for key funnels

---

## Dependency Map

Some tasks cannot start until others are done. Critical path:

```
DB migrations → TypeScript types → Auth → User profiles
                                       → Host onboarding → First listing
                                                        → Subscription

First listing → Listing editor → Listing detail page → Booking flow
                               → Directory search

Booking flow → Paystack webhook → Booking confirmed → Blocked dates
             → PayPal webhook   → Booking confirmed
             → EFT flow         → Host confirmation

Booking confirmed → Inbox conversation created
                 → Policy snapshot created
                 → Cancellation → Refund calculation
```

---

## Notes on Scope

**Post-MVP (do not build):**
- Dynamic pricing / revenue management
- Multi-currency conversion
- Guest loyalty / points
- Gift vouchers / discount codes
- AI-powered inbox suggestions
- Offline mode with local data sync
- Auto-send message templates (Phase 3 is manual-only)
- Minimum participant cancellation for experiences

When a session touches something on this list, stop and confirm before proceeding.

---

*Update "Current Phase" at the top of this file when a phase completes.*
