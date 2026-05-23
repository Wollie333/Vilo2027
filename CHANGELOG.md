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

<!-- New entries go above this line -->
