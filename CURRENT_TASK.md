# Vilo — Current Task

> ⚠️ **Reset this file at the start of every Claude Code session.** This is your session contract — the agent will not work outside this scope without asking first.

**Date:** 2026-05-23 (closing session) / next session
**Phase:** Phase 1 — Foundation (Auth)
**Session Goal (next):** Ship `/login` and `/register` pages that talk to Supabase Auth end-to-end, deployed to https://vilo2027.vercel.app/.

---

## What We Are Building (next session)

Two user-facing pages plus the auth plumbing behind them. A real user can sign up with email + password, get a verification email (Supabase default template), log in, log out, and be routed correctly by `middleware.ts`.

**Spec reference:** `PHASE_PLAN.md` → Phase 1 → Auth & Users; `customer_journey.md` JG-03 (guest registration) and JH-01 (host registration); `ARCHITECTURE.md` §7 (Supabase SSR); `DESIGN_SYSTEM.md` quick reference (Vilo Design System.html is the canonical source per `feedback_design_system_source` memory).
**Customer journey(s):** JG-03 guest sign-up, login/logout
**DB schema reference:** `user_profiles`, `auth.users`, the `handle_new_user` trigger

---

## Acceptance Criteria (this session — 2026-05-23 Phase 1 Auth slice 1)

- [x] `/login` page — Email + password fields, "Forgot password?" link, "Don't have an account?" link, error states, loading state on submit.
- [x] `/register` page — Email + password + confirm-password, terms-of-service checkbox, error states, loading state on submit.
- [x] Both pages use shadcn `Button`, `Input`, `Label`, `Card`, `Form` with **React Hook Form + Zod** validation.
- [x] Brand styling per `Vilo Design System.html` — emerald primary, `rounded` (10px) inputs, `font-display` headings, `shadow-card` on the form panel, dot-grid hero background on desktop.
- [x] Successful sign-up triggers Supabase's default verification email (no Resend yet — that's deferred).
- [x] Successful login redirects to `/dashboard` (stub page is fine — full dashboard is later in Phase 1).
- [x] `middleware.ts` updated to redirect authenticated users away from `/login`/`/register`, and unauthenticated users away from `/dashboard`.
- [x] `pnpm build` from `apps/web/` passes with zero errors / zero warnings.
- [x] `pnpm lint` from `apps/web/` passes with zero warnings.
- [ ] Vercel deploy goes green on push to main. *(pending push at end of session)*
- [x] `CHANGELOG.md` updated.

---

## Out of Scope (next session)

- Google OAuth, magic link, password reset flows — separate Phase 1 sub-sessions per PHASE_PLAN.md.
- Host onboarding wizard — comes after basic auth lands.
- Listing editor, dashboard content, all other Phase 1 items.
- Mobile (Expo) auth — separate session.
- Resend / branded emails — deferred per Phase 0 closeout. Use Supabase default templates for now.

---

## Pre-Session Checklist (already true)

- [x] Web app live at https://vilo2027.vercel.app/
- [x] Design system canonical source published at /DESIGN_SYSTEM.HTML (and at repo root)
- [x] Supabase project linked (Frankfurt, `zlcivjgvtyeaszikqleu`)
- [x] All 27 migrations applied (`handle_new_user` trigger included)
- [x] 6 Storage buckets created (Phase 0 closeout)
- [x] Doppler `vilo2027` project + dev→Vercel Development sync active
- [x] EAS project linked in apps/mobile (UUID `50664ed2-…`)
- [x] shadcn/ui components installed (button, input, card, label, form, etc.)
- [x] Auth-related infra exists: `lib/supabase/{client,server,middleware}.ts`, root `middleware.ts`

---

## Session Notes — 2026-05-23 closing session

### What landed this session
- **Web deploy live** at https://vilo2027.vercel.app/. Fixed Vercel Root Directory, GitHub auth, stale-commit cache, `@types/react` v18/v19 collision (ADR-016), and Turbo framework override (ADR-017).
- **Vilo Design System.html** adopted as canonical UX/UI source. Mirrored at `apps/web/public/DESIGN_SYSTEM.HTML` → https://vilo2027.vercel.app/DESIGN_SYSTEM.HTML. Tailwind + globals.css rewritten to canonical tokens; homepage restyled. `DESIGN_SYSTEM.md` slimmed to a pointer.
- **Phase 0 closeout:** Storage buckets (6), Doppler (project + integrations + 1 sync), EAS (project linked). Sentry / PostHog / Resend deferred by design — no users yet means no errors / no analytics / no transactional emails worth setting up. Per "ship over block."
- **Memory updated:** `project-vilo-phase0-state`, `feedback-design-system-source`, `project-doppler-state`.

### Decisions and deviations
- **Doppler free-plan gap accepted.** Only `dev`→Vercel Development sync exists. `stg`→Preview and `prd`→Production are blocked by Developer-plan limit. All configs hold identical values per ADR-015 so impact is nil until staging/production diverge or plan is upgraded.
- **`apps/mobile` slug renamed to `vilo2027`** to match the EAS project name. Original `vilo` slug is gone. No code references it.
- **5 Doppler tokens are in this session's transcript.** User should revoke them at convenience — 1 read-only `dp.pt.…` and 4 scoped `dp.st.{prd,stg,dev,dev_personal}.…`. Saved to `project-doppler-state` memory as a reminder.

### Next session candidates (priority order)
1. **Phase 1 Auth — /login and /register** (scope above).
2. **Host onboarding wizard** — multi-step flow from `customer_journey.md` JH-01.
3. **Listing editor basics** — `/listings/new` with the 8-tab editor from `PHASE_PLAN.md` Phase 1.

### Active blockers carried into Phase 1
- `viloplatform.com` domain ownership unconfirmed — only blocks Resend / branded email work, which is itself deferred.
- Supabase `af-south-1` region unavailable (ADR-015) — only blocks the production region migration, which is launch-readiness work.

---

## Session Notes — 2026-05-23 (mid-session, marketing homepage)

### What landed (out of the original auth-only scope)
- Marketing homepage v1 at `/` — see CHANGELOG entry. Replaces the previous dev-status page, which moved to `/status`.
- 9 files added/changed: `apps/web/app/page.tsx`, `apps/web/app/status/page.tsx`, and `apps/web/app/_components/home/{SiteHeader,Hero,Features,HowItWorks,Pricing,SiteFooter,VLogo}.tsx`.
- Pricing tiers pulled directly from `vilo-platform-mvp.md` §6.6B (Basic R299 / Pro R599 / Business R1,199, 14-day trial, annual = 2 months free).

### Decisions
- Section components co-located under `apps/web/app/_components/home/` (underscored, non-routed). Reusable cross-route UI still belongs in `apps/web/components/`.
- Footer links to `/privacy` and `/terms` are present but those routes don't exist yet — will 404 until added. Acceptable placeholder for now.
- No CTA band added (kept to the 5-section scope the user picked).

### Still in scope for next push
- `/login` and `/register` UI shells (Zod schemas already exist at `apps/web/app/(auth)/schemas.ts`).
- Verify the homepage in the dev server / on Vercel preview — not yet manually QA'd in a browser this session.
