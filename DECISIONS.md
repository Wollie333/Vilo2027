# Vilo Platform — Architecture Decision Records

**Version:** 1.0
**Last Updated:** May 2026

This file records every significant technical decision made for the Vilo platform — what was chosen, what was considered, and why. When an agent suggests changing something, check here first. If there's an ADR for it, the decision is locked unless explicitly reopened.

**Format:** Each ADR has a status — `Accepted` (locked), `Superseded` (replaced by a later ADR), or `Proposed` (still being decided).

---

## ADR-001 — Next.js 14 with App Router (not Pages Router)
**Status:** Accepted
**Date:** May 2026

**Decision:** Use Next.js 14 App Router exclusively. No Pages Router.

**Reasons:**
- React Server Components enable fast, zero-JS public pages (directory, listing detail) — critical for SEO and guest experience
- Streaming + Suspense for progressive loading
- Built-in middleware for auth guards per route group
- Server Actions eliminate the need for custom API routes for mutations
- First-class Vercel deployment

**Rejected alternatives:**
- Pages Router: legacy, no RSC, mixing paradigms in one codebase is a maintenance trap
- Remix: strong contender but smaller ecosystem, less Supabase tooling
- SvelteKit: team is TypeScript/React native, switching languages mid-project adds risk

**Constraint:** Never add Pages Router files. If something "doesn't work" in App Router, fix it properly — don't fall back to Pages Router.

---

## ADR-002 — Supabase as the complete backend (no custom server)
**Status:** Accepted
**Date:** May 2026

**Decision:** Supabase handles auth, database, storage, realtime, and serverless functions. No Express/Fastify/NestJS server.

**Reasons:**
- Eliminates infrastructure overhead at MVP scale
- RLS provides database-level security — more reliable than application-level checks
- Edge Functions run on Deno globally — better latency than a single-region server
- Realtime is built-in — no separate WebSocket server needed
- pg_cron handles all scheduled jobs — no separate job queue (Bull, etc.)

**Rejected alternatives:**
- Express + PostgreSQL: requires separate hosting, more DevOps, no built-in auth/realtime/storage
- Firebase: weaker SQL, no complex queries, no RLS, pricing model less predictable
- PlanetScale + custom server: MySQL-based, no native full-text search or PostGIS

**Constraint:** Never add a custom server. If a use case requires server-side code that can't be an Edge Function, reconsider the use case first.

---

## ADR-003 — Paystack as primary payment provider (not Stripe)
**Status:** Accepted
**Date:** May 2026

**Decision:** Paystack for ZAR card payments and host subscription billing. PayPal for international guests.

**Reasons:**
- Paystack is built for African markets — native ZAR support, no currency conversion overhead
- Paystack Subscriptions API is simpler than Stripe for our use case
- Lower transaction fees in South Africa vs Stripe
- PayPal is the default international fallback that guests trust globally

**Rejected alternatives:**
- Stripe: higher fees in SA, ZAR support is through currency conversion, no direct SA entity
- Peach Payments: solid SA option but smaller developer ecosystem and docs
- Yoco: point-of-sale focus, weaker API for subscriptions and webhook workflows

**Constraint:** Never propose switching to Stripe. The payment provider decision affects the entire webhook + subscription infrastructure and is not reversible without significant rework.

---

## ADR-004 — pnpm as package manager (not npm or yarn)
**Status:** Accepted
**Date:** May 2026

**Decision:** pnpm 9.x for all package management across the monorepo.

**Reasons:**
- Native monorepo workspace support via `pnpm-workspace.yaml`
- Faster installs and lower disk usage via content-addressable storage
- Strict dependency isolation (no phantom dependencies)
- Turborepo integrates well with pnpm workspaces

**Constraint:** Never use `npm install` or `yarn add`. If a dependency requires npm, reconsider whether it's the right dependency.

---

## ADR-005 — Zustand for client state + TanStack Query for server state
**Status:** Accepted
**Date:** May 2026

