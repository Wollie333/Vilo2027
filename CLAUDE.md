# Vilo Platform

You are working on **Wielo** — a direct-booking management platform for accommodation hosts and experience operators in South Africa. Hosts manage listings, bookings, calendars, payments, policies, and guest communication. Guests discover and book directly without a marketplace commission.

---

## Read These First

At the start of every session, read in this order:

1. `CURRENT_TASK.md` — what this session builds (scope contract — do not work outside it)
2. `RULES.md` — general good practice rules for every session
3. `AGENT_RULES.md` — non-negotiable platform-specific guardrails
4. `BUSINESS_PRINCIPLES.md` — foundational strategic rules (what Wielo is; always true)
5. `CONVENTIONS.md` — how code is written
6. `ARCHITECTURE.md` — folder structure and data flow
7. `DEVSTACK.md` — locked versions and dev environment setup
8. `ENV_VARS.md` — every environment variable and where to get it

**Before any DB work, read `docs/SCHEMA.md` — not `supabase_database.md`, not a lifecycle doc.**
`docs/SCHEMA.md` is **generated from the live database** (`node scripts/generate-schema-doc.mjs`):
every table, column, FK, RLS policy, trigger, function and cron, as they ACTUALLY are. Prose goes
stale and this project has been burned by it repeatedly — a rename orphaned a cron for 30 days, a
lifecycle doc described a call site that never existed. Regenerate it after any migration. Its
"Automated red flags" section re-runs the traps that have already cost us real time.

**Before claiming a feature is done, ask what calls it** — `node scripts/audit-wiring.mjs`.
The dominant bug in this codebase is a feature that exists, builds green, lints green, and is
invoked by nothing (see `docs/WIRING_AUDIT.md` for the standing inventory and the autopsy).

Read these for their specific domain:
- `BOOKING_SYNC.md` — iCal calendar sync spec (import/export, DB schema, Edge Functions)
- `DESIGN_SYSTEM.md` — brand colours, typography, components, UI patterns
- `EMAIL_TEMPLATES.md` — all 26 email templates with props and content spec
- `ERROR_CODES.md` — every Edge Function error code
- `DECISIONS.md` — why key decisions were made (check before proposing changes)
- `PHASE_PLAN.md` — full build order, current phase, what's done and what's next
- `TESTING.md` — what to test, how to test it, and what the conventions are
- `SECURITY_CHECKLIST.md` — pre-launch security audit (run before any production deploy)
- `NOTIFICATIONS.md` — push payload specs, in-app alerts, token management
- `CI_CD.md` — GitHub Actions workflow files and deployment order

Read these when working in a specific domain:
- `wielo-platform-mvp.md` — full product spec with all modules and subscription tiers
- `supabase_database.md` — complete DB schema, RLS policies, triggers, cron jobs, seed data
- `customer_journey.md` — every user flow mapped in detail

---

## Stack

- **Web:** Next.js 14.2 (App Router), TypeScript strict, Tailwind CSS, shadcn/ui, Zustand, React Hook Form + Zod
- **Mobile:** Expo SDK 51+, Expo Router, NativeWind, Expo SecureStore
- **Backend:** Supabase (PostgreSQL 15), Edge Functions (Deno), Realtime, Storage
- **Payments:** Paystack (card + subscriptions), PayPal (orders + subscriptions), Manual EFT
- **Email:** Resend (via Edge Functions only)
- **Package manager:** pnpm only — no npm, no yarn

---

## Absolute Rules

### Pre-MVP data policy (active until first public launch)
- **No real users yet.** The Supabase database has no production data
  worth preserving. Treat every table as empty.
- **No backwards-compat shims.** No data backfills, no dual-write
  windows, no feature flags for soft rollouts, no rename-and-alias
  columns. If a migration needs to drop a constraint, drop a column, or
  reshape a table — just do it.
- **`supabase db reset` is fair game.** Wipe and re-seed whenever it
  simplifies things.
