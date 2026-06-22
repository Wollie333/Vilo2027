# Vilo

**Direct-booking management for accommodation hosts and experience operators in South Africa.**

Vilo gives hosts a professional, branded booking website and a private dashboard to manage listings, bookings, calendars, payments, quotes, invoices, guest communication and reviews — all in one place. Zero booking commission, flat subscription only. Guests discover and book hosts directly via the Vilo Directory, a host's shareable profile, or the host's own published website.

> **Status:** pre-MVP, under active build. **No real users / no production data yet** — every table is treated as empty (see the pre-MVP data policy in [`CLAUDE.md`](./CLAUDE.md)). Live dev deploy: https://vilo2027.vercel.app
> See **[Build status](#build-status)** for an honest, code-level breakdown of what works today.

---

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js 14.2 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, Zustand, React Hook Form + Zod |
| Mobile app | Expo (SDK 51+) — scaffolded, screens not yet built |
| Backend | Supabase (PostgreSQL 15, Auth, Realtime, Storage) |
| Server logic | **Next.js Server Actions** + API-route workers (the bulk of business logic); Supabase **Edge Functions** (Deno) only where a non-Next runtime is required — `paystack-webhook`, `eft-banking-details`, `report-scheduler`, `track-listing-view` |
| Payments | **Paystack (ZAR)** — live in checkout; **Manual EFT** — live; PayPal — host config only, not yet wired into guest checkout |
| Email / notifications | Resend + React Email, dispatched via an in-app / email / push notification queue drained by pg_cron (atomic claim — see below) |
| Calendar sync | RFC 5545 iCal **import** (external feeds → blocked dates) + **export** (public per-listing feed) |
| Package manager | **pnpm 9** (Node ≥ 20) |
| Hosting | Vercel (web) |

---

## Project structure

```
vilo/
├── apps/
│   ├── web/          # Next.js 14 web app (host dashboard, guest portal, admin, public + tenant sites)
│   └── mobile/       # Expo app — scaffolded, not yet built
├── packages/
│   ├── types/        # Shared TS types (auto-generated from the DB)
│   ├── schemas/      # Shared Zod validation schemas
│   └── utils/        # Shared pure utilities
├── supabase/
│   ├── functions/    # Edge Functions (Deno) — paystack-webhook, eft-banking-details,
│   │                 #   report-scheduler, track-listing-view
│   └── migrations/   # SQL migrations (timestamped, append-only — never edited)
└── *.md              # Project docs (see Documentation below)
```

---

## Getting started

> **No local Docker / Supabase stack.** Migrations are applied directly to the linked
> cloud project and types are generated from it. Do **not** run `supabase start` / `supabase db reset`.

### Prerequisites
- Node.js 20+, `pnpm` 9, the Supabase CLI, and access to the linked Supabase project.

### Setup
```bash
pnpm install
cp .env.example apps/web/.env.local   # fill in values — see ENV_VARS.md
```

### Database (linked cloud project — no Docker)
```bash
supabase db push --linked            # apply pending migrations to the cloud project, in order
supabase migration list --linked     # verify local + remote are in sync
# Regenerate types after a schema change (stdout only — never pipe stderr in):
supabase gen types typescript --linked > packages/types/database.types.ts
```

### Run the web app
```bash
cd apps/web
pnpm dev        # → http://localhost:3000   (tenant site: /en/site?site=<subdomain>)
pnpm lint       # zero warnings required
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm build      # production build — run ONLY when no dev server is up (shares .next)
```

### Test fixture (manual QA)
```bash
cd apps/web && pnpm seed:test-site   # idempotent; seeds the linked cloud DB
# Logs in: host@vilotest.com / ViloTest123!  (+ guest@vilotest.com)
# 1 guesthouse + 3 rooms + reviews + bookings + a PUBLISHED Aria-theme website (subdomain "vilotest")
```

---

## Build status

_Honest, code-level snapshot — **2026-06-22**. Percentages are share of MVP scope **wired in code** (UI → Server Action/RPC → real DB), not "verified in production." Build priority: **Host dashboard → Website CMS → Guest portal → Admin**._

### Host dashboard — ~85% of MVP scope wired
**Working (UI + action + DB):** email/password auth & login; host onboarding/setup checklist; **listing editor** (basic, photos→Storage, location, rooms, amenities, pricing, **seasonal pricing**, policies, add-ons, guest access); availability **calendar** + block dates; **bookings** list + detail + full lifecycle (confirm / decline / cancel / check-in / check-out, policy-based refund); **quotes** (create → send → open-tracking → convert to booking); **invoices + credit notes** (+ PDF); **payments** + EFT settle; **host-side refunds**; **coupons**; **host inbox** (realtime); **reviews** + replies; **settings** (profile, multi-business banking incl. own Paystack/PayPal credentials, notification prefs); **staff** invites; **help centre**; in-app + email + push **notifications**.
**Partial:** subscription page (plan **state machine only — no real billing calls yet**); data export/deletion (UI + soft-delete; fulfilment partial). Reports/analytics dashboards render but report-generation is a placeholder.

### Website CMS (host's own site) — substantial, the largest recent lane
A full per-host website builder with a **frozen publish snapshot** (drafts never leak to the live site):
- **Curated section system** + a simple in-page **builder** (@dnd-kit) with **free elements** (heading/text/image/button/spacer/divider + columns), **per-block responsive style** (padding/margin/border/radius/max-width/background/section-height), and inline header/footer/menu editing.
- **7 professionally-designed, responsive hero layouts** (Spotlight, Split ×2, Full-screen, Minimal, Boxed, Search) with overlay/text-tone/height controls, surfaced as pickable sidebar cards.
- **Theme-attached designed sections + page templates** (code-defined registry; the Aria flagship theme ships designed sections + Home/About templates).
- **Searchable add-blocks sidebar**; **site width** toggle (full vs boxed); Brand Studio + Theme gallery.
- **Pages / Blog / Forms** managers + full-screen editors; **SEO** (Yoast-style coach + Schema.org JSON-LD + canonical/sitemap); **Domains** (subdomain + custom-domain flow, dormant until ops env set).
- **Conversion**: WhatsApp click-to-chat, announcement bar, pop-ups, **on-site checkout** (Paystack + EFT), forms → inbox/CRM.
- **GA4 + Meta Pixel** with a POPIA consent gate; baseline security headers; Cloudflare Turnstile (inert until keys).

### Guest portal & public site — ~72%
**Working:** marketing home; **`/explore`** directory (search/filter/sort) + `/deals`; **listing detail**; host public profile `/[handle]`; **booking flow** with server-side re-pricing, capacity + policy checks, coupons; **Paystack checkout + automatic EFT fallback**; success/failed; guest sign-up + account-at-checkout; **My Trips** + Trip Details; cancel + request refund; **reviews**; **public quote** accept/decline; account notification prefs + POPIA deletion request; published **tenant websites** render end-to-end.
**Not wired:** guest inbox is read-only (no compose); PayPal not offered at guest checkout.

### Admin panel — ~82%
**Working:** dashboard KPIs; host/user management + verify/suspend; booking + payment (read) management; review moderation; subscriptions (read); **impersonation** (signed cookie, expiry + target, audit-logged); **audit log**; broadcasts + individual notification send; full **help-centre CRUD**; per-action permission gates.
**Not wired (stubs):** feature-flag-override + platform-settings editors. _(Admin MFA gate intentionally disabled pre-MVP — restore before launch.)_

### Platform infrastructure
**Working:** **notification system** (in-app + email via Resend drain + push queue; per-category prefs, quiet hours, digest) — drains now use an **atomic claim** (`FOR UPDATE SKIP LOCKED` + stale-reclaim) so overlapping cron ticks can't double-send; **calendar sync** — iCal **import** (atomic, non-destructive `import_ical_blocks` RPC; never overwrites a booking/manual block) + token-gated **export** feed; **pg_cron** jobs (booking expiry, auto-cancel, review publish/request, subscription warn/restrict, ranking, queue drains); **Paystack webhook** (HMAC-SHA512 verified, idempotent on `provider_reference`); EFT banking-details + report-scheduler (secret-gated) + track-listing-view (validated) Edge Functions; RLS + soft-delete across core tables; immutable audit log.
**Gaps:** subscription billing is a no-op (no provider create/renew); PayPal webhook missing; **no 15-min iCal auto-sync cron** (import is manual "Sync now" / on-add); card/webhook **amount-verification** pending live Paystack keys.

### Mobile app — ~0%
Expo project scaffolded; screens not yet built.

---

## Known gaps to MVP (recommended launch path)

1. **Set production env switches** (inert until set, by design): `ICAL_TOKEN_SECRET` (calendar export), `RESEND_API_KEY` + worker URL/secret (notification send), live Paystack/PayPal keys, `TURNSTILE_*`, `NEXT_PUBLIC_ROOT_DOMAIN` + DNS (tenant subdomains/custom domains), `app.report_scheduler_secret` + `app.settings.*` (report cron).
2. **Smoke-test money + email round-trips in production** — a real Paystack booking → webhook confirms → Resend email lands.
3. **Decide guest↔host messaging scope** — guest inbox is one-way today.
4. **PayPal** — wire end-to-end (checkout + webhook) or ship Paystack + EFT only.
5. **Ship free-plan-only** until subscription billing is wired (feature gates short-circuit open pre-MVP).
6. **Region / compliance** — confirm Supabase region + POPIA, Resend sending domain, re-enable admin MFA.
7. **Calendar auto-sync** — build `ical-sync-all` (cron) if hands-off feed refresh is wanted (import is manual today).

The host + guest core loop (host lists & builds a site → guest discovers → books → pays → manages trip → reviews) is wired end-to-end today.

---

## Key commands

```bash
pnpm dev                                   # web app (from apps/web)
pnpm lint                                  # zero warnings required
pnpm exec tsc --noEmit                     # type-check
pnpm exec vitest run                       # unit tests
pnpm build                                 # production build (no dev server running)
supabase db push --linked                  # apply migrations to the cloud project
supabase gen types typescript --linked > packages/types/database.types.ts
```

---

## Documentation

Project docs live in the repo root. `CHANGELOG.md` is the session-by-session history; `CURRENT_TASK.md` holds the live save point / resume anchor.

| File | Purpose |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Project brief + workflow (auto-loaded by Claude Code) |
| [`RULES.md`](./RULES.md) · [`AGENT_RULES.md`](./AGENT_RULES.md) | Development rules + non-negotiable guardrails |
| [`CONVENTIONS.md`](./CONVENTIONS.md) · [`ARCHITECTURE.md`](./ARCHITECTURE.md) | How code is written; folder structure + data flow |
| [`DEVSTACK.md`](./DEVSTACK.md) · [`ENV_VARS.md`](./ENV_VARS.md) · [`MIGRATIONS.md`](./MIGRATIONS.md) | Locked versions; every env var; migration workflow |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | Brand tokens, components, UI patterns |
| [`WEBSITE_CMS_PLAN.md`](./WEBSITE_CMS_PLAN.md) · [`WEBSITE_HOSTING.md`](./WEBSITE_HOSTING.md) | Website CMS plan; subdomain/custom-domain hosting |
| [`BOOKING_SYNC.md`](./BOOKING_SYNC.md) · [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) · [`EMAIL_TEMPLATES.md`](./EMAIL_TEMPLATES.md) | iCal sync spec; notification specs; email templates |
| [`DECISIONS.md`](./DECISIONS.md) · [`SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md) · [`ERROR_CODES.md`](./ERROR_CODES.md) | ADRs; pre-launch security audit; error codes |
| [`CHANGELOG.md`](./CHANGELOG.md) · [`CURRENT_TASK.md`](./CURRENT_TASK.md) | Build history; current save point |
| [`supabase_database.md`](./supabase_database.md) · [`customer_journey.md`](./customer_journey.md) | DB schema; mapped user flows |

---

## Security

This platform handles real payments and personal data.
- `SUPABASE_SERVICE_ROLE_KEY` is **server-side only** — never in client code.
- All mutations go through Server Actions / Edge Functions; webhook signatures are verified before any DB write.
- Client-supplied prices are never trusted — always recalculated server-side.
- Never commit `.env.local` or real secrets.
- Read [`AGENT_RULES.md`](./AGENT_RULES.md) and [`SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md) before contributing.

---

## Licence

Private and confidential. Not open source.
