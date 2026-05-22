# Vilo

**Direct-booking management for accommodation hosts and experience operators.**

Vilo gives hosts a professional, branded booking page and a private dashboard to manage listings, bookings, guest communication, payments, and reviews — all in one place, on web and mobile. Zero booking fees. Flat subscription only.

---

## What it does

Guests discover hosts through the Vilo Directory or directly via a host's shareable profile URL (`viloplatform.com/[handle]`). They can book and pay without leaving the platform. Hosts manage everything from a single dashboard.

| For Hosts | For Guests |
|---|---|
| Branded public profile + listing page | Browse the Vilo Directory |
| Booking calendar with availability management | Request or instantly book a listing |
| Real-time inbox for all guest communication | Pay by card, PayPal, or EFT |
| Paystack, PayPal, and manual EFT payments | Manage bookings and communicate with the host |
| Subscription billing (Basic / Pro / Business) | Leave reviews after their stay |
| Staff member access | — |
| Reviews and reputation management | — |
| Calendar sync with Airbnb, Booking.com (iCal) | — |
| Policy Manager and Refund Manager | — |

---

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Mobile app | Expo SDK 51+, Expo Router, NativeWind |
| Backend | Supabase (PostgreSQL 15, Auth, Realtime, Storage, Edge Functions) |
| Payments | Paystack (ZAR), PayPal (international), Manual EFT |
| Email | Resend + React Email |
| Package manager | pnpm |
| Hosting | Vercel (web), EAS (mobile) |

---

## Project structure

```
vilo/
├── apps/
│   ├── web/          # Next.js 14 web application
│   └── mobile/       # Expo React Native app (iOS + Android)
├── packages/
│   ├── types/        # Shared TypeScript types (auto-generated from DB)
│   ├── schemas/      # Shared Zod validation schemas
│   └── utils/        # Shared utility functions
├── supabase/
│   ├── functions/    # Edge Functions (Deno)
│   ├── migrations/   # SQL migrations
│   └── seed.sql
└── emails/           # React Email templates
```

---

## Getting started

### Prerequisites

```bash
# Node.js 20 via nvm
nvm install 20 && nvm use 20

# pnpm
npm install -g pnpm@9

# Supabase CLI
brew install supabase/tap/supabase   # macOS
# or: npx supabase@latest            # any platform

# EAS CLI (mobile builds)
npm install -g eas-cli
```

### Setup

```bash
git clone git@github.com:your-org/vilo.git
cd vilo

pnpm install

cp .env.example .env.local
# Fill in values — see ENV_VARS.md
```

### Start local Supabase

```bash
supabase start         # starts PostgreSQL, Auth, Storage, Edge Functions locally
supabase db push       # apply all migrations
supabase db seed       # seed plan_features and platform_settings
```

Copy the `anon key` and `service_role key` printed by `supabase start` into `.env.local`.

### Run the web app

```bash
cd apps/web
pnpm dev
# → http://localhost:3000
```

### Run the mobile app

```bash
cd apps/mobile
pnpm start             # opens Expo Go
pnpm ios               # iOS Simulator
pnpm android           # Android Emulator
```

### Run Edge Functions locally

```bash
supabase functions serve --env-file .env.local
# → http://localhost:54321/functions/v1/[function-name]
```

---

## Key commands

```bash
# Development
pnpm dev                    # web app
pnpm start                  # mobile app
supabase start              # local Supabase
supabase status             # check what's running

# Database
supabase db push            # apply pending migrations
supabase db reset           # wipe + re-apply all migrations + seed
supabase migration new <n>  # create a new migration file
supabase gen types typescript --local > packages/types/database.types.ts

# Build & lint
pnpm build                  # build web app
pnpm lint                   # lint web app

# Mobile builds
eas build --platform ios
eas build --platform android
```

---

## Environment variables

See [`ENV_VARS.md`](./ENV_VARS.md) for the full reference — what each variable does, where to get it, and which environment it belongs in.

The `.env.example` file in the root is a ready-to-fill template.

---

## Documentation

All project docs live in the repo root. Read them in this order when starting a new session:

| File | Purpose |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Auto-loaded by Claude Code — project brief and workflow |
| [`RULES.md`](./RULES.md) | General development rules for every session |
| [`AGENT_RULES.md`](./AGENT_RULES.md) | Non-negotiable platform guardrails |
| [`CURRENT_TASK.md`](./CURRENT_TASK.md) | Current session scope — reset every session |
| [`PHASE_PLAN.md`](./PHASE_PLAN.md) | Full build order Phase 0 → 5 with progress tracking |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Folder structure, data flow, Supabase client rules |
| [`DEVSTACK.md`](./DEVSTACK.md) | Locked dependency versions and dev environment setup |
| [`CONVENTIONS.md`](./CONVENTIONS.md) | How code is written — naming, patterns, rules |
| [`ENV_VARS.md`](./ENV_VARS.md) | Every environment variable documented |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | Brand tokens, components, UI patterns |
| [`EMAIL_TEMPLATES.md`](./EMAIL_TEMPLATES.md) | All 26 email templates with props and content |
| [`BOOKING_SYNC.md`](./BOOKING_SYNC.md) | iCal calendar sync feature spec |
| [`ERROR_CODES.md`](./ERROR_CODES.md) | Every Edge Function error code |
| [`DECISIONS.md`](./DECISIONS.md) | Architecture decision records — why key choices were made |
| [`TESTING.md`](./TESTING.md) | Test strategy and conventions |
| [`SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md) | Pre-launch security audit checklist |
| [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) | Push notification payloads and in-app alert specs |
| [`CI_CD.md`](./CI_CD.md) | GitHub Actions workflow files and deployment order |
| [`ONBOARDING.md`](./ONBOARDING.md) | New developer setup guide |
| [`CHANGELOG.md`](./CHANGELOG.md) | Session-by-session build history |

Specs for the product itself:

| File | Purpose |
|---|---|
| [`vilo-platform-mvp.md`](./vilo-platform-mvp.md) | Full product specification (v1.2) |
| [`supabase_database.md`](./supabase_database.md) | Complete database schema, RLS, triggers, cron jobs |
| [`customer_journey.md`](./customer_journey.md) | Every user flow mapped in detail |

---

## Branch and commit conventions

```bash
# Branches
feature/listing-calendar-view
fix/paystack-webhook-signature
migration/add-ical-feeds-table
chore/upgrade-supabase-client

# Commits (Conventional Commits)
feat: add iCal import feed management UI
fix: correct refund amount calculation for partial policies
migration: create ical_feeds table and alter blocked_dates
chore: update @supabase/supabase-js to 2.43.2
docs: update PHASE_PLAN.md with Phase 2 progress
wip: booking calendar — drag selection incomplete
```

---

## Current status

**Phase 0 — Pre-build setup** (not started)

See [`PHASE_PLAN.md`](./PHASE_PLAN.md) for the full build order and progress tracking.

---

## Security

This platform handles real payments and personal data. Before contributing:

- Read [`AGENT_RULES.md`](./AGENT_RULES.md) — especially the security section
- Read [`SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md) — run before every production deployment
- Never commit `.env.local` or any file containing real secrets
- The `SUPABASE_SERVICE_ROLE_KEY` is server-side only — never in client code

Report security issues privately to `security@viloplatform.com`.

---

## Licence

Private and confidential. Not open source.