- **Soft-delete may be bypassed during the MVP build** if it costs
  meaningful complexity — but only on tables not yet listed in the
  `AGENT_RULES.md` §2.1 "never hard-delete" set. (For `user_profiles`,
  `hosts`, `listings`, `bookings` keep using `deleted_at` because the
  triggers and RLS policies already depend on it.)
- **This policy expires at MVP launch.** The moment real users hit
  production, revert to the standard rules: additive migrations only,
  soft-delete only, no destructive reshapes without a documented plan.

### Security
- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client — Edge Functions and Server Actions only
- NEVER trust client-supplied prices — always recalculate server-side in Edge Functions
- ALWAYS verify webhook signatures before any DB write (Paystack: HMAC SHA-512 / PayPal: Verification API)
- NEVER bypass RLS in client-side code

### Database
- NEVER hard-delete `user_profiles`, `hosts`, `listings`, or `bookings` — soft delete (`deleted_at`) only
- NEVER edit an existing migration file — always create a new one
- `admin_audit_log`, `subscription_history`, `policy_snapshots` are INSERT-only — no UPDATE or DELETE
- After every schema change: `supabase gen types typescript --local > packages/types/database.types.ts`
- ALWAYS read `supabase_database.md` before writing any query, migration, or Edge Function

### Feature Permissions
- ALWAYS use `check_feature_permission` RPC — never hardcode plan logic
- Feature gates must exist at both Edge Function AND UI layer
- **Pre-MVP policy:** every new feature must be open on the `free` plan so the founder can smoke-test. Seed `plan_features` with `is_enabled = true` for every plan AND make the gate's `assertFeatureEnabled` short-circuit to `true` (with a comment pointing to `AGENT_RULES.md` §3.4). The RPC wiring stays in place for Phase 3.

### Code Quality
- NO `any` in TypeScript — use `unknown` + narrow, or generated DB types
- ALL forms use React Hook Form + Zod
- ALL mutations go through Server Actions or Edge Functions — never direct `.insert/update/delete()` from client components
- ALL Realtime subscriptions must be cleaned up on unmount
- Use the LEAST amount of code that correctly solves the problem