**Decision:** Zustand for UI/interaction state, TanStack Query for data fetching and caching.

**Reasons:**
- Zustand: zero boilerplate, works identically in React and React Native, tiny bundle (~1KB)
- TanStack Query: handles caching, background refetch, optimistic updates cleanly
- Separation of concerns: Zustand = "what the UI is doing right now", TanStack Query = "what the data looks like"
- Both work in Next.js App Router without SSR complications

**Rejected alternatives:**
- Redux: massive boilerplate overhead for MVP scale
- Context API alone: performance issues with frequent updates (inbox unread counts, realtime)
- SWR: less powerful than TanStack Query for complex cache management
- Jotai/Recoil: good but less adoption in React Native

**Constraint:** Never put remote data in Zustand stores. Zustand is for UI state (modals, filters, auth session metadata, booking flow step). Data from Supabase lives in TanStack Query.

---

## ADR-006 — shadcn/ui (not a traditional component library)
**Status:** Accepted
**Date:** May 2026

**Decision:** shadcn/ui as the component foundation — components are copied into the codebase, not imported from a package.

**Reasons:**
- Full ownership — components live in the repo, no upstream version lock-in
- Fully accessible (Radix UI primitives beneath)
- Completely unstyled by default — Tailwind tokens apply cleanly
- Easy to customise for Vilo's brand without fighting library defaults

**Rejected alternatives:**
- MUI / Ant Design / Chakra: heavy, opinionated styling that fights Tailwind
- Headless UI: fewer components, less active development
- Building from scratch: unnecessary at MVP scale

**Constraint:** Never modify files in `components/ui/` directly. Extend via wrapper components. Never install a second component library alongside shadcn.

---

## ADR-007 — React Email for email templates (not MJML or hosted services)
**Status:** Accepted
**Date:** May 2026

**Decision:** React Email + Resend SDK for all transactional emails.

**Reasons:**
- React Email templates are type-safe components — props are checked at compile time
- Same language as the rest of the codebase — no context switching
- Resend is developer-first, reliable, and has a generous free tier
- Local preview via `npx email dev` speeds up iteration

**Rejected alternatives:**
- MJML: XML syntax, separate toolchain, not TypeScript-native
- SendGrid / Mailchimp: heavier platforms, no first-class React support
- Raw HTML strings: unmaintainable, no type safety, no preview

**Constraint:** All email templates must be React components in `emails/`. Never send raw HTML strings to Resend. See `EMAIL_TEMPLATES.md` for the full spec.

---

## ADR-008 — Soft deletes for critical records (not hard deletes)
**Status:** Accepted
**Date:** May 2026

**Decision:** `user_profiles`, `hosts`, `listings`, and `bookings` use soft deletes via `deleted_at timestamptz`. Hard deletes only on verified POPIA/GDPR deletion requests, logged first.

**Reasons:**
- Booking history must be preserved for financial audit
- Referential integrity — hard-deleting a host would orphan payment records
- POPIA requires data deletion on request — but this is an exception flow, not the default
- Soft deletes enable "undo" in admin operations

**Constraint:** Never write `DELETE FROM` for these tables in application code. Any migration that adds a hard delete to these tables requires explicit human sign-off.

---

## ADR-009 — Policy snapshots are immutable (never updated)
**Status:** Accepted
**Date:** May 2026

**Decision:** `policy_snapshots` are written once at booking time and never modified. They are the legal record of what the guest agreed to.

**Reasons:**
- A host can change their cancellation policy at any time
- Without snapshots, a guest who booked under "Moderate" could be retroactively subject to "Strict"
- Refund calculations must use the policy at booking time — the `calculate_policy_refund_amount` function reads from snapshots, not current policy

**Constraint:** No `UPDATE` or `DELETE` policies exist on `policy_snapshots`. Any code that attempts to modify a snapshot is a bug and must be rejected.

---

