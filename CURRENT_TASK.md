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
- [x] Vercel deploy goes green on push to main. *(verified: /login 200, /register 200, /dashboard 307→/login)*
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

## Session Notes — 2026-05-24 — Banking & business details

### What landed (out of original auth scope — user-authorised deviation)
- New `/dashboard/settings/banking` page with multi-account banking
  management (one default enforced via partial unique index) plus a tax/
  business form (VAT, company reg, billing address).
- AES-256-GCM at the application layer — `BANKING_CIPHER_KEY` required;
  Node impl at `apps/web/lib/crypto/banking.ts`, Deno impl at
  `supabase/functions/_shared/banking-crypto.ts`, same wire format
  (`v1.<nonce>.<ct>.<tag>`).
- Edge Function `eft-banking-details` gates by booking ownership +
  `payment_method='eft'` + status `pending_eft`/`pending_eft_review` per
  `AGENT_RULES.md` §4.4.
- Invoices and quotes now render the issuer's banking + tax info on the
  PDF; invoices snapshot at issue time, quotes use live data.
- Migration: `20260525000001_banking_and_business_details.sql` — reshapes
  `eft_banking_details`, adds `host_business_details`, updates the
  invoice trigger, seeds `banking_details` feature key across plans.

### Pickup
- Set `BANKING_CIPHER_KEY` in Doppler dev (`openssl rand -base64 32`,
  then `doppler secrets set BANKING_CIPHER_KEY=...`).
- `supabase db reset` then `supabase gen types typescript --local >
  packages/types/database.types.ts`.
- The Edge Function deploys via the existing `deploy-functions.yml` on
  next push; no extra wiring.

---

## Session Notes — 2026-05-24 — Super Admin Control Centre · Phase A foundation

### What landed (out of original auth scope — user-authorised deviation)
- **RBAC migration** `20260525000002_create_platform_staff_rbac.sql` —
  new tables `admin_roles`, `admin_permissions`, `admin_role_permissions`,
  `platform_staff`, `platform_staff_invites`. Seeded 5 roles
  (`super_admin`, `support_agent`, `finance`, `content_mod`, `ops`) and
  17 permission keys (`domain.action`).
- **`is_super_admin()` replaced** to read from `platform_staff` and require
  AAL2. Signature unchanged so existing `admin_full_*` RLS policies still
  work. New helper `has_admin_permission(p_key)`.
- **Founder auto-seeded** into `platform_staff` as `super_admin` on
  migration. Aborts loudly if the user_profile row is missing.
- **`apps/web/lib/admin/`** — `requireAdmin()`, `requirePermission()`,
  `hasPermission()`, `withAdminAudit()` wrapper, `openImpersonationSession`
  / `closeImpersonationSession`, HMAC-signed impersonation cookie,
  error classes.
- **`/admin` route group** — layout with sidebar / topbar / impersonation
  banner, KPI dashboard at `/admin`, audit log viewer at `/admin/audit`,
  Vilo staff management at `/admin/platform/staff`, placeholder pages for
  every other section (each exercising its `requirePermission()` gate).
- **View-only impersonation** at `/admin/as/[userId]/dashboard` —
  service-role queries scoped by URL param, NO auth-cookie swap.
- **Break-glass:** `supabase/scripts/grant-super-admin.sql` re-grants the
  founder when locked out.
- **`AGENT_RULES.md` §6.4–6.8** added: RBAC via `has_admin_permission`,
  AAL2 required, reason-required on destructive actions, view-only
  impersonation, atomic finance/moderation actions.

### Pickup
- **Apply the migration locally** once Docker is up:
  `supabase db reset` then
  `supabase gen types typescript --local > packages/types/database.types.ts`.
- Build + lint + type-check all pass in this session. The new RBAC tables
  are typed as `any` in the queries until types are regenerated — that
  hasn't broken strict mode but should be regenerated before Phase B
  starts so Supabase queries get proper auto-completion.
- **Phase B next:** users / hosts search + detail pages, then `/admin/as/`
  read-only views for listings / calendar / inbox.
- **Phase C–E roadmap:** see `~/.claude/plans/feature-super-admin-inherited-spark.md`
  — edit powers (shell-and-injection refactor of existing dashboard tabs);
  refund + subscription + reviews admin (atomic via Edge Function);
  platform_settings + plan_features editors + staff invite UI.
- The plan agent flagged one carry-over for Phase E: monthly CSV export of
  `admin_audit_log` to Storage. Spec is ready; ship the cron when the
  rest of platform settings lands.

---

## Session Notes — 2026-05-24 — Seasonal pricing MVP

### What landed
- New top-level **Seasonal pricing** dashboard tab inserted directly under
  Rooms in `_components/Sidebar.tsx`. Lives at `/dashboard/seasonal-pricing`.
- Hosts can create date-range price rules scoped either to a whole listing
  or a single room, with per-rule **min_nights** override, **priority**
  integer (highest wins on overlap), active/inactive toggle, and overlap
  warning + live nightly-total preview in the dialog.
- Server Actions in `apps/web/app/dashboard/seasonal-pricing/{actions,schemas}.ts`,
  gated by `check_feature_permission('seasonal_pricing')` — currently
  enabled across every plan so the founder's free test account works.
- Migration `20260524000008_seasonal_pricing_v2.sql` ALTERs
  `listing_seasonal_pricing` (adds `room_id`/`min_nights`/`priority`/
  `is_active`/`updated_at` + indexes), replaces `calculate_booking_price()`
  with an optional `p_room_id` arg + priority-ordered rule lookup, and adds
  `get_min_nights_for_stay()`.

### Decisions
- **Overlap policy:** allow overlaps with explicit priority field (user's
  choice over block-at-save or highest-price-wins).
- **Per-rule min-nights** included as MVP — industry standard for peak
  seasons (Christmas etc.).
- **Feature gate open to every plan for now** with the gating wiring in
  place; flippable later by a one-row `plan_features` UPDATE.
- **Room rules beat listing rules** on the same night, then priority
  decides. Mirrors `listing_addons` precedence.
- Used native `<input type="date">` rather than a shadcn Calendar popover
  to keep the dialog tight for MVP.

### Next-session pickup
- Run `supabase db reset` to apply the migration locally, then
  `supabase gen types typescript --local > packages/types/database.types.ts`
  to regenerate types (the new columns are present in types but the
  `calculate_booking_price` / `get_min_nights_for_stay` RPC signatures
  in `database.types.ts` are still the pre-migration shape — harmless
  for now since nothing in TS calls them, but worth regenerating).
- **Pre-existing build blocker:** the in-progress "room enterprise
  fields" feature (uncommitted) breaks `pnpm build` at
  `tabs/RoomsManager.tsx:81` — `EditorRoom` literal is missing
  `room_size_sqm`, `view_type`, `experiences`, `has_ensuite_bathroom`,
  and 7 more fields added by `schemas.ts`. Needs the room-feature
  author to finish the literal. Seasonal-pricing code itself
  passes `tsc --noEmit` cleanly.
- Wire `calculate_booking_price()` + `get_min_nights_for_stay()` into
  the eventual `booking-create` Edge Function (Phase 2).

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
