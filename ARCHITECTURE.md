# Vilo Platform — Architecture

**Version:** 1.0
**Last Updated:** May 2026
**Companion Docs:** `wielo-platform-mvp.md`, `DEVSTACK.md`, `supabase_database.md`

---

## 1. System Overview

Wielo is a **monorepo** containing a Next.js web app, an Expo React Native mobile app, and a Supabase backend. Web and mobile share a type layer, schema layer, and utility library. The backend is entirely Supabase-managed — no custom server.

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENTS                          │
│   Next.js 14 Web App          Expo React Native App     │
│   apps/web (Vercel)           apps/mobile (EAS)         │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / WebSocket (supabase-js v2)
┌────────────────────▼────────────────────────────────────┐
│                  SUPABASE PLATFORM                       │
│  PostgREST (REST API)  ┃  Auth (JWT / OAuth)            │
│  Realtime (WebSocket)  ┃  Storage (files)               │
│  Edge Functions (Deno) ┃  pg_cron (scheduled jobs)      │
│  PostgreSQL 15 + RLS   ┃  pg_trgm + postgis             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              EXTERNAL SERVICES                          │
│  Paystack API  ┃  PayPal API  ┃  Resend (email)         │
│  Expo Push     ┃  Sentry      ┃  PostHog                │
│  Google OAuth  ┃  OSM tiles   ┃  Vercel Env (secrets)   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo Structure

```
wielo/
├── apps/
│   ├── web/                    # Next.js 14 web application
│   └── mobile/                 # Expo React Native application
├── packages/
│   ├── types/                  # Shared TypeScript types
│   │   └── database.types.ts   # Auto-generated from Supabase schema
│   ├── schemas/                # Shared Zod validation schemas
│   └── utils/                  # Shared pure utility functions
├── supabase/
│   ├── functions/              # Edge Functions (Deno)
│   ├── migrations/             # SQL migration files (ordered by timestamp)
│   └── seed.sql                # Initial seed data
├── .env.example                # Template — never commit .env.local
├── pnpm-workspace.yaml
├── turbo.json
└── package.json                # Root workspace config
```

---

## 3. Web App Structure (`apps/web`)

```
apps/web/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (fonts, providers)
│   ├── page.tsx                      # Marketing homepage
│   ├── (auth)/                       # Auth route group (no shared layout)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── callback/page.tsx         # Supabase OAuth callback
│   │   └── forgot-password/page.tsx
│   ├── (guest)/                      # Guest-facing public routes
│   │   ├── explore/
│   │   │   └── page.tsx              # Wielo Directory search page
│   │   ├── listing/
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Listing detail page
│   │   │       └── book/page.tsx     # Booking summary + payment
│   │   ├── [handle]/
│   │   │   └── page.tsx              # Host public profile
│   │   └── account/
│   │       ├── bookings/
│   │       │   ├── page.tsx          # Guest booking list
│   │       │   └── [id]/page.tsx     # Guest booking detail
│   │       └── inbox/
│   │           ├── page.tsx
│   │           └── [id]/page.tsx
│   ├── (dashboard)/                  # Host dashboard (requires auth + host role)
│   │   ├── layout.tsx                # Dashboard shell (sidebar, nav)
│   │   ├── dashboard/page.tsx        # Dashboard home / KPIs
│   │   ├── listings/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── edit/page.tsx
│   │   ├── bookings/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── inbox/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── reviews/page.tsx
│   │   ├── payments/
│   │   │   ├── page.tsx
│   │   │   └── refunds/page.tsx      # Refund Manager
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── policies/page.tsx     # Policy Library
│   │       ├── team/page.tsx
│   │       ├── payments/page.tsx
│   │       └── subscription/page.tsx
│   ├── (admin)/                      # Super Admin panel
│   │   ├── layout.tsx                # Admin shell (role guard: super_admin only)
│   │   ├── admin/page.tsx
│   │   ├── admin/hosts/[id]/page.tsx
│   │   ├── admin/bookings/page.tsx
│   │   ├── admin/payments/page.tsx
│   │   ├── admin/reviews/page.tsx
│   │   ├── admin/directory/page.tsx
│   │   └── admin/settings/page.tsx
│   └── api/                          # Next.js API Routes (minimal — prefer Edge Functions)
│       └── auth/
│           └── callback/route.ts     # Supabase auth callback handler
│
├── components/
│   ├── ui/                           # shadcn/ui generated components (do not modify)
│   ├── layout/                       # Shell components (Sidebar, Navbar, Footer)
│   ├── booking/                      # Booking domain components
│   ├── listing/                      # Listing domain components
│   ├── inbox/                        # Inbox domain components
│   ├── reviews/                      # Review domain components
│   ├── payments/                     # Payment + refund components
│   ├── policies/                     # Policy Manager components
│   ├── directory/                    # Directory search + card components
│   ├── admin/                        # Admin panel components
│   └── shared/                       # Generic reusable components
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client (singleton)
│   │   ├── server.ts                 # Server Supabase client (for Server Components)
│   │   └── middleware.ts             # Auth middleware helper
│   ├── stores/                       # Zustand stores (client state only)
│   │   ├── authStore.ts
│   │   ├── bookingStore.ts
│   │   ├── inboxStore.ts
│   │   └── subscriptionStore.ts
│   ├── actions/                      # Next.js Server Actions
│   │   ├── booking.actions.ts
│   │   ├── listing.actions.ts
│   │   ├── auth.actions.ts
│   │   └── subscription.actions.ts
│   ├── hooks/                        # React custom hooks (client only)
│   │   ├── useRealtimeInbox.ts
│   │   ├── useFeaturePermission.ts
│   │   └── useBookingStatus.ts
│   └── utils/                        # Web-specific utility functions
│
├── middleware.ts                     # Next.js middleware (auth route protection)
├── tailwind.config.ts
├── next.config.ts
└── tsconfig.json
```