## ADR-010 — Feature permissions via database RPC (not hardcoded plan logic)
**Status:** Accepted
**Date:** May 2026

**Decision:** All feature gating goes through the `check_feature_permission` RPC. Plan logic is stored in `plan_features` table. Super Admin can change permissions at runtime without a code deploy.

**Reasons:**
- Plan structure may change — hardcoded `if plan === 'pro'` checks become a maintenance nightmare
- Per-host overrides (sales, courtesy, testing) are possible without code changes
- Feature changes deploy in seconds from the admin panel
- Consistent: same function used in Edge Functions and UI components

**Constraint:** Never write `if (subscription.plan === 'pro')` anywhere. Always call `check_feature_permission`. See `AGENT_RULES.md` Section 3.

---

## ADR-011 — Monorepo with Turborepo (not separate repos)
**Status:** Accepted
**Date:** May 2026

**Decision:** Single monorepo containing web app, mobile app, and shared packages. Turborepo for build orchestration.

**Reasons:**
- Shared types, schemas, and utilities without publishing to npm
- Single PR covers web + mobile changes for cross-platform features
- Atomic commits across packages
- Turborepo caches build artifacts — CI is fast

**Rejected alternatives:**
- Separate repos: shared code requires a private npm registry or git submodules — both are painful
- Nx: more powerful than needed at MVP scale, higher learning curve

---

## ADR-012 — Doppler for secrets management (not `.env` files committed to git)
**Status:** Accepted
**Date:** May 2026

**Decision:** All environment variables are managed in Doppler. `.env` files are never committed. `.env.example` is committed as documentation only.

**Reasons:**
- Single source of truth for secrets across dev, staging, and production
- Doppler → Vercel integration syncs production env vars automatically
- Doppler → GitHub Secrets integration feeds CI/CD
- Audit trail for who changed which secret and when

**Constraint:** Never commit a `.env.local`, `.env.production`, or any file containing real secret values. If a developer needs local env vars, they run `doppler setup` and use `doppler run -- pnpm dev`.

---


## ADR-013 — Mapbox for maps (not Google Maps)
**Status:** Accepted
**Date:** May 2026

**Decision:** Mapbox GL JS (`mapbox-gl` + `react-map-gl`) for web maps. `react-native-maps` with Google Maps provider for mobile.

**Reasons:**
- Cleaner React integration via `react-map-gl` — first-class hooks and components
- More affordable at MVP scale — free tier covers early traffic
- Better visual customisation to match Vilo's brand colours
- `react-map-gl` abstracts the Mapbox API cleanly for RSC-compatible usage

**Rejected alternatives:**
- Google Maps JS API: heavier, more expensive at scale, less elegant React integration
- Leaflet: open-source but weaker mobile story and no built-in clustering

**Constraint:** All map code goes through `react-map-gl` abstractions. Never call `mapboxgl` directly in components. Token must never be on the server — it's a `NEXT_PUBLIC_` variable and is intentionally public (restricted by allowed URLs in Mapbox dashboard).

---

## ADR-014 — iCal (RFC 5545) for external calendar sync (not custom API)
**Status:** Accepted
**Date:** May 2026

**Decision:** Use the iCal standard (RFC 5545 `.ics` format) for two-way calendar sync with external booking platforms.

**Reasons:**
- Universal support: Airbnb, Booking.com, VRBO, Expedia, Google Calendar, Apple Calendar all support iCal import/export natively — no custom integrations needed
- Zero API keys or OAuth flows required for external platforms — a URL is all that's needed
- Stateless: each sync is a fresh fetch and diff — no webhooks, no persistent connections to maintain
- Hosts are already familiar with the concept ("copy your iCal link") from existing platforms

**Rejected alternatives:**
- Custom webhook sync per OTA (Airbnb API, Booking.com API): each requires separate API approval, OAuth, and maintenance. Months of work per platform.
- Channel manager integration (e.g. Lodgify, Hostaway): adds a third-party dependency and monthly cost
- Real-time bidirectional sync: over-engineered for MVP — polling every 15 minutes is sufficient to prevent double bookings

