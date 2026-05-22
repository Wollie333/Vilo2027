# Vilo — Current Task

> ⚠️ **Reset this file at the start of every Claude Code session.** This is your session contract — the agent will not work outside this scope without asking first.

**Date:** 2026-05-22
**Phase:** Phase 0 — Pre-build setup (slice 2: monorepo + Next.js scaffold)
**Session Goal:** Scaffold the pnpm monorepo and `apps/web` Next.js 14 app, wire Supabase SSR client, render a homepage that reads from the linked Supabase project.

---

## What We Are Building

The first executable slice of the platform: a monorepo skeleton (`apps/`, `packages/`) with a Next.js 14 App Router web app that proves the Supabase wiring works end-to-end. No business logic — only the foundation that every subsequent feature hangs off.

**Spec reference:** `PHASE_PLAN.md` → Phase 0 → Next.js Web App; `DEVSTACK.md` §1.1 + §6; `ARCHITECTURE.md` §3, §7
**Customer journey(s):** N/A (foundation work)
**DB schema reference:** N/A — DB migrations come in a later session

---

## Acceptance Criteria

The session is **done** when every checkbox is ticked:

- [ ] `pnpm-workspace.yaml` and `turbo.json` at repo root.
- [ ] `apps/web` Next.js 14 App Router app initialized with TypeScript strict, Tailwind CSS, ESLint.
- [ ] `tailwind.config.ts` extends Tailwind with the brand tokens from `DESIGN_SYSTEM.md` §2 (brand + status colours).
- [ ] `shadcn/ui` initialized; `components/ui/` exists.
- [ ] `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts` per `ARCHITECTURE.md` §7.
- [ ] `apps/web/app/page.tsx` renders and successfully reads a value from the linked Supabase project (e.g. the auth user count or a generic health check via PostgREST).
- [ ] `pnpm build` from `apps/web/` passes with zero errors.
- [ ] `pnpm lint` from `apps/web/` passes with zero warnings.
- [ ] No `console.log` in committed code.
- [ ] `CHANGELOG.md` updated.

---

## Exact Scope — Files to Touch

**Project root (new):**
```
[ ] package.json                      (workspace root)
[ ] pnpm-workspace.yaml
[ ] turbo.json
[ ] tsconfig.base.json                (shared TS config)
```

**Web (`apps/web/` — created by create-next-app):**
```
[ ] package.json
[ ] tsconfig.json                     (extends ../../tsconfig.base.json)
[ ] next.config.mjs
[ ] tailwind.config.ts                (brand tokens added)
[ ] postcss.config.js
[ ] .eslintrc.json
[ ] app/layout.tsx                    (Inter + Plus Jakarta Sans via next/font)
[ ] app/page.tsx                      (homepage — proves Supabase wiring)
[ ] components/ui/                    (shadcn init output)
[ ] lib/supabase/client.ts
[ ] lib/supabase/server.ts
[ ] lib/supabase/middleware.ts
[ ] lib/utils.ts                      (shadcn cn() helper)
[ ] middleware.ts                     (Next.js root middleware)
```

**Shared packages (created empty, populated later sessions):**
```
[ ] packages/types/package.json
[ ] packages/types/database.types.ts  (empty placeholder — generated when migrations exist)
```

**Modified:**
```
[ ] CHANGELOG.md                      (session entry appended at end)
[ ] CURRENT_TASK.md                   (this file)
```

---

## Out of Scope

- All other deps from `DEVSTACK.md` §6 not needed for the homepage (Mapbox, PayPal, Tiptap, react-big-calendar, Resend, react-email, Sentry, PostHog, sonner, react-dropzone, qrcode.react). Install when first used.
- Husky / lint-staged / Commitlint / Prettier. Polish session.
- `packages/schemas` and `packages/utils` directories. Create when first needed.
- Apps/mobile (Expo). Separate session.
- Auth flows, listing UI, any feature work. Just the foundation.
- DB migrations.

---

## Known Constraints & Gotchas

