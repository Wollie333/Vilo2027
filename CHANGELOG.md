# Vilo Platform — Changelog

**Format:** One entry per completed session. Add entries at the top (newest first).
**Updated by:** Claude Code at the end of every session (see `RULES.md` → Definition of Done).

---

## How to Add an Entry

Copy this template and fill it in at the end of every session:

```
## [DATE] — [Phase X] — [Short description of what was built]

### Built
- [Feature or fix 1]
- [Feature or fix 2]

### Changed
- [Any existing behaviour that changed]

### Migrations
- [Migration filename if DB was touched]

### Notes
- [Decisions made, gotchas, anything next session needs to know]

### Commit
- `feat: description` — [short git hash]
```

---

## 2026-05-23 — Phase 1 — Auth slice 3: magic link sign-in

### Built
- **Magic link sign-in** added to `/login` as a second tab next to "Password" (shadcn
  `Tabs`). The Magic-link pane has a single email field; submit fires
  `magicLinkAction`, which calls
  `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: ${origin}/auth/confirm, shouldCreateUser: false } })`.
  On success the pane swaps in an inline sent-state ("If an account exists for
  X, a sign-in link is on its way. It expires in 1 hour.") with a "Send another
  link" button to reset.
- **`shouldCreateUser: false`** — magic-link form is sign-in only. New users go
  through `/register`. Stops the magic-link surface from quietly minting accounts
  with no ToS acceptance and no `handle_new_user` trigger context.
- **One new Server Action** in `apps/web/app/(auth)/actions.ts`: `magicLinkAction`.
  Like `forgotPasswordAction`, it swallows Supabase errors and always returns
  `{ ok: true }` to the client — anti-enumeration. Real failures (rate limit,
  SMTP) still produce a toast via the existing `friendlyAuthError` path.
- **One new Zod schema** in `apps/web/app/(auth)/schemas.ts`: `magicLinkSchema`
  (email only, mirrors `forgotPasswordSchema`).

### Changed
- **`LoginForm.tsx`** restructured into a single Client Component containing the
  shared card (header, verify banner, footer "Don't have an account?" link) and
  two inline panes — `PasswordPane` (unchanged behavior) and `MagicLinkPane` (new)
  — switched by shadcn `Tabs`. Each pane owns its own RHF instance so the two
  forms don't interfere.

### Notes
- **No `/auth/confirm` change needed.** Existing Route Handler already accepts
  `type=magiclink` (it's in Supabase's `EmailOtpType` union) and the default
  `next=/dashboard` lands users in the right place.
- **No middleware change needed.** Magic-link sign-in lives at `/login` which is
  already in `AUTH_ROUTES`, so signed-in users are still bounced to `/dashboard`
  before they ever see the tab.
- **`pnpm --filter web build`** passes — 12 routes, `/login` first-load JS now
  152 kB (was 146 kB; +6 kB for the tabs + magic-link form). `pnpm --filter web
  lint` zero warnings.
- **Out of scope:** changing the magic-link email template (still Supabase
  default), throttling client-side (Supabase enforces SMTP rate limits).

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1 — Auth slice 2: password reset flow

### Built
- **`/forgot-password`** (`apps/web/app/(auth)/forgot-password`) — email-only form
  that calls `forgotPasswordAction`, which fires
  `supabase.auth.resetPasswordForEmail` with
  `redirectTo: ${origin}/auth/confirm?next=/reset-password`. Always redirects to
  `/forgot-password?sent=1` regardless of whether the email exists, to avoid
  account-enumeration leaks. The "sent" state renders a `SentNotice` card with a
  back-to-sign-in link.
- **`/reset-password`** (`apps/web/app/(auth)/reset-password`) — Server Component
  guard that redirects to `/forgot-password` if there's no session, then renders a
  Client form with password + confirm-password. Submit calls `resetPasswordAction`
  which re-checks the session, calls `supabase.auth.updateUser({ password })`, and
  redirects to `/dashboard`.
- **Two new Server Actions** in `apps/web/app/(auth)/actions.ts`:
  `forgotPasswordAction`, `resetPasswordAction`.
- **Two new Zod schemas** in `apps/web/app/(auth)/schemas.ts`:
  `forgotPasswordSchema`, `resetPasswordSchema` (>=8 char password, match refine).

### Changed
- **`apps/web/lib/supabase/middleware.ts`** — added `/forgot-password` to
  `AUTH_ROUTES` so authenticated users hitting it get bounced to `/dashboard`.
  `/reset-password` is intentionally NOT in `AUTH_ROUTES` — it relies on the
  short-lived recovery session that `/auth/confirm` issues via `verifyOtp`.

### Notes
- **Reuses existing `/auth/confirm` Route Handler.** That handler already accepts a
  `next` query param; the recovery flow piggybacks on it instead of duplicating
  verifyOtp logic.
- **Account-enumeration protection.** `forgotPasswordAction` doesn't surface
  Supabase errors to the client — it always redirects to the "check your inbox"
  state. The error path is logged server-side by Supabase but not exposed.
- **`pnpm --filter web build`** passes — 12 routes generated. `pnpm --filter web
  lint` zero warnings.
- **Out of scope:** custom email template (still Supabase default), rate-limiting
  the request endpoint (Supabase enforces ~3/hour on the free SMTP plan).

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1 — Auth slice 1: /login + /register live

### Built
- **`/login`** (`apps/web/app/(auth)/login`) — email + password, "Forgot password?" link
  (`/forgot-password` — page lands next sub-session), "Create one" link to `/register`,
  inline field errors (RHF + Zod), pending state, post-register verification banner
  when `?verify=1` is present.
- **`/register`** (`apps/web/app/(auth)/register`) — email + password + confirm-password
  + ToS checkbox linking `/terms` and `/privacy` (legal pages land in Phase 5), inline
  field errors, pending state. On success Supabase fires the default verification email
  and the page redirects to `/login?verify=1`.
- **`/dashboard`** (`apps/web/app/dashboard`) — stub Server Component that reads
  `auth.getUser()`, shows the signed-in email and a sign-out button. Real dashboard
  lands later in Phase 1.
- **`/auth/confirm`** (`apps/web/app/auth/confirm/route.ts`) — Route Handler that
  consumes Supabase's `token_hash` + `type` and calls `verifyOtp`, then redirects to
  `/dashboard` (or `/login?verify=failed` on error).
- **Server Actions** (`apps/web/app/(auth)/actions.ts`) — `loginAction`,
  `registerAction`, `signOutAction`. All re-validate input with Zod server-side, call
  the `@supabase/ssr` server client, map Supabase error messages to user-friendly
  toasts, then `redirect()` on success.
- **Shared `(auth)` layout** — centered card on the brand dot-grid background, Vilo
  logo mark in the header, "Back to site" link.
- **Sonner `<Toaster richColors position="top-center" />`** wired into the root
  `apps/web/app/layout.tsx` so any Client Component can `toast.error` / `toast.success`
  per CONVENTIONS.md §8.1.
- **Schemas** (`apps/web/app/(auth)/schemas.ts`) — `loginSchema` and `registerSchema`
  with email lowercasing, >=8 char password, password-match refinement, and
  ToS-must-be-true rule. Colocated rather than in `packages/schemas` since they are
  single-consumer for now (per CONVENTIONS.md §6.2).

### Changed
- **`apps/web/lib/supabase/middleware.ts`** — `updateSession` now also enforces route
  protection: authenticated users hitting `/login` or `/register` are redirected to
  `/dashboard`; unauthenticated users hitting `/dashboard*` are redirected to `/login`.
  Single `supabase.auth.getUser()` call drives both the session refresh and the
  redirect logic.
- **`apps/web/app/layout.tsx`** — added `<Toaster />` import and render so toasts work
  app-wide.

### Notes
- **`pnpm --filter web build`** passes — 9 routes generated. Middleware bundle 82.6 kB.
  `pnpm --filter web lint` passes with zero warnings.
- **No new DB migrations.** Phase 0's `handle_new_user` trigger auto-inserts
  `user_profiles` on `auth.users` INSERT — sign-up flows through it with no extra wiring.
- **Sign-up metadata kept minimal.** Spec only asks for email + password + ToS this
  slice; no `full_name` collected yet. `user_profiles.full_name` stays null until the
  host onboarding wizard (next sub-session) collects it.
- **Email verification path:** `signUp({ options: { emailRedirectTo:
  ${origin}/auth/confirm } })` => Supabase emails a link with `token_hash` +
  `type=signup` => our Route Handler calls `verifyOtp` => middleware sees a fresh
  session and lands the user on `/dashboard`.
- **Server Action redirect pattern:** actions return `{ ok: false, error }` on failure
  and call `redirect("/...")` on success. The client form awaits the action; on a
  returned error it pops a toast, on redirect Next.js intercepts the thrown
  `NEXT_REDIRECT` and navigates.
- **`/forgot-password`, `/terms`, `/privacy` not yet built.** Links exist per the spec
  but resolve to 404. Forgot-password is the next Phase 1 sub-session per
  PHASE_PLAN.md; legal pages are Phase 5.
- **No Google OAuth, no magic link, no password reset** — all out of scope for this
  slice per CURRENT_TASK.md.

### Commit
- (single commit for this slice — pushed to `main` after staging.)

---

## 2026-05-23 — Phase 1 — Marketing homepage v1

### Built
- `apps/web/app/page.tsx` rewritten as a real marketing homepage. Composed from co-located server components under `apps/web/app/_components/home/`: `SiteHeader`, `Hero`, `Features`, `HowItWorks`, `Pricing`, `SiteFooter`, plus a shared `VLogo` SVG.
- Sections: sticky nav · split hero with dual CTA · feature grid (3 host + 3 guest + 2 universal) · two-column how-it-works (hosts + guests, 3 steps each) · 3-tier pricing pulled verbatim from `vilo-platform-mvp.md` §6.6B (Basic R299 / Pro R599 / Business R1,199) · dark-emerald site footer with status dot.
- All sections are server components, all classes use canonical Vilo Design System tokens (brand-primary/secondary/dark/accent/line/mute, rounded-card, shadow-glow, dot-grid, font-display). Lucide icons via existing `lucide-react` dep.

### Changed
- Old dev-status content (Supabase auth health check + stack readout) moved from `/` to a new `/status` route at `apps/web/app/status/page.tsx`. Same readout, same brand styling, but off the public front door. Footer + status-dot link to it.

### Migrations
- None.

### Notes
- Scope: this was outside `CURRENT_TASK.md` (which targeted `/login` + `/register`). The auth Zod schemas at `apps/web/app/(auth)/schemas.ts` and the `/login` `/register` route files already exist on disk from earlier in this session — homepage CTAs already wire to them.
- `pnpm build` clean. `pnpm lint` clean. `/` is statically prerendered (180 B route, 96.1 kB first-load JS).
- Decision: section components live under `apps/web/app/_components/home/` (underscored = private, non-routed) rather than `apps/web/components/` to keep route-local UI close to the route that uses it. Reusable cross-route UI still belongs in `apps/web/components/`.

### Commit
- _Pending — user has not yet asked for commit/PR._

---

## 2026-05-22 — Phase 0 — Bootstrap: git, GitHub, Supabase link

### Built
- Local `git` repository initialized on `main` with a Node/Next/Expo/Supabase `.gitignore`.
- Private GitHub repo `Wollie333/Vilo2027` (created in dashboard by user); `main` pushed.
- `.env.example` created from the `ENV_VARS.md` §9 template (keys only — no secrets).
- Supabase project `Vilo2027` provisioned (ref `zlcivjgvtyeaszikqleu`, region `Central EU (Frankfurt)`).
- `supabase init` + `supabase login` (CLI access token) + `supabase link --project-ref zlcivjgvtyeaszikqleu` completed and verified.
- `.env.local` populated with Supabase project URL + new-format API keys (`sb_publishable_…`, `sb_secret_…`); confirmed untracked.
- `CURRENT_TASK.md` populated as the session contract.
- `gh` CLI 2.92.0 installed via winget; `supabase` CLI 2.101.0 installed via direct binary release (no winget package exists).

### Changed
- Local-only git identity set for this repo: `user.email=wollie333@gmail.com`, `user.name=Wollie333`. No global config touched.
- `PHASE_PLAN.md` Phase 5 line "Supabase region confirmed: af-south-1" annotated with the current Frankfurt provisioning + migration requirement.

### Decisions
- **ADR-015** added: Supabase deployed to Central EU (Frankfurt) rather than `af-south-1` (Cape Town). `af-south-1` was unavailable in the Supabase dashboard for this account at provisioning time. The region MUST be migrated before public launch for POPIA compliance.

### Migrations
- None this session — DB schema work begins once `supabase_database.md` lands.

### Notes
- Supabase keys are the newer `sb_publishable_` / `sb_secret_` format (replacements for legacy `anon`/`service_role` JWTs). They work transparently with `@supabase/supabase-js` ≥2.43.x — no SDK bump required.
- Only **one** Supabase project exists. The plan originally called for production + staging; staging deferred to a future session.
- An earlier Vilo2027 project (ref `ddexrmfuqtvmumgvzqxz`, West EU / Ireland) was created and deleted by the user when neither it nor a re-attempt offered `af-south-1`. Both attempts confirmed `af-south-1` is not currently available for this Supabase account.
- `viloplatform.com` domain ownership and Resend / Doppler / Vercel / EAS / Sentry / PostHog / Mapbox / Paystack / PayPal accounts are NOT set up yet — placeholders remain in `.env.local`.
- `supabase_database.md`, `vilo-platform-mvp.md`, and `customer_journey.md` are still missing from the repo. The Phase 0 Database section is blocked until at least `supabase_database.md` is added.

### Commits
- `chore: initial commit with project documentation` — 2ec4dd9
- `chore: add .env.example from ENV_VARS.md template` — 62b37aa
- `chore: bootstrap supabase config, session contract, and changelog` — 969ea79
- (final commit appended after this update is staged.)

## 2026-05-22 — Phase 0 — Specs added: product, schema, customer journey

### Built
- `vilo-platform-mvp.md` (85 KB) added — full v1.2 product spec with 10 core modules including Refund Manager (6.9) and Policy Manager (6.10).
- `supabase_database.md` (137 KB) added — complete DB architecture: 11 domains, RLS, functions, triggers, pg_cron, Realtime, Storage, seed data, migration strategy. Requires extensions `uuid-ossp`, `pgcrypto`, `pg_trgm`, `postgis`, `pg_cron`.
- `customer_journey.md` (86 KB) added — 6 personas across ~50 end-to-end journeys (guest, host free/pro/business, staff, admin, subscriptions).

### Changed
- `CURRENT_TASK.md` Session Notes: missing-specs blocker removed from "Blockers carried into the next session".
- Decided next session focus: scaffold monorepo + Next.js web app (`apps/web`) per `DEVSTACK.md` §1.1 + §6.

### Notes
- Phase 0 Database section is now **unblocked** — migrations 000000 → 000017 and the v1.1 migration set (20260502000000 → 20260502000017) can be applied in a future session.
- `RULES.md` §2 and `AGENT_RULES.md` §2 ("read `supabase_database.md` before any DB-related work") can now be satisfied.
- Active blockers remaining: Supabase region migration to `af-south-1` (see ADR-015), `viloplatform.com` domain ownership not confirmed.

## 2026-05-22 — Phase 0 — Monorepo scaffold + Next.js web app

### Built
- pnpm monorepo: root `package.json` (private), `pnpm-workspace.yaml` declaring `apps/*` + `packages/*`, `turbo.json` with build/dev/lint/type-check tasks, `tsconfig.base.json` for shared TS strict settings.
- `apps/web` — Next.js 14.2.35 App Router, TypeScript strict, Tailwind 3.4, no `src/` dir, `@/*` import alias. `tsconfig.json` extends the root base.
- Brand-token Tailwind config (`apps/web/tailwind.config.ts`): Vilo primary/secondary/accent/dark/light per `DESIGN_SYSTEM.md` §2 + status palette, custom border-radius (DEFAULT 10px, card 16px, pill, sm), Inter (sans) + Plus Jakarta Sans (display) via CSS variables, shadcn semantic tokens layered on top.
- `apps/web/app/globals.css` — shadcn-style HSL CSS variables tuned to Vilo brand (background = brand.light, foreground = brand.dark, primary = brand.primary).
- `next/font/google` wiring in `apps/web/app/layout.tsx` for Inter + Plus Jakarta Sans (zero layout shift, auto self-hosted).
- shadcn/ui configuration: `components.json` + `lib/utils.ts` (cn helper). Component installs (`pnpm dlx shadcn@latest add ...`) can proceed in any future session.
- Supabase SSR wiring per `ARCHITECTURE.md` §7:
  - `lib/supabase/client.ts` — `createBrowserClient` for Client Components.
  - `lib/supabase/server.ts` — `createServerClient` with Next.js cookie store for Server Components and Server Actions.
  - `lib/supabase/middleware.ts` — `updateSession` helper that refreshes the JWT cookie on each request.
  - `middleware.ts` — wires the helper into Next.js middleware with the standard matcher (skips `_next/static`, `_next/image`, favicon, common image asset paths).
- `apps/web/app/page.tsx` — Server Component homepage that fetches `/auth/v1/health` on the linked Supabase project; renders "OK — GoTrue v2.189.0" in green when reachable. Confirms the env vars load and the network path to Supabase works end-to-end.
- `packages/types` — workspace package with placeholder `database.types.ts`. Populated by `supabase gen types typescript` after DB migrations land.

### Changed
- Removed scaffold-default Geist fonts (`apps/web/app/fonts/`).
- Replaced the default Next.js boilerplate `page.tsx` and `globals.css` with brand-aligned versions.
- Copied root `.env.local` to `apps/web/.env.local` so Next.js can resolve `NEXT_PUBLIC_*` vars; both stay gitignored. Flagged in session notes — when `apps/mobile` lands, switch to a shared loader (dotenv-cli or `next.config.mjs` env merge) to avoid duplication.

### Notes
- **Verified end-to-end:** `pnpm --filter web build` and `pnpm --filter web lint` both pass with zero errors / zero warnings. Started dev server, curled `http://localhost:3000`, confirmed HTTP 200 and the rendered HTML contains the Supabase project URL plus a live "OK — GoTrue v2.189.0" connection signal from `/auth/v1/health`.
- **Node 22.17.1 in use.** `DEVSTACK.md` §1.4 locks Node 20 LTS; Next.js 14.2 is compatible with Node 22 so no blocker, but flagged for revisit.
- Minimal dep set installed — only what the homepage needs (`@supabase/supabase-js`, `@supabase/ssr`, `clsx`, `tailwind-merge`, `class-variance-authority`, `tailwindcss-animate`, `lucide-react`). The remaining `DEVSTACK.md` §6 deps (Mapbox, PayPal, Tiptap, react-big-calendar, Resend, react-email, Sentry, PostHog, sonner, react-dropzone, qrcode.react) will be added in the session that first uses each, per CLAUDE.md "least amount of code that solves the problem".
- Husky / lint-staged / Commitlint / Prettier are still pending — pick up in a polish session.

### Commits
- (Single commit for this slice — pushed to `main`.)

## 2026-05-22 — Phase 0 — DB schema live + CI workflows scaffolded

### Built
- **27 SQL migrations** applied to live Supabase (`zlcivjgvtyeaszikqleu`):
  - 18 v1.0 migrations (extensions, 9 domains, RLS helpers/policies, functions, triggers, cron, storage RLS, seed)
  - 9 v1.1 migrations (Policy Manager + Refund Manager domains, ALTERs, RLS, functions, triggers, cron, storage, seed)
- Full schema: 46 tables, 4 RLS helper functions, 8+ business functions (`check_feature_permission`, `calculate_booking_price`, `calculate_policy_refund_amount`, `snapshot_booking_policies`, `recalculate_listing_ranking`, etc.), 13+ triggers, 15 pg_cron jobs.
- Realtime publication enabled for `messages`, `conversations`, `bookings`.
- Storage RLS policies for 6 buckets (`listing-photos`, `host-avatars`, `host-covers`, `eft-proofs`, `message-attachments`, `refund-requests`) — buckets themselves still need to be created in the Supabase dashboard.
- `packages/types/database.types.ts` regenerated (3479 lines) — covers full schema.
- All 5 GitHub Actions workflows written per `CI_CD.md`:
  - `ci.yml` — PR validation (typecheck, lint, tests, E2E)
  - `db-migrate.yml` — auto-apply schema on push + auto-regen + auto-commit types
  - `deploy-functions.yml` — Edge Functions deploy
  - `deploy-web.yml` — Vercel deploy
  - `mobile-preview.yml` — EAS OTA on `develop`

### Fixed
- `gen_random_bytes()` calls qualified with `extensions.` schema in `staff_invites.token` and `reviews.review_token` defaults — Supabase puts pgcrypto in the `extensions` schema, not `public`, so unqualified calls fail.

### Notes
- **DB verified live:** queried `platform_settings` via PostgREST, all 10 seeded keys returned.
- Migrations follow the spec exactly except for one deviation: `blocked_dates` moved from the listings migration to the bookings migration to resolve a forward FK to `bookings(id)`.
- Single Supabase project (no staging yet) per ADR-015. The Frankfurt → af-south-1 migration is still required before public launch.
- **Vercel deploy failing:** the first push triggered a Vercel build that compiled cleanly but reported "No Output Directory named public found". Fix: in Vercel Project Settings → Build & Development Settings, set **Root Directory** to `apps/web`. Then redeploy. (Not done in this session — user-side action.)
- **Storage buckets still need to be created** by hand in the dashboard (Storage → New bucket). The RLS policies are already in place; they only activate once buckets exist.

### Active blockers / user-side actions for Phase 0
- Doppler account + dev/staging/prod configs
- Vercel root-dir fix + first successful deploy
- EAS account + `eas init` for `apps/mobile`
- Sentry projects (web + mobile)
- PostHog project
- Resend account + `viloplatform.com` domain verification (domain itself not yet registered)
- 6 Supabase Storage buckets

### Still TODO (autonomous in next session)
- Scaffold `apps/mobile` (Expo + NativeWind + Expo Router)
- Install shadcn/ui component set from `DESIGN_SYSTEM.md`
- Prettier + Husky + Commitlint config
- `emails/` directory + React Email setup
- Tighten Vercel monorepo config (`vercel.json` or root-dir setting)

### Commits
- `feat(db): add v1.0 schema migrations` — `7c1ec14`
- `feat(db): add v1.1 schema migrations (Refund + Policy Manager)` — `9fa4e67`
- `feat(db): apply 27 migrations + generate database.types.ts` — `c623cba`

## 2026-05-23 — Phase 0 — Mobile + shadcn + tooling + emails scaffolded

### Built
- **`apps/mobile`** scaffolded with Expo SDK 56 (newer than DEVSTACK's 51+ — modern stack, React Native 0.85, Expo Router pre-configured). Includes `src/app/` file-based routing, `eas.json` (development/preview/production profiles), `app.json` branded as Vilo, `.env.local` with `EXPO_PUBLIC_*` Supabase vars, and `src/lib/supabase.ts` using Expo SecureStore as the auth-storage adapter per `ARCHITECTURE.md` §7. Deps: `@supabase/supabase-js`, `expo-secure-store`, `react-native-url-polyfill`, `@tanstack/react-query`, `zustand`.
- **18 shadcn/ui components** installed in `apps/web/components/ui/` per `DESIGN_SYSTEM.md`: button, input, card, label, badge, skeleton, form, dialog, sonner, separator, avatar, alert, tabs, select, checkbox, textarea, dropdown-menu, sheet. Pulled in `react-hook-form`, `zod`, `@hookform/resolvers`, `sonner`, `next-themes`, and the relevant `@radix-ui/*` primitives as transitive deps.
- **Code quality tooling** at workspace root:
  - Prettier 3.8 + `prettier-plugin-tailwindcss` with `.prettierrc.json` (double quotes, trailing comma all, 80-col).
  - `.prettierignore` excluding generated files (lockfile, `database.types.ts`, migrations, `.next`, `.expo`, etc.).
  - Husky 9 with `.husky/pre-commit` running `lint-staged` and `.husky/commit-msg` running `commitlint --edit`.
  - `commitlint.config.js` extending `@commitlint/config-conventional` with Vilo's allowed types (feat, fix, chore, docs, refactor, test, style, perf, ci, build, revert, wip, migration).
  - Root `package.json` scripts: `format`, `format:check`, `prepare`; `lint-staged` config for `*.{ts,tsx,js,jsx}` and `*.{json,md,yml,yaml,css}`.
- **`@vilo/emails` workspace package** at `emails/` with React Email setup:
  - `components/Layout.tsx` — brand-styled shared layout (Vilo green/cream, Inter font, header + content + footer with email-preferences link).
  - `templates/WelcomeHost.tsx` — first of the 26 templates from `EMAIL_TEMPLATES.md` (host onboarding welcome).
  - `package.json` with `email dev`/`build`/`export` scripts.
  - `.gitignore` for `.react-email/` build output.

### Changed
- `pnpm-workspace.yaml` now declares `emails` alongside `apps/*` + `packages/*`.
- `apps/web` `lucide-react` pinned to `^0.469.0` (v1.x requires React 19 types — incompatible with our React 18). Fixed a build failure in `components/ui/checkbox.tsx`.

### Notes
- **NativeWind not configured yet.** It needs metro.config.js, babel.config.js, and tailwind.config.js wiring that's tightly coupled to actual UI work. Deferred to the first mobile UI session.
- **Expo's `default` template uses `src/`** (newer convention); `ARCHITECTURE.md` §4 shows `app/` at app root. Treating `src/app/` as the active path — when ARCHITECTURE.md is next edited, update §4 to match.
- The Vercel deploy is still failing because Vercel needs `Root Directory = apps/web` set in Project Settings. Not done in this session.
- Husky's `prepare` script logs `apps/web prepare: .git can't be found` — benign, can be silenced by removing the propagated `prepare` script from individual workspaces if it becomes noise.

### Phase 0 autonomous work — now complete
Everything I can do without external account access is done. Remaining items in Phase 0 all need user-side action (see PHASE_PLAN.md 👤 items).

## 2026-05-23 — Phase 0 — Vercel web deploy live

### Built
- **https://vilo2027.vercel.app/ is live.** First successful production deploy of `apps/web` — Server Component homepage renders the Foundation Status panel with a green Supabase connection check against the Frankfurt project.
- `apps/web/vercel.json` — explicit `"framework": "nextjs"` + `"outputDirectory": ".next"`. See ADR-017.
- `pnpm.overrides` block in root `package.json` pinning `@types/react@18.3.29` and `@types/react-dom@18.3.7` across the entire workspace. See ADR-016.

### Changed
- Vercel project `vilo2027` (org `wollie333s-projects`) connected to GitHub `Wollie333/Vilo2027`. Root Directory set to `apps/web`. Environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` populated for Production, Preview, and Development.
- `pnpm-lock.yaml` regenerated under the new overrides — single `@types/react@18.3.29` resolution for the web app's dep graph.

### Decisions
- **ADR-016** — `@types/react` pinned to v18 across the workspace despite Expo SDK 56 declaring v19 via its peer chain. Required to make `lucide-react` resolve to v18 types in `apps/web`, which fixed the `bigint`-in-`ReactNode` error in `components/ui/checkbox.tsx` during the Vercel build. Mobile runtime unaffected; mobile type-check may show false positives until revisited.
- **ADR-017** — `apps/web/vercel.json` introduced because Vercel's Turbo detection (`turbo.json` at workspace root) overrode Next.js framework auto-detection, causing the build to succeed but the deploy to fail with "No Output Directory named 'public' found".

### Notes
- **Two genuine bugs in the deploy chain were fixed by the build pipeline itself, not patched around.** The "wrong commit" deploy (Vercel building a stale `eedc69d`) was caused by the GitHub ↔ Vercel App lacking repo access while we pushed new commits; reconnecting the GitHub installation fixed it and the next push triggered an up-to-date build automatically.
- Sequence of issues + fixes during this session: (1) Root Directory not set → set to `apps/web` in dashboard; (2) GitHub auth broken → reconnected Vercel GitHub App, scoped to `Wollie333/Vilo2027`; (3) Vercel deploying stale commit → empty trigger commit `576875c`; (4) `@types/react` v18/v19 type collision → ADR-016 override; (5) Vercel Turbo detection overrode framework → ADR-017 `vercel.json`.
- The lint-staged pre-commit hook auto-reformatted `pnpm-lock.yaml` and `package.json` with Prettier on each commit. Cosmetic — the dep graph and override semantics are unchanged.

### Active blockers / user-side actions still open for Phase 0
- Doppler account + dev/staging/prod configs
- EAS account + `eas init` for `apps/mobile`
- Sentry projects (web + mobile)
- PostHog project
- Resend account + `viloplatform.com` domain verification (domain itself not yet registered)
- 6 Supabase Storage buckets (`listing-photos`, `host-avatars`, `host-covers`, `eft-proofs`, `message-attachments`, `refund-requests`)

### Commits
- `chore: trigger vercel rebuild` — `576875c`
- `fix(deps): pin @types/react to 18 across workspace to fix web build` — `657ddb8`
- `fix(vercel): pin framework to nextjs so Turbo detection doesn't override output dir` — `054c6b9`
- (this CHANGELOG + DECISIONS update — final commit of the session, appended after staging)

## 2026-05-23 — Phase 0 — Canonical design system adopted

### Built
- `Vilo Design System.html` (3914 lines, 290 KB) added at the repo root as the **canonical** source of truth for all Vilo UX/UI work. Replaces the inline token specs in earlier `DESIGN_SYSTEM.md` and `tailwind.config.ts` drafts.
- `apps/web/public/DESIGN_SYSTEM.HTML` — static mirror published via Next.js, accessible at https://vilo2027.vercel.app/DESIGN_SYSTEM.HTML.

### Changed
- `apps/web/tailwind.config.ts` rewritten to match the canonical tokens:
  - Brand palette: `primary #10B981`, `secondary/deep #064E3B`, `accent #D1FAE5`, `dark #0A1510`, `light #F0FDF4`, plus new `ink #052E1F`, `mute #4A7C6A`, `line #DCEAE0` tokens.
  - Status palette adjusted: `confirmed #10B981` (was `#22C55E` — now tracks brand primary).
  - Added `font-mono` family wiring to JetBrains Mono.
  - Added `shadow-card`, `shadow-lift`, `shadow-ring`, `shadow-glow`.
  - Added `transitionTimingFunction.out: cubic-bezier(0.2, 0.8, 0.2, 1)`.
  - Added `bg-brand-gradient`, `bg-brand-gradient-dark`, `bg-dot-grid` background-image utilities.
- `apps/web/app/globals.css` rewritten with the canonical CSS custom properties (light + dark mode), new utility classes (`bg-brand-gradient`, `bg-dot-grid`), and a global `prefers-reduced-motion` rule.
- `apps/web/app/layout.tsx` now loads JetBrains Mono alongside Inter + Plus Jakarta Sans via `next/font/google` and exposes it as `--font-jetbrains-mono`.
- `apps/web/app/page.tsx` (homepage) restyled to the new system: hero with brand gradient logo mark on a dot-grid background, status pill, Foundation Status card with `shadow-card` and `divide-y` rows, and a discoverable link to `/DESIGN_SYSTEM.HTML`.
- `DESIGN_SYSTEM.md` slimmed from a full token spec to a short pointer at the canonical HTML, with a quick-reference cheatsheet of utility names and the hard rules.

### Decisions
- **HTML is canonical.** When `DESIGN_SYSTEM.md` and `Vilo Design System.html` conflict, the HTML wins. Reasoning saved in memory `feedback_design_system_source.md`.
- Old primary `#1B4D3E` (a darker forest green) and amber secondary `#F4A836` from the previous Tailwind config are retired. The new palette is emerald-led, matching the canonical HTML and the live homepage hero.

### Notes
- Web build (`pnpm build`) and lint (`pnpm lint`) both pass with zero warnings.
- shadcn/ui components in `apps/web/components/ui/` were not edited — they consume the CSS custom properties (`--primary`, `--accent`, `--border`, etc.) and pick up the new palette automatically. Per ADR-006, never edit `components/ui/` directly.
- Mobile (`apps/mobile`) NativeWind config is not yet wired up — the design system applies there too, but the wiring is deferred to the first mobile UI session per CHANGELOG 2026-05-23 entry "Mobile + shadcn + tooling + emails scaffolded".

### Commits
- (single commit for this slice — pushed after this entry is staged.)

## 2026-05-23 — Phase 0 — Closeout: Storage, Doppler, EAS landed; Sentry/PostHog/Resend deferred

### Built
- **6 Supabase Storage buckets** created in the Vilo2027 project (`listing-photos`, `host-avatars`, `host-covers` public; `eft-proofs`, `message-attachments`, `refund-requests` private). MIME types and size limits per `supabase_database.md` §17. RLS policies were already applied in the v1.0 migration set; buckets now exist for them to protect. Verified via Storage REST API.
- **Doppler workspace `Vilo2027`**, project `vilo2027`, four configs (`dev`, `dev_personal`, `stg`, `prd`). Imported 18 secrets from `.env.local` (+ 3 Doppler-managed metadata vars) into each top-level config. Integrations connected: Vercel (`wollie333's projects`) and Supabase (`Mana` org). Active syncs: `dev` → Vercel Development env (last synced 13:47 UTC), `dev` → Supabase Edge Functions secrets (13:46 UTC). See Notes for the free-plan gap.
- **EAS project linked** to `apps/mobile`. UUID `50664ed2-d876-4edd-aab0-6a984fbdfca7` written to `app.json` at `expo.extra.eas.projectId`. `eas build` will pick this up when first invoked.

### Changed
- `apps/mobile/app.json` — `slug` changed from `vilo` to `vilo2027` to match the EAS project name (avoids slug-mismatch errors during `eas build`).
- `PHASE_PLAN.md` — Phase 0 marked closed out. New status emoji `🕑` introduced for "deferred-by-design (wire just-in-time)" items. Doppler / Vercel / Storage / EAS lines flipped to ✅. Sentry / PostHog / Resend lines flipped to 🕑 with explicit notes.
- `CURRENT_TASK.md` — fully rewritten to scope the next session (Phase 1 Auth: `/login` + `/register`).
- New memory: `project-doppler-state` capturing the sync gap and the 5 in-transcript tokens flagged for revocation.

### Decisions
- **Doppler free-plan limit accepted as a documented gap.** Doppler's Developer (free) plan caps at one sync per integration; we created the `dev` → Vercel Development sync first, then `stg` and `prd` sync attempts were rejected. Because all three Doppler configs hold identical values today (single Supabase project per ADR-015), the practical impact is nil — Vercel Production is still using the manually-set vars from the earlier deploy session, which match the Doppler `dev` values exactly. Revisit when Doppler is upgraded to a paid plan or when staging/production Supabase projects actually diverge (af-south-1 migration, ADR-015).
- **Sentry, PostHog, Resend all deferred by design.** No users → no errors / no analytics / no outbound emails worth instrumenting. Supabase Auth's built-in templates cover the auth-flow emails Phase 1 needs. Each will be wired just-in-time when its specific feature lands. Placeholder env vars exist in Doppler under the canonical names so adding values later is a one-step change.

### Notes
- 5 Doppler tokens were pasted in chat during the integration debugging (1 read-only Personal Token `dp.pt.P05SY…`, 4 Service Tokens `dp.st.{prd,stg,dev,dev_personal}.…`). All are scoped tightly so blast radius is minimal, but they should be revoked from the Doppler dashboard at convenience. Tracked in `project-doppler-state` memory.
- The Phase 0 closeout was originally scoped to also do Sentry/PostHog/Resend account setup. User opted to defer all three after seeing the Doppler dashboard friction. This deviates from the literal Phase 0 plan but aligns with the platform's "ship over block" guidance and CLAUDE.md's "use the least amount of code that solves the problem" principle — no need to wire telemetry for a service with zero users.

### Commits
- (this commit — closeout + docs update; pushed to main after staging.)

<!-- New entries go above this line -->