---

## 4. Mobile App Structure (`apps/mobile`)

```
apps/mobile/
├── app/                              # Expo Router file-based routing
│   ├── _layout.tsx                   # Root layout (providers, fonts)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (guest)/                      # Guest tab navigator
│   │   ├── _layout.tsx               # Tab layout
│   │   ├── explore/
│   │   │   ├── index.tsx             # Directory search
│   │   │   └── [id].tsx              # Listing detail
│   │   ├── bookings/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx
│   │   ├── inbox/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx
│   │   └── account.tsx
│   └── (host)/                       # Host tab navigator
│       ├── _layout.tsx
│       ├── dashboard.tsx
│       ├── listings/
│       │   ├── index.tsx
│       │   ├── [id].tsx
│       │   └── new.tsx
│       ├── bookings/
│       │   ├── index.tsx
│       │   └── [id].tsx
│       ├── calendar.tsx
│       ├── inbox/
│       │   ├── index.tsx
│       │   └── [id].tsx
│       └── settings.tsx
│
├── components/                       # Mobile-specific components
│   ├── booking/
│   ├── listing/
│   ├── inbox/
│   └── shared/
│
├── lib/
│   ├── supabase.ts                   # Supabase client (with Expo SecureStore adapter)
│   └── hooks/
│
├── app.json
├── eas.json
└── tsconfig.json
```

---

## 5. Edge Functions Structure (`supabase/functions`)

