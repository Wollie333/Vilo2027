# Vilo Platform — Dev Stack & Environment Setup

**Version:** 1.0
**Last Updated:** May 2026
**Companion Docs:** `vilo-platform-mvp.md`, `ARCHITECTURE.md`, `ENV_VARS.md`

---

## 1. Tech Stack — Locked Versions

These are the **exact versions** to use. Do not upgrade without updating this file and confirming compatibility across the monorepo.

### 1.1 Web App

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js | 14.2.x | App Router only. No Pages Router. |
| Language | TypeScript | 5.4.x | Strict mode enabled. No `any`. |
| Styling | Tailwind CSS | 3.4.x | JIT mode. Config in `tailwind.config.ts`. |
| UI Components | shadcn/ui | Latest | Components in `/components/ui`. Never modify generated files directly. |
| State Management | Zustand | 4.5.x | Stores in `/lib/stores`. One store per domain. |
| Forms | React Hook Form | 7.51.x | Always paired with Zod for validation. |
| Validation | Zod | 3.23.x | Schemas in `/lib/schemas`. Shared with mobile where possible. |
| Date handling | date-fns | 3.6.x | No Moment.js. No dayjs. date-fns only. |
| iCal parsing | ical.js | 2.x | RFC 5545 parsing for Booking Sync. Deno-compatible. Edge Functions only. |
| Server state | @tanstack/react-query | 5.x | Server state, caching, background refetch. Never use Zustand for remote data. |
| Calendar | react-big-calendar | 1.13.x | Used for host availability calendar. |
| Supabase client | @supabase/supabase-js | 2.43.x | SSR client via `@supabase/ssr`. |
| Hosting | Vercel | — | Deploy via GitHub Actions. Never manual deploy. |

### 1.2 Mobile App

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Expo | SDK 51+ | EAS Build for distribution. |
| Language | TypeScript | 5.4.x | Same tsconfig base as web. |
| Navigation | Expo Router | 3.x | File-based routing. |
| Styling | NativeWind | 4.x | Tailwind classes on React Native components. |
| State | Zustand | 4.5.x | Same stores as web where logic is shared. |
| Auth storage | Expo SecureStore | 13.x | Never AsyncStorage for auth tokens. |
| Push Notifications | Expo Notifications | 0.28.x | + FCM (Android) + APNs (iOS). |
| Supabase client | @supabase/supabase-js | 2.43.x | Same version as web. |

### 1.3 Backend

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Database | PostgreSQL | 15 | Via Supabase. |
| Supabase Platform | Supabase | Latest CLI | `supabase` CLI for local dev. |
| Edge Functions | Deno | 1.41.x | Inside `supabase/functions/`. TypeScript. |
| Email | Resend | Latest API | Via Resend SDK in Edge Functions. |
| Background jobs | pg_cron | — | Managed via Supabase. See `supabase_database.md`. |

### 1.4 DevOps & Tooling

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20.x LTS | Web + tooling runtime. Use nvm. |
| pnpm | 9.x | Package manager. No npm or yarn. |
| Supabase CLI | Latest | Local DB dev, migrations, Edge Functions. |
| EAS CLI | Latest | Expo build + submit. |
| GitHub Actions | — | CI/CD pipeline. |
| Sentry | 8.x SDK | Error monitoring (web + mobile). |
| PostHog | Latest | Product analytics. |
| Doppler | — | Secrets management (staging + production). |

---

## 2. Dev Environment Setup

### 2.1 Prerequisites

Install these before cloning the repo:

```bash
# Node.js 20 via nvm
nvm install 20
nvm use 20

# pnpm
npm install -g pnpm@9

# Supabase CLI
brew install supabase/tap/supabase       # macOS
# or
npx supabase                             # any platform

# EAS CLI (for mobile builds)
npm install -g eas-cli

# Doppler CLI (for secrets)
brew install dopplerhq/cli/doppler       # macOS
# or follow https://docs.doppler.com/docs/install-cli
```

### 2.2 Repo Setup

```bash
# Clone
git clone git@github.com:your-org/vilo.git
cd vilo

# Install all dependencies (monorepo root)
pnpm install

# Copy environment template
cp .env.example .env.local
# Fill in values — see ENV_VARS.md
```

### 2.3 Supabase Local Development

```bash
# Start Supabase locally (PostgreSQL + Auth + Storage + Edge Functions)
supabase start

# Apply all migrations
supabase db push

# Seed the database (plan_features, platform_settings)
supabase db seed

# Open local Supabase Studio
supabase studio
# → http://localhost:54323
```

**Local Supabase URLs (auto-assigned):**
- API: `http://localhost:54321`
- Studio: `http://localhost:54323`
- Inbucket (email): `http://localhost:54324`