### Before Marking Any Task Done
- **NEVER "done" until the change is SEEN working in BOTH the builder canvas AND
  the live/published render** — founder directive, non-negotiable (BUSINESS_PRINCIPLES.md
  Principle #9, RULES.md §8). Green build/lint/tests are necessary but NOT sufficient.
  "Should work" / "logic is correct" / "couldn't reach live" ≠ done. Verify BOTH with
  real evidence (screenshot / DOM inspect / computed style); a component can diverge
  between a builder's bespoke preview and the shared live render path. Can't reach a
  surface? Resolve it (build a harness / ask for a test URL up front) — never report
  "done"; mark it NOT verified and say so loudly.
- `pnpm build` passes — zero errors
- `pnpm lint` passes — zero warnings
- No `console.log` in committed code
- Types regenerated if schema changed
- `CURRENT_TASK.md` session notes updated
- `CHANGELOG.md` updated

### When Unsure
- Ask before installing new packages
- Ask before creating new DB tables or columns
- Ask before touching files outside `CURRENT_TASK.md` scope

---

## Monorepo Structure

```
wielo/
├── apps/
│   ├── web/               # Next.js 14 web app
│   └── mobile/            # Expo React Native app
├── packages/
│   ├── types/             # Shared DB types (auto-generated)
│   ├── schemas/           # Shared Zod schemas
│   └── utils/             # Shared pure utilities
├── supabase/
│   ├── functions/         # Edge Functions (Deno)
│   ├── migrations/        # SQL migrations (timestamped, never edit)
│   └── seed.sql
├── CLAUDE.md              # ← this file (auto-loaded by Claude Code)
├── RULES.md               # General good practice rules
├── CURRENT_TASK.md        # Reset every session
├── AGENT_RULES.md         # Platform-specific guardrails
├── CONVENTIONS.md         # How code is written
├── ARCHITECTURE.md        # Folder structure and data flow
├── DEVSTACK.md            # Locked versions and dev setup
├── ENV_VARS.md            # Every environment variable
├── CHANGELOG.md           # Session history
├── NOTIFICATIONS.md       # Push and in-app notification specs
├── CI_CD.md               # GitHub Actions workflow specs
└── ONBOARDING.md          # New developer setup guide
```

---

## Key Conventions (short version — full detail in CONVENTIONS.md)

- Server Components are default in Next.js — only `'use client'` when hooks/browser APIs needed
- File naming: `PascalCase` components, `camelCase` hooks/utils/stores, `kebab-case` routes
- Edge Functions return `{ success: true, data: {} }` or `{ success: false, error: { code: 'SCREAMING_SNAKE_CASE', message: '...' } }`
- Currency stored in full Rand units (not cents) — convert to kobo only when calling Paystack API
- Every `amount` column must have a `currency` column beside it
- shadcn/ui for all UI components — never build from scratch what shadcn provides
- Mobile-first responsive design on every web page

---

## Claude Code Workflow (Terminal)

> **No Docker.** The local Supabase stack is removed. Do NOT run
> `supabase start` / `supabase status` / `supabase db reset`. Apply migrations
> directly to the linked cloud project with `supabase db push --linked`
> (see `MIGRATIONS.md`). Regenerate types with `supabase gen types typescript
> --linked > packages/types/database.types.ts`.
>
> **Never pipe stderr into the types file** (no `2>&1` / `| tee`): the CLI
> writes `Initialising login role...` + a version-notice footer to stderr, and
> merging them corrupts `database.types.ts` (invalid TS, line 1 must be
> `export type Json =`). Use `> file` alone, or `> file 2>gen_err.log`.

### Starting a session
```bash
# Always start from project root
cd ~/your-project

# Read your task before doing anything else
cat CURRENT_TASK.md
```

### Continuing a previous session
```bash
claude --continue
```
Use this to resume — it restores conversation context. Don't start a fresh session if work is in progress.

### Useful flags
```bash
claude                                  # interactive session
claude --continue                       # resume last session
claude "do X"                           # one-shot task
claude --dangerously-skip-permissions   # skip file permission prompts (reviewed tasks only)
```

> Only use `--dangerously-skip-permissions` when you've already reviewed what the task will touch. Never use it on payment, webhook, migration, or secrets-related tasks.

### After every session
```bash
# Build check
cd apps/web && pnpm build

# Lint check
pnpm lint

# If schema changed
supabase gen types typescript --local > packages/types/database.types.ts

# Commit
git add .
git commit -m "feat: [description of what was built]"
```

### Commit message format (Conventional Commits)
```
feat:      new feature
fix:       bug fix
chore:     tooling, deps, config
migration: new DB migration
docs:      documentation update
refactor:  no behaviour change
wip:       incomplete work being saved
```

---

## Common Commands Reference

```bash
# Dev
pnpm dev                        # start web app (from apps/web/)
pnpm start                      # start mobile app (from apps/mobile/)

# Database — NO Docker. Apply straight to the linked cloud project.
supabase db push --linked       # apply pending migrations (in order) to cloud
supabase migration list --linked  # verify local + remote are in sync
supabase migration new <name>   # create new migration file
supabase gen types typescript --linked > packages/types/database.types.ts

# Edge Functions
supabase functions serve                               # serve all functions locally
supabase functions serve <name> --env-file .env.local  # serve one function
supabase functions deploy <name>                       # deploy to Supabase

# Build & Lint
pnpm build                      # build web app
pnpm lint                       # lint web app
grep -r "console.log" apps/     # check for stray logs before committing

# EAS (mobile builds)
eas build --platform ios
eas build --platform android
```