```
supabase/functions/
├── _shared/                          # Helpers shared across all functions
│   ├── auth.ts                       # verifyJWT(), getCallerUserId()
│   ├── response.ts                   # successResponse(), errorResponse()
│   ├── supabase.ts                   # createServiceClient(), createUserClient()
│   ├── email.ts                      # sendEmail() via Resend
│   ├── push.ts                       # sendPushNotification() via Expo
│   └── permissions.ts                # checkFeaturePermission() wrapper
│
├── booking-create/index.ts           # Validate, price-check, create booking + init payment
├── booking-confirm/index.ts          # Host confirms a pending booking
├── booking-cancel/index.ts           # Cancel booking + trigger refund logic
├── eft-proof-upload/index.ts         # Upload EFT proof, notify host
├── review-submit/index.ts            # Guest submits post-stay review
├── invite-staff/index.ts             # Host invites a staff member
├── register-push-token/index.ts      # Save/remove Expo push token
├── pricing-preview/index.ts          # Price breakdown for date range
├── availability/index.ts             # Available dates for a listing
├── directory-search/index.ts         # Full-text + filter search with ranking
├── directory-featured/index.ts       # Featured listings for homepage
├── listing-detail/index.ts           # Full listing detail for public page
├── host-profile/index.ts             # Full host public profile
├── refund-request/index.ts           # Guest submits refund request
├── refund-process/index.ts           # Host approves refund (calls provider API)
├── refund-decline/index.ts           # Host declines refund
├── refund-manual-sent/index.ts       # Host marks EFT refund as sent
├── refund-escalate/index.ts          # Guest escalates to admin
├── refund-admin-decision/index.ts    # Admin forces or upholds decision
├── policy-create/index.ts            # Create new policy
├── policy-update/index.ts            # Update policy (creates new version)
├── policy-assign/index.ts            # Assign policy to a listing
├── policy-preview/index.ts           # Guest-facing policy preview
├── webhooks/
│   ├── paystack/index.ts             # Paystack webhook receiver
│   └── paypal/index.ts               # PayPal webhook receiver
└── admin/
    └── impersonate/index.ts          # Impersonation session management
```

---

## 6. Shared Packages (`packages/`)

### `packages/types`
Auto-generated Supabase database types + hand-written API types.
```
packages/types/
├── database.types.ts     # Generated: supabase gen types typescript --local
└── api.types.ts          # Hand-written: Edge Function request/response shapes
```

### `packages/schemas`
Zod validation schemas shared between web, mobile, and Edge Functions.
```
packages/schemas/
├── booking.schema.ts
├── listing.schema.ts
├── auth.schema.ts
├── review.schema.ts
└── payment.schema.ts
```

### `packages/utils`
Pure utility functions with zero dependencies on framework code.
```
packages/utils/
├── formatCurrency.ts       # formatCurrency(1800, 'ZAR') → "R 1 800,00"
├── formatDate.ts           # Consistent date display formatting
├── calculateNights.ts
├── policyRefundCalc.ts     # Policy-based refund % calculation (mirrors DB function)
└── bookingReference.ts     # Parse/validate VILO-YYYY-XXXXXX format
```

---

## 7. Supabase Client Usage Rules

| Context | Client to Use | Key Used |
|---|---|---|
| Server Component (web) | `createServerClient()` from `lib/supabase/server.ts` | `anon` key (RLS enforced) |
| Server Action (web) | `createServerClient()` from `lib/supabase/server.ts` | `anon` key (RLS enforced) |
| Client Component (web) | `createBrowserClient()` from `lib/supabase/client.ts` | `anon` key (RLS enforced) |
| Mobile app | `createClient()` with SecureStore adapter | `anon` key (RLS enforced) |
| Edge Function | `createServiceClient()` from `_shared/supabase.ts` | `service_role` key (bypasses RLS — handle carefully) |

---

## 8. Authentication Flow

```
User visits protected route
  → middleware.ts intercepts
  → Checks session via Supabase Auth
  → No session: redirect to /login
  → Session exists: check user_profiles.role
  → Wrong role for route: redirect to appropriate home

Login/Signup
  → supabase.auth.signInWithPassword() or signInWithOAuth()
  → Supabase creates/validates JWT
  → Trigger: handle_new_user() creates user_profiles row
  → Session stored: web (httpOnly cookie via @supabase/ssr), mobile (Expo SecureStore)
```

---

## 9. Realtime Architecture

Supabase Realtime is used for:
1. **Inbox** — new `messages` on a conversation thread
2. **Booking status** — updates to `bookings` in the host dashboard
3. **Conversation list** — updates to `conversations` for unread badge counts

**Client subscription pattern (web):**
```typescript
// hooks/useRealtimeInbox.ts
useEffect(() => {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      // append message to thread
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [conversationId]);
```

**Important:** Always filter Realtime subscriptions. Never subscribe to a full table without a filter — this creates unnecessary load and exposes data.

---

## 10. Data Flow — Booking Creation

