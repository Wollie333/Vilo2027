# Wielo

**Direct-booking management for accommodation hosts and experience operators in South Africa.**

Wielo gives hosts a professional, branded booking website and a private dashboard to manage listings, bookings, calendars, payments, quotes, invoices, guest communication and reviews — all in one place. Zero booking commission, flat subscription only. Guests discover and book hosts directly via the Wielo Directory, a host's shareable profile, or the host's own published website.

> **Status:** pre-MVP, under active build. **No real users / no production data yet** — every table is treated as empty (see the pre-MVP data policy in [`CLAUDE.md`](./CLAUDE.md)). Live dev deploy: https://vilo2027.vercel.app — **host tenant sites are live on `*.wielo.co.za`** (wildcard domain configured).
> See **[Build status](#build-status)** for an honest, code-level breakdown of what works today.
>
> **Active initiative (Jul 2026): Builder × Theme pixel-perfect pipeline** — plan of record [`docs/features/BUILDER_THEME_PLAN.md`](./docs/features/BUILDER_THEME_PLAN.md). Progress: ✅ **Phase 0** — themed date-picker/search-field clipping fixed (calendar portals above all content) · ✅ **Phase 1** — theme preview renders pixel-perfect with **stock data** (auto-populate blocks show representative content regardless of host setup) · ✅ **Phase 2** — activation seeds all pages incl. system templates, each inherits the theme + is builder-editable · ✅ **Phase 3** — required Wielo blocks per system template (contract + library "Req" badges + delete/publish guards) · 🟡 **Phase 4a/4b-1** — edit **and add** real rooms from the builder ("Edit room data…" modal → `property_rooms` via the existing actions; verified live: a price edit + a new room both persisted to the DB; fixed a `properties` RLS-leak so the picker only shows the host's own) · ✅ **Phase 4b-2** — the builder canvas renders the host's **real** data, not demo, so edits show in place · ✅ **Phase 4b-3** — edit **amenities** from the builder, property-wide or per-room (scope-safe) · ✅ **Phase 4b-4** — the `amenities` block is now a **live, draggable Wielo block** · ✅ **Phase 4b-5** — edit **gallery photos** from the builder (upload/delete → `property_photos`, reusing the signed-URL flow; verified live end-to-end) · ⏳ Phase 4b rest (rates editor) · Phases 5–6 (per-block style UI · setup wizard + go-live gate).

---

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js 14.2 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, Zustand, React Hook Form + Zod |
| Mobile app | Expo (SDK 51+) — scaffolded, screens not yet built |
| Backend | Supabase (PostgreSQL 15, Auth, Realtime, Storage) |
| Server logic | **Next.js Server Actions** + API-route workers (the bulk of business logic); Supabase **Edge Functions** (Deno) only where a non-Next runtime is required — `paystack-webhook`, `eft-banking-details`, `report-scheduler`, `track-listing-view`, `external-reviews-sync`, `external-review-reply` |
| Payments | **Paystack (ZAR)** — hosts connect their **own** Paystack (test **and** live keys + a mode switch); guest booking + on-site website checkout settle directly to the host (Wielo 0%). Platform billing uses the platform Paystack. **Manual EFT** — live. **Free products skip payment** (auto-provision). PayPal — host config only, not in guest checkout |
| Email / notifications | Resend + React Email, dispatched via an in-app / email / push notification queue drained by pg_cron (atomic claim — see below) |
| Calendar sync | RFC 5545 iCal **import** (external feeds → blocked dates) + **export** (public per-listing feed) |
| Maps / addresses | **Google Places (New) Autocomplete + Geocoding** via a server proxy (`/api/geo`, key never exposed); Leaflet on OSM tiles for the interactive map pin |
| Package manager | **pnpm 9** (Node ≥ 20) |
| Hosting | Vercel (web) |

---

## Project structure

```
wielo/
├── apps/
│   ├── web/          # Next.js 14 web app (host dashboard, guest portal, admin, public + tenant sites)
│   └── mobile/       # Expo app — scaffolded, not yet built
├── packages/
│   ├── types/        # Shared TS types (auto-generated from the DB)
│   ├── schemas/      # Shared Zod validation schemas
│   └── utils/        # Shared pure utilities
├── supabase/
│   ├── functions/    # Edge Functions (Deno) — paystack-webhook, eft-banking-details,
│   │                 #   report-scheduler, track-listing-view, external-reviews-sync,
│   │                 #   external-review-reply
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

_Honest, code-level snapshot — **2026-06-30**. Percentages are share of MVP scope **wired in code** (UI → Server Action/RPC → real DB), not "verified in production." Build priority: **Host dashboard → Website CMS → Guest portal → Admin**._

### Host dashboard — ~85% of MVP scope wired
**Working (UI + action + DB):** email/password auth & login; host onboarding/setup checklist; **listing editor** (basic, photos→Storage, **Google Places address autocomplete + map pin**, rooms, amenities, pricing, **seasonal pricing**, policies, add-ons, guest access); availability **calendar** + block dates; **bookings** list + detail + full lifecycle (confirm / decline / cancel / check-in / check-out, policy-based refund); **quotes** (create → send → open-tracking → convert to booking); **invoices + credit notes** (+ PDF); **payments** + EFT settle; **host-side refunds**; **coupons**; **host inbox** (realtime, incl. sending a booking **payment link as a pay card** into the guest thread — creates the thread if none exists yet); **reviews** + replies; **external reviews** (connect Google Business Profile / Facebook Page via OAuth → sync external reviews into Wielo, host reply, public aggregate rating; daily cron + manual sync; tokens encrypted at rest); **settings** (profile, multi-business banking incl. own Paystack/PayPal credentials, notification prefs); **staff** invites; **help centre**; in-app + email + push **notifications**.
**Partial:** subscription page (plan **state machine only — no real billing calls yet**); data export/deletion (UI + soft-delete; fulfilment partial). Reports/analytics dashboards render but report-generation is a placeholder.

### Website CMS (host's own site) — substantial, the largest recent lane
A full per-host website builder with a **frozen publish snapshot** (drafts never leak to the live site):
- **Setup wizard** — a guided "no website → live, themed site" flow (Basics → Theme → Colours → Build → Done): live theme previews with the host's own name/logo, accent-palette generation, then a one-shot create that seeds pages/forms/rooms and **auto-publishes**. The builders/managers remain for deeper customisation afterward.
- **Theme-styled builder canvases** — the form-builder and blog-post editor canvases render in the **active theme** (same `--site-*` tokens as the published page), so editing matches the live result.
- **Curated section system** + a simple in-page **builder** (@dnd-kit) with **free elements** (heading/text/image/button/spacer/divider + columns), a **blank "Section" container** you fill with elements **on the canvas** (add/select/reorder/delete inline), **per-block responsive style** (padding/margin/border/radius/max-width/background/section-height), and inline header/footer/menu editing.
- **7 professionally-designed, responsive hero layouts** (Spotlight, Split ×2, Full-screen, Minimal, Boxed, Search) with overlay/text-tone/height controls, surfaced as pickable sidebar cards.
- **Theme-attached designed sections + page templates** (code-defined registry; the Aria flagship theme ships designed sections + Home/About templates).
- **Searchable add-blocks sidebar**; **site width** toggle (full vs boxed); Brand Studio + Theme gallery.
- **Pages / Blog / Forms** managers + full-screen editors. The **form builder** mirrors the page builder (2-col palette grid, search, on-canvas field labels + insert-between, drag reorder) with **rich starter templates** (Contact / Booking enquiry / Newsletter / Review seed real fields), a **Styles tab** (per-form accent, field shape/fill/border, button colour + alignment — themed live), per-form spam (Turnstile) toggle, duplicate-a-form, and a **responses** inbox (search + date filter + CSV export); booking forms route to the real quote pipeline.
- **SEO** (Yoast-style coach + Schema.org JSON-LD + canonical/sitemap); **Domains** (subdomain + custom-domain flow, dormant until ops env set).
- **Conversion**: WhatsApp click-to-chat, announcement bar, pop-ups, **on-site checkout** (Paystack + EFT) with a host **per-website payment-method toggle** (enforced server-side), forms → inbox/CRM.
- **GA4 + Meta Pixel** with a POPIA consent gate; baseline security headers; Cloudflare Turnstile (inert until keys).

### Guest portal & public site — ~72%
**Working:** marketing home; **`/explore`** directory (search/filter/sort) + `/deals`; **listing detail**; host public profile `/[handle]`; **booking flow** with server-side re-pricing, capacity + policy checks, coupons; **Paystack checkout + automatic EFT fallback**; success/failed; guest sign-up + account-at-checkout; **My Trips** + Trip Details; cancel + request refund; **reviews**; **public quote** accept/decline; **product landing pages** `/p/[slug]` (paid → pay-link; **free → skip payment, auto-provision account + host + features, auto sign-in** — used for beta onboarding); account notification prefs + POPIA deletion request; published **tenant websites** render end-to-end.
**Not wired:** guest inbox is read-only (no compose); PayPal not offered at guest checkout.

### Admin panel — ~92%
Two-layer RBAC (active `platform_staff` + 24 granular permission keys), every mutation audited.
**Working:** dashboard KPIs; **products & subscription plans** full CRUD + per-product/plan feature matrix + per-host overrides; payments/Wielo ledger; **user management** (edit/role/suspend/soft-delete/notes/subscription + **admin password reset**); **host management** (verify + **suspend/reactivate**); **host-staff management** (assign users as staff to a host — per-host panel + global list, direct add or email-invite); **platform staff** invite/accept flow + role/activate + **permission-filtered sidebar**; **impersonation** ("view as host" — signed cookie, audited); **GDPR/POPIA fulfilment** (export generates a downloadable JSON; deletion is hybrid hard-delete-or-anonymise); review moderation; broadcasts + notification send; full **help-centre CRUD**; platform settings/amenities/categories.
_(Admin MFA/AAL2 gate intentionally disabled pre-MVP — restore before launch.)_

### Platform infrastructure
**Working:** **notification system** (in-app + email via Resend drain + push queue; per-category prefs, quiet hours, digest) — drains now use an **atomic claim** (`FOR UPDATE SKIP LOCKED` + stale-reclaim) so overlapping cron ticks can't double-send; **calendar sync** — iCal **import** (atomic, non-destructive `import_ical_blocks` RPC; never overwrites a booking/manual block) + token-gated **export** feed; **pg_cron** jobs (booking expiry, auto-cancel, review publish/request, subscription warn/restrict, ranking, queue drains, **external-reviews daily sync** — guarded, no-ops until the worker vault secrets are set); **Paystack webhook** (HMAC-SHA512 verified, idempotent on `provider_reference`); EFT banking-details + report-scheduler (secret-gated) + track-listing-view (validated) Edge Functions; RLS + soft-delete across core tables; immutable audit log.
**Gaps:** subscription billing is a no-op (no provider create/renew); PayPal webhook missing; **no 15-min iCal auto-sync cron** (import is manual "Sync now" / on-add); card/webhook **amount-verification** pending live Paystack keys.

### Mobile app — ~0%
Expo project scaffolded; screens not yet built.

---

## Known gaps to MVP (recommended launch path)

1. **Set production env switches** (inert until set, by design): `ICAL_TOKEN_SECRET` (calendar export), `RESEND_API_KEY` + worker URL/secret (notification send), live Paystack/PayPal keys, `TURNSTILE_*`, `GOOGLE_MAPS_API_KEY` (address autocomplete via `/api/geo` — Places API New + Geocoding; **live**), `NEXT_PUBLIC_ROOT_DOMAIN` + DNS for **per-host custom domains** (tenant **subdomains** on `*.wielo.co.za` are **live**), `app.report_scheduler_secret` + `app.settings.*` (report cron), **external-reviews** OAuth app credentials (Google Business Profile / Facebook) + token-encryption key + `external_reviews_worker_url`/`_secret` vault secrets (daily sync stays dormant until set).
2. **Smoke-test money + email round-trips in production** — a real Paystack booking → webhook confirms → Resend email lands.
3. **Decide guest↔host messaging scope** — guest inbox is one-way today.
4. **PayPal** — Paystack + EFT are the processors for beta (PayPal is host-config only). Wire PayPal end-to-end (checkout + webhook) only if needed later.
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