**Constraint:** The iCal implementation is defined in `BOOKING_SYNC.md`. All changes to sync logic, feed format, or the `ical_feeds` table must be reviewed against that spec. Never build per-OTA API integrations in MVP scope.

---

## ADR-015 — Supabase region: Central EU (Frankfurt) at bootstrap, af-south-1 deferred
**Status:** Accepted (revisit before public launch)
**Date:** 2026-05-22

**Decision:** Provision the development Supabase project in `Central EU (Frankfurt)` instead of `af-south-1 (Cape Town)` as `SECURITY_CHECKLIST.md` §10 requires.

**Reasons:**
- `af-south-1` was not offered as a region option in the Supabase dashboard for this account at project creation time — likely a Free-tier availability constraint or a per-organization restriction
- Frankfurt is the closest fully-available alternative geographically and latency-wise for South African users
- The project is empty — no user data is stored against this region yet, so the migration cost remains low while the project stays in this state
- Blocking the entire Phase 0 setup on region availability would stall the project indefinitely; bootstrapping in Frankfurt unblocks all early development

**Rejected alternatives:**
- Waiting for `af-south-1` access (no clear path to enable it on the current plan)
- North EU (Stockholm) / East US — further from SA users
- Self-hosted Supabase in a SA datacenter — defeats ADR-002 (Supabase managed)

**Constraint:**
- **Before public launch**, the production database MUST be migrated to `af-south-1` to satisfy `SECURITY_CHECKLIST.md` §10 (POPIA compliance). Strategies: `pg_dump` + restore to a new project, or use Supabase's project clone feature if it lands. Validate cross-region transfer of any personal data with legal before users are added.
- All new schema, RLS policies, and storage buckets created in Frankfurt must be re-applied to the `af-south-1` project at migration time — keep migrations idempotent and the seed data clean.
- Add `[ ] Migrate Supabase to af-south-1 before launch` to `PHASE_PLAN.md` Phase 5 — Launch Readiness when that section is next edited.
- Do NOT add personal data (real guest/host PII) to the Frankfurt project. Test data only.

---

## ADR-016 — Pin `@types/react` to v18 across the workspace via pnpm overrides
**Status:** Accepted (revisit when mobile type-checking matters)
**Date:** 2026-05-23

**Decision:** Add `pnpm.overrides` to root `package.json` pinning both `@types/react` and `@types/react-dom` to `18.3.x` for the entire workspace, despite `apps/mobile` (Expo SDK 56) declaring React 19 via its dependency chain.

```json
"pnpm": {
  "overrides": {
    "@types/react": "18.3.29",
    "@types/react-dom": "18.3.7"
  }
}
```