- **Node version:** `DEVSTACK.md` says Node 20 LTS; environment has Node 22.17.1. Next.js 14.2 supports 22; proceed but note in the changelog.
- **pnpm workspace:** lockfile lives at the repo root, not in `apps/web/`. After `create-next-app`, remove any per-app lockfile and run `pnpm install` from root.
- **No `src/` directory** per `ARCHITECTURE.md` §3.
- **App Router only** per `DECISIONS.md` ADR-001 — never add a `pages/` directory.
- **Supabase keys** in `.env.local` already (from previous session). Web app reads them via `process.env.NEXT_PUBLIC_SUPABASE_URL` etc.
- **shadcn/ui generated components** go in `components/ui/` and must never be modified directly (`CONVENTIONS.md` §3.3).
- Per `AGENT_RULES.md` §7.4, new package installs would normally require asking — but the user explicitly approved this scope, so the DEVSTACK-listed deps are pre-approved for this slice.

---

## Pre-Session Checklist

- [x] git repo on `main`, pushed
- [x] Supabase project linked (`zlcivjgvtyeaszikqleu`)
- [x] `.env.local` populated
- [x] `pnpm` 9.x installed
- [x] Node 22.x installed
- [x] All spec docs present (`supabase_database.md` et al)

---

## Definition of Done

- [ ] All acceptance criteria above are ticked
- [ ] `pnpm build` passes from `apps/web/`
- [ ] `pnpm lint` passes from `apps/web/`
- [ ] Homepage at `http://localhost:3000` renders and shows evidence of a Supabase read
- [ ] No `any` introduced
- [ ] No `console.log` left in committed code
- [ ] Mobile responsive (default Tailwind responsive utilities applied)
- [ ] Committed with a Conventional Commits message
- [ ] `CHANGELOG.md` updated
- [ ] Session notes filled in

---

## Session Notes

### What landed
- Monorepo skeleton: pnpm workspace + Turborepo pipeline + shared `tsconfig.base.json`.
- `apps/web` — Next.js 14.2.35, App Router, TypeScript strict, Tailwind 3.4 with brand tokens + shadcn semantic tokens, Inter + Plus Jakarta Sans via `next/font/google`.
- Supabase SSR wiring: `lib/supabase/{client,server,middleware}.ts` plus a root `middleware.ts` that refreshes the JWT on every request.
- Homepage renders end-to-end with a live reachability check against `<project>.supabase.co/auth/v1/health` → "OK — GoTrue v2.189.0" in green.
- `packages/types` placeholder created for the auto-generated `database.types.ts`.
- Build + lint pass; dev server curl confirms 200 OK with the expected content.

### Decisions and deviations
- **Node 22.17.1** in use vs. DEVSTACK's locked Node 20 LTS. Compatible with Next.js 14.2; not flagged as breaking. Optional follow-up: install Node 20 via nvm-windows if the user wants strict adherence.
- **Minimal dep set** — installed only what the homepage uses. Mapbox/PayPal/Tiptap/etc. deferred until their first use, per CLAUDE.md "least code".
- **.env.local duplicated** at root and at `apps/web/.env.local`. Next.js requires the latter; both are gitignored. Switch to dotenv-cli or a `next.config.mjs` env-merge when `apps/mobile` is added.
- **shadcn/ui not interactively initialized.** Wrote `components.json` + `lib/utils.ts` directly to skip the interactive prompts. Future `shadcn add <component>` calls will work against this config.

### Next session candidates
1. **First DB migrations (Phase 0 Database)** — apply the v1.1 migration set from `supabase_database.md`. Start with extensions (`uuid-ossp`, `pgcrypto`, `pg_trgm`, `postgis`, `pg_cron`) and Domain 1 (Identity & Access). Regenerate `packages/types/database.types.ts` afterward.
2. **Auth pages (`/login`, `/register`)** — shadcn-installed `Button`, `Input`, `Card`; React Hook Form + Zod; Supabase email-password sign-in/up. Per `customer_journey.md` JG-03 / JH-01.
3. **Husky + Commitlint + Prettier polish** — small session to enforce conventions on every commit.

### Still TODO from Phase 0
- Doppler dev/staging/prod configs
- Vercel project + GitHub integration
- Expo EAS project (`apps/mobile` scaffold)
- Sentry + PostHog projects
- Resend account + `viloplatform.com` domain verification
- DB migrations 000000 → 000017 + v1.1 migration set
- GitHub Actions workflows
- Staging Supabase project
- Apps/mobile scaffold (Expo)

### Active blockers carried into the next session
- `viloplatform.com` domain ownership unconfirmed — Resend setup is gated on this.
- Supabase `af-south-1` region unavailable on this account — see `DECISIONS.md` ADR-015. Schedule the migration before public launch.
