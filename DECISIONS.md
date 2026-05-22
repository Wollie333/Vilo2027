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

*When making a new significant decision — add an ADR here before writing code. Format: status, date, decision, reasons, alternatives rejected, constraint.*