```
Guest selects dates on listing page
  → /functions/v1/pricing-preview     (GET — shows price breakdown)
  → Guest clicks "Book Now"
  → /functions/v1/booking-create      (POST)
      → Validates auth (JWT)
      → Validates dates availability (race condition check)
      → Recalculates price server-side (never trust client)
      → Snapshots policies (policy_snapshots insert)
      → Creates bookings row (status: pending)
      → Creates payments row (status: pending)
      → Calls payment provider API (Paystack / PayPal / EFT)
      → Returns { booking_id, provider_redirect_url }
  → Client redirects to payment provider
  → Payment provider webhook fires
  → /functions/v1/webhooks/paystack (or paypal)
      → Verifies signature
      → Updates payments.status → completed
      → If instant_booking: updates bookings.status → confirmed
      → Trigger: blocked_dates rows inserted
      → Trigger: host + guest notified (email + push)
      → Supabase Realtime: booking status update broadcast
  → Host receives push notification
  → Guest redirected to /booking/[id]/success
```

---

*Keep this document updated when the folder structure changes. It is the map — if the map is wrong, agents get lost.*
---

## 11. CI/CD Pipelines (GitHub Actions)

Four workflow files live in `.github/workflows/`. App secrets are read directly from Vercel's Environment Variables via its native GitHub integration; GitHub Actions only holds CI-infrastructure tokens as GitHub Secrets.

### `ci.yml` — Pull Request checks (every PR)

```
Trigger: pull_request → main or develop
Steps:
  1. pnpm install
  2. supabase start (local Supabase for integration tests)
  3. supabase db push (apply migrations to local DB)
  4. pnpm build (Next.js — must pass zero errors)
  5. pnpm lint (zero warnings)
  6. pnpm test (Vitest unit + integration tests)
  7. pnpm test:e2e (Playwright E2E — auth, booking flow, listing)
  8. supabase stop
Required secrets: SUPABASE_ACCESS_TOKEN
Blocks merge: yes — all steps must pass
```

### `deploy-web.yml` — Deploy web app (push to main)

```
Trigger: push → main
Steps:
  1. pnpm install
  2. pnpm build
  3. vercel deploy --prod (via Vercel CLI + VERCEL_TOKEN)
Required secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
Note: Vercel injects env vars from its own Environment Variables store — no app secrets live in GitHub
```

### `deploy-functions.yml` — Deploy Edge Functions (push to main)

```
Trigger: push → main (only when supabase/functions/** changed)
Steps:
  1. supabase functions deploy --all (deploys every function in supabase/functions/)
Required secrets: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID
Note: Runs after deploy-web.yml — Edge Functions go live together with the web deploy
```

### `db-migrate.yml` — Run DB migrations (push to main)

```
Trigger: push → main (only when supabase/migrations/** changed)
Steps:
  1. supabase db push --db-url $SUPABASE_DB_URL
  2. supabase gen types typescript --project-id $SUPABASE_PROJECT_ID
     (regenerates types — committed back to repo via auto-commit step)
Required secrets: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID, SUPABASE_DB_URL
Order: runs BEFORE deploy-web.yml and deploy-functions.yml (schema first, then app)
```

### `mobile-preview.yml` — OTA mobile preview build (push to develop)

```
Trigger: push → develop
Steps:
  1. eas update --branch preview --message "$COMMIT_MSG"
     (sends JS bundle OTA to devices running the preview build)
Required secrets: EXPO_TOKEN
Note: Only JS changes — native code changes still require a full eas build
```

### Deployment order on push to main

```
1. db-migrate.yml     ← migrations first (schema must be ready before app)
2. deploy-functions.yml  ← Edge Functions next
3. deploy-web.yml     ← web app last (depends on functions being live)
```

All three are triggered by the same push event. Use `needs:` in GitHub Actions to enforce the order.

### Branch strategy

| Branch | Purpose | Auto-deploys to |
|---|---|---|
| `main` | Production | Vercel production + Supabase production |
| `develop` | Staging | Vercel preview + EAS OTA preview |
| `feature/*` | Feature work | Vercel preview URL (per PR) |
| `fix/*` | Bug fixes | Vercel preview URL (per PR) |
| `migration/*` | DB schema changes | No auto-deploy — merged to develop first |