**Reasons:**
- `apps/web` declares `@types/react@^18`. `apps/mobile` peers `@types/react@19.2.x` via Expo SDK 56 / React Native 0.85. Without the override, pnpm resolves both into the workspace store.
- During the Vercel build, `lucide-react` resolved its `@types/react` to the v19 graph, while the Next.js JSX context resolved to v18. The mismatch surfaced as `Type 'bigint' is not assignable to type 'ReactNode'` in `components/ui/checkbox.tsx` (v19's `ReactNode` includes `bigint`; v18's does not).
- Pinning to v18 globally fixes the web `tsc` pass without breaking the mobile **runtime** — Expo bundles React 19 at runtime from the `react` package, which is independent of `@types/react`.
- Web is the immediately deploying surface (live at https://vilo2027.vercel.app/ as of this ADR). Blocking the launch to redesign workspace isolation is not warranted at MVP scale — this is a reversible workaround.

**Rejected alternatives:**
- **Upgrade web to React 19 + `@types/react@19`:** Next.js 14.2 supports React 19, but the broader stack (shadcn/ui generated components, Tailwind plugins, third-party Radix peers in the lockfile) was tested against React 18 and a full upgrade would expand this session's scope significantly.
- **Per-app pnpm workspace isolation (`nodeLinker: "isolated"`, `publicHoistPattern`):** more correct long-term but requires deeper pnpm config work and may break shadcn's expectations around hoisted Radix peers. Not justified for an MVP unblocker.
- **`skipLibCheck: true`:** doesn't help — the error is in user code (`components/ui/checkbox.tsx`), not a library file.
- **`typescript.ignoreBuildErrors: true` in `next.config.mjs`:** masks every future type error, not just this one. Violates CLAUDE.md "no `any`" spirit.

**Constraint:**
- Mobile-side TypeScript may report v18/v19 mismatches in editor and `tsc`. The Expo Metro bundler does **not** type-check at build time, so production builds (`eas build`) are unaffected. When mobile's type story becomes a quality bar (CI type-check, contributor DX), revisit by either (a) upgrading web to React 19 or (b) introducing scoped overrides that target only `apps/web`.
- If a third package legitimately needs the v19 `bigint`-in-`ReactNode` semantics (vanishingly unlikely at this stage), revisit before forcing a workaround on top of this one.
- Removing or weakening the override requires regenerating the lockfile and reproducing a clean Vercel build of `apps/web` before merging.

Related: this override layers on top of the existing `apps/web` choice to pin `lucide-react` to `^0.469.0` (last release built against React 18 types). See CHANGELOG entry for 2026-05-23 "Mobile + shadcn + tooling + emails scaffolded".

---

## ADR-017 — Pin Vercel framework to `nextjs` via `apps/web/vercel.json`
**Status:** Accepted
**Date:** 2026-05-23

**Decision:** Commit `apps/web/vercel.json` containing:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

This file lives inside the Vercel Root Directory (`apps/web`) so it is loaded as the project's effective Vercel config.

**Reasons:**
- The repo contains a `turbo.json` at the workspace root. Vercel's build pipeline detects Turbo and prints `Detected Turbo. Adjusting default settings...` early in the build.
- With Turbo detection active and no explicit framework declaration, Vercel skipped Next.js framework auto-detection and fell back to treating the build output as a static site. The build completed (`next build` succeeded, all 5 pages emitted to `apps/web/.next`), but the deploy then failed with `No Output Directory named "public" found after the Build completed.`
- Declaring `framework: "nextjs"` explicitly re-asserts the framework regardless of Turbo detection. Declaring `outputDirectory: ".next"` is redundant but makes the intent explicit and protects against future changes to Vercel's Next.js defaults.

**Rejected alternatives:**
- **Set Framework Preset = Next.js in the Vercel dashboard:** equivalent effect, but invisible to anyone reading the repo and not reproducible if the project is recreated or re-linked. Source-controlled config is preferred per ADR-012's general "single source of truth" principle.
- **Remove `turbo.json` to stop Turbo detection:** Turborepo is the chosen build orchestrator (see ADR-011). Removing it to placate Vercel reverses a more important decision.
- **`vercel.json` at the repo root:** when Root Directory is set to `apps/web`, Vercel reads `apps/web/vercel.json`, not the root one. Placing it at the root would have no effect.

**Constraint:**
- Do not delete `apps/web/vercel.json`. If the file disappears, the deploy will silently fail with the "No Output Directory" error again on the next build that re-detects Turbo.
- Any future Vercel projects in this monorepo (e.g. a separate admin app under `apps/admin`) need their own `vercel.json` with the same framework declaration.
- If the build command is ever customised (e.g. to pre-generate types), add it to this file as `buildCommand` rather than to the Vercel dashboard, for the same reproducibility reason.

Related: this is the second of two fixes that took the web app live in the 2026-05-23 deploy session — see ADR-016 and the corresponding CHANGELOG entry.

---

*When making a new significant decision — add an ADR here before writing code. Format: status, date, decision, reasons, alternatives rejected, constraint.*