After `supabase start`, copy the printed `anon key` and `service_role key` into `.env.local`.

### 2.4 Running the Web App

```bash
cd apps/web
pnpm dev
# → http://localhost:3000
```

### 2.5 Running the Mobile App

```bash
cd apps/mobile
pnpm start
# Opens Expo Go / dev client
```

For device testing:
```bash
pnpm ios      # iOS Simulator
pnpm android  # Android Emulator
```

### 2.6 Running Edge Functions Locally

```bash
# Serve all Edge Functions locally
supabase functions serve

# Serve a single function
supabase functions serve booking-create --env-file .env.local
```

Edge Functions run at: `http://localhost:54321/functions/v1/[function-name]`

### 2.7 Database Migrations

```bash
# Create a new migration
supabase migration new <migration_name>
# → creates supabase/migrations/TIMESTAMP_migration_name.sql

# Apply pending migrations
supabase db push

# Reset local DB (drops + re-applies all migrations + seed)
supabase db reset
```

> **Rule:** Never edit an existing migration file. Always create a new one.

### 2.8 Checking Types from Supabase Schema

```bash
# Generate TypeScript types from the live schema
supabase gen types typescript --local > packages/types/database.types.ts
```

Run this after every schema migration. Commit the updated types file.

---

## 3. Monorepo Structure

```
vilo/
├── apps/
│   ├── web/              # Next.js 14 web app
│   └── mobile/           # Expo React Native app
├── packages/
│   ├── types/            # Shared TypeScript types (DB types, API types)
│   ├── schemas/          # Shared Zod schemas (validation)
│   └── utils/            # Shared pure utility functions
├── supabase/
│   ├── functions/        # Edge Functions (Deno)
│   ├── migrations/       # SQL migration files
│   └── seed.sql          # Seed data
├── .env.example
├── pnpm-workspace.yaml
└── turbo.json            # Turborepo config
```

---

## 4. Environment Notes

- **Development:** `.env.local` with local Supabase keys. Never commit this file.
- **Staging:** Managed via Doppler `staging` config. Mirrors production schema.
- **Production:** Managed via Doppler `production` config + Vercel env vars.
- Never use production keys in local dev. Never use local keys in CI.

---

## 5. Key Commands Reference

| Task | Command |
|---|---|
| Install deps | `pnpm install` |
| Run web dev | `cd apps/web && pnpm dev` |
| Run mobile dev | `cd apps/mobile && pnpm start` |
| Start Supabase | `supabase start` |
| Push migrations | `supabase db push` |
| Reset local DB | `supabase db reset` |
| Generate types | `supabase gen types typescript --local > packages/types/database.types.ts` |
| Serve Edge Functions | `supabase functions serve` |
| Deploy Edge Function | `supabase functions deploy <name>` |
| Lint web | `cd apps/web && pnpm lint` |
| Build web | `cd apps/web && pnpm build` |
| EAS build (iOS) | `eas build --platform ios` |
| EAS build (Android) | `eas build --platform android` |

---

---

## 6. Dependency Installation Reference

Run these from the repo root after cloning.

### Web app (`apps/web`)

```bash
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add lucide-react @radix-ui/react-slider clsx tailwind-merge class-variance-authority
pnpm add @paypal/react-paypal-js
pnpm add leaflet @types/leaflet
pnpm add react-hook-form @hookform/resolvers zod
pnpm add zustand @tanstack/react-query
pnpm add date-fns react-big-calendar
pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit
pnpm add react-dropzone qrcode.react
pnpm add resend @react-email/components react-email
pnpm add posthog-js @sentry/nextjs
pnpm add sonner                              # toast notifications
pnpm add -D vitest @testing-library/react @testing-library/user-event
pnpm add -D @playwright/test
pnpm add -D prettier prettier-plugin-tailwindcss
pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional
npx shadcn-ui@latest init                    # run once, interactive
```

### Mobile app (`apps/mobile`)

```bash
pnpm add @supabase/supabase-js
npx expo install expo-router expo-secure-store expo-notifications
npx expo install expo-device expo-constants expo-location
npx expo install expo-image-picker expo-document-picker
pnpm add nativewind
pnpm add -D tailwindcss
pnpm add zustand @tanstack/react-query
pnpm add @sentry/react-native
```

### Edge Functions (`supabase/functions`)

Deno imports — no install needed. Use URL imports in function files:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'
import { Resend } from 'https://esm.sh/resend@latest'
import ICAL from 'https://esm.sh/ical.js@2.0.1'
import { z } from 'https://deno.land/x/zod/mod.ts'
```

---

*This document is a living reference. Update version numbers here before updating `package.json`.*
