# Vilo Platform — Developer Onboarding

**Version:** 1.0
**Last Updated:** May 2026
**For:** Anyone joining the project for the first time

Welcome. This document gets you from zero to a running local environment and your first pull request. Read it once, top to bottom, before touching any code.

---

## 1. Before You Start

Make sure you have been given:

- [ ] GitHub repo access (push access to `develop`, PR access to `main`)
- [ ] Supabase project access (Supabase dashboard — staging project)
- [ ] Vercel project access (read + preview deploy; Environment Variables — Development/Preview, Production is restricted)
- [ ] The real secret values for your `apps/web/.env.local` (from the project lead, or copied out of Vercel's Development environment)
- [ ] Expo organisation access (for mobile builds)
- [ ] Sentry access (error monitoring)

If any of these are missing, ask the project lead before continuing.

---

## 2. Machine Setup

### Required tools

```bash
# Node.js 20 via nvm (do not use system Node)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
nvm alias default 20

# pnpm 9 (do not use npm or yarn on this project)
npm install -g pnpm@9

# Supabase CLI
brew install supabase/tap/supabase     # macOS
# or
npx supabase@latest                   # any platform

# EAS CLI (for mobile builds — only needed if you work on mobile)
npm install -g eas-cli
```

### Verify installs

```bash
node --version    # should be v20.x.x
pnpm --version    # should be 9.x.x
supabase --version
```

---

## 3. Clone and Install

```bash
git clone git@github.com:your-org/wielo.git
cd wielo
pnpm install
```

---

## 4. Secrets Setup (`.env.local`)

Deployed environments read their secrets from Vercel Environment Variables (Project `vilo2027` → Settings → Environment Variables). For local development you use a gitignored `apps/web/.env.local`, seeded from the committed `.env.example` template.

```bash
# Copy the template into place
cp apps/web/.env.example apps/web/.env.local
```

Then open `apps/web/.env.local` and fill in the real values (get them from the project lead, or copy them out of Vercel's Development environment). After that, the app runs with the correct env vars using the normal dev command:

```bash
pnpm dev       # web app with correct env vars from .env.local
```

> `.env.local` is in `.gitignore`. Never commit it or any file containing real secret values. `.env.example` is documentation only — no real values.

---

## 5. Local Supabase

```bash
# Start local Supabase (PostgreSQL + Auth + Storage + Edge Functions)
supabase start

# Apply all migrations
supabase db push

# Seed reference data (plan_features, platform_settings, default policy templates)
supabase db seed

# Verify everything is running
supabase status
```

After `supabase start`, the output prints your local keys. Copy them into `apps/web/.env.local` — they override the dev values for local Supabase.

**Local service URLs:**

| Service | URL |
|---|---|
| API | http://localhost:54321 |
| Supabase Studio | http://localhost:54323 |
| Email (Inbucket) | http://localhost:54324 |
| Edge Functions | http://localhost:54321/functions/v1/ |

---

## 6. Running the Apps

### Web

```bash
cd apps/web
pnpm dev
# → http://localhost:3000
```

### Mobile

```bash
cd apps/mobile
pnpm start            # opens Expo Go on your phone or simulator

# Or target a specific simulator
pnpm ios              # iOS Simulator (macOS only)
pnpm android          # Android Emulator
```

Install Expo Go on your phone to test on a real device — scan the QR code from `pnpm start`.

### Edge Functions

```bash
# Serve all Edge Functions locally
supabase functions serve --env-file .env.local

# Serve a single function with live reload
supabase functions serve booking-create --env-file .env.local
```

---

## 7. Verify Everything Works

Run through this checklist after setup:

- [ ] `http://localhost:3000` loads the Wielo homepage
- [ ] `http://localhost:54323` opens Supabase Studio with the correct schema
- [ ] You can create a test account at `http://localhost:3000/register`
- [ ] Email verification link arrives at `http://localhost:54324` (Inbucket)
- [ ] `pnpm test` runs and passes (from `apps/web/`)
- [ ] `pnpm build` completes with zero errors (from `apps/web/`)

---

## 8. Codebase Orientation

Read these docs before writing a single line of code. In order:

1. `README.md` — what Wielo is
2. `wielo-platform-mvp.md` — full product spec
3. `CLAUDE.md` — the AI coding workflow and absolute rules
4. `ARCHITECTURE.md` — folder structure and data flow
5. `CONVENTIONS.md` — how code is written
6. `supabase_database.md` — the full DB schema

Then read whichever domain doc covers your first task:
- `BOOKING_SYNC.md` — iCal calendar sync
- `EMAIL_TEMPLATES.md` — email templates
- `NOTIFICATIONS.md` — push and in-app notifications
- `DESIGN_SYSTEM.md` — UI tokens and components
- `DECISIONS.md` — why key decisions were made (read before proposing changes)

---

## 9. Working on a Task

### 1. Read CURRENT_TASK.md first

Before writing code, `CURRENT_TASK.md` must be filled in with the task, acceptance criteria, and scope. If it's empty or stale, update it or ask what the current focus is.

### 2. Branch from develop

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

Branch naming:

```
feature/   feature/listing-calendar-sync
fix/       fix/paystack-webhook-signature
migration/ migration/add-ical-feeds-table
chore/     chore/upgrade-supabase-client
docs/      docs/update-phase-plan
```

### 3. Write code

Follow `CONVENTIONS.md` and `AGENT_RULES.md`. When using Claude Code:

```bash
# Start a session from the project root
cd ~/wielo
supabase status   # confirm Supabase is running
cat CURRENT_TASK.md
claude            # start Claude Code session
```

### 4. Before committing

```bash
# Build must pass
cd apps/web && pnpm build

# Lint must pass (zero warnings)
pnpm lint

# No console.log in committed code
grep -r "console.log" apps/web/src apps/mobile

# If schema changed, regenerate types
supabase gen types typescript --local > packages/types/database.types.ts
git add packages/types/database.types.ts
```

### 5. Commit with Conventional Commits

```bash
git add .
git commit -m "feat: add iCal import feed management UI"
```

Commit message types: `feat`, `fix`, `chore`, `migration`, `docs`, `refactor`, `wip`, `test`

### 6. Open a PR to develop

```bash
git push origin feature/your-feature-name
```

Then open a PR on GitHub targeting `develop`. CI will run automatically. The PR description should include:
- What was built (1–2 sentences)
- How to test it locally
- Any migrations that need to be run
- Screenshot or screen recording for UI changes

---

## 10. Database Migrations

Never edit an existing migration file. Always create a new one.

```bash
# Create a new migration
supabase migration new add_ical_feeds_table

# This creates: supabase/migrations/TIMESTAMP_add_ical_feeds_table.sql
# Write your SQL in that file, then:

supabase db push           # apply locally
supabase gen types typescript --local > packages/types/database.types.ts
git add supabase/migrations/ packages/types/
git commit -m "migration: add ical_feeds table"
```

For `migration/*` branches: merge to `develop` first, validate on staging, then PR to `main`.

---

## 11. Common Issues

### Migrations / type-gen not reflecting the database

This project does **not** run the local Supabase stack — there is no Docker
dependency. Apply migrations straight to the linked cloud project and regenerate
types against it:

```bash
supabase db push --linked
supabase gen types typescript --linked > packages/types/database.types.ts
```

See `MIGRATIONS.md` for the full no-Docker workflow.

### Types are out of date

```bash
supabase gen types typescript --local > packages/types/database.types.ts
```

Run this any time the schema changes.

### Build fails with type errors

Most type errors after a schema change are fixed by regenerating types (above). If the error is in your own code — fix it. No `as any` workarounds.

### Env variable not found locally

An undefined env var at runtime almost always means it is missing from `apps/web/.env.local`. Compare your file against `apps/web/.env.example` and make sure every required key has a real value (see `ENV_VARS.md` for the full catalogue). If a value only lives in Vercel, copy it from the Development environment.

### Mobile app can't connect to local Supabase

The mobile app on a physical device can't reach `localhost`. Use your machine's local IP:

```bash
ipconfig getifaddr en0   # macOS — get your local IP
```

Update `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` to `http://192.168.x.x:54321` for mobile device testing.

---

## 12. Getting Help

- Read the relevant `.md` file first — most questions are answered there
- Check `DECISIONS.md` before proposing a different approach to something already decided
- Check `CHANGELOG.md` to understand what was recently built and any notes from previous sessions
- For questions about the product spec, refer to `wielo-platform-mvp.md` or `customer_journey.md`

---

*Once you've run through this doc and have everything working, you're ready. Update `CURRENT_TASK.md`, pick up the next task in `PHASE_PLAN.md`, and start building.*
