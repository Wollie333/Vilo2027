# Vilo

**Direct-booking management for accommodation hosts and experience operators in South Africa.**

Vilo gives hosts a professional, branded booking page and a private dashboard to manage listings, bookings, guest communication, payments, quotes, invoices and reviews — all in one place. Zero booking commission. Flat subscription only. Guests discover and book hosts directly via the Vilo Directory or a host's shareable profile URL (`viloplatform.com/[handle]`).

> **Status:** pre-MVP, under active build. No real users yet. Live dev deploy: https://vilo2027.vercel.app
> See **[Build status](#build-status)** below for an honest, code-level breakdown of what works today.

---

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js 14 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, Zustand, React Hook Form + Zod |
| Mobile app | Expo (scaffolded only — screens not yet built) |
| Backend | Supabase (PostgreSQL 15, Auth, Realtime, Storage) |
| Server logic | **Next.js Server Actions** + API route workers (the bulk of business logic); Supabase Edge Functions only where a non-Next runtime is required (Paystack webhook, EFT detail decryption) |
| Payments | **Paystack (ZAR) — live in checkout**; **Manual EFT — live**; PayPal — host config only, not yet wired into guest checkout |
| Email / notifications | Resend + React Email, dispatched via an in-app/email/push notification queue drained by pg_cron |
| Package manager | pnpm |
| Hosting | Vercel (web) |

---

## Project structure

```
vilo/
├── apps/
│   ├── web/          # Next.js 14 web application (host dashboard, guest portal, admin, public site)
│   └── mobile/       # Expo app — scaffolded, not yet built
├── packages/
│   ├── types/        # Shared TypeScript types (auto-generated from the DB)
│   ├── schemas/      # Shared Zod validation schemas
│   └── utils/        # Shared utility functions
├── supabase/
│   ├── functions/    # Edge Functions (Deno) — paystack-webhook, eft-banking-details
│   └── migrations/   # SQL migrations (timestamped, append-only)
└── emails/           # React Email templates
```

---

## Getting started

> **No local Docker / Supabase stack.** This project applies migrations directly to the
> linked cloud project and generates types from it. Do **not** run `supabase start` /
> `supabase db reset`.

### Prerequisites
- Node.js 20, `pnpm` 9, Supabase CLI (`npx supabase@latest` works), and access to the linked Supabase project.

### Setup
```bash
pnpm install
cp .env.example apps/web/.env.local   # fill in values — see ENV_VARS.md
```

### Database (linked cloud project — no Docker)
```bash
supabase db push --linked            # apply pending migrations to the cloud project, in order
supabase migration list --linked     # verify local + remote are in sync
supabase gen types typescript --linked > packages/types/database.types.ts   # regenerate types after a schema change
```

### Run the web app
```bash
cd apps/web
pnpm dev        # → http://localhost:3000
pnpm build      # production build (must pass with zero errors)
pnpm lint       # must pass with zero warnings
```

---

## Build status

_Honest, code-level snapshot — last reviewed **2026-06-03** via a full route + query + wiring audit. Percentages are share of MVP scope **wired in code** (UI → Server Action → real DB), not "verified in production." Build order priority: **Host dashboard → Guest portal → Admin**._

### Host dashboard — ~80% of MVP scope wired
**Working (UI + action + DB):** email/password auth & login; host onboarding/setup checklist; **listing editor** (all tabs — basic, photos→Storage, location, rooms, amenities, pricing, **seasonal pricing**, policies, add-ons, **guest access**); availability **calendar** + block dates; **iCal calendar-sync** (import external feeds); **bookings** list + detail + full lifecycle (confirm / decline / cancel / check-in / check-out, policy-based refund on cancel); **quotes** (create → send → guest open-tracking → convert to booking); **invoices + credit notes** (with PDF route handlers); **payments** list + EFT settle; **host-side refunds** (approve / decline); **coupons**; **host inbox** (realtime, host → guest); **reviews** + host replies; **settings** (profile, banking incl. bring-your-own Paystack/PayPal credentials, notification prefs); **staff** invites; **help centre**; in-app + email + push **notifications**.
**Partial:** subscription page (plan **state machine only — no real billing calls**); data export/deletion (UI + soft-delete; fulfilment partial).
**Not wired (explicit "coming soon" stubs):** Reports / analytics; Channels / multi-channel cross-posting.

### Guest portal & public site — ~72%
**Working:** marketing home; **`/explore`** directory search + filters + sort; **listing detail** (gallery, seasonal pricing, availability, reviews, host card); host public profile **`/[handle]`**; **booking flow** `/listing/[slug]/book` with server-side re-pricing, capacity + policy checks, coupons; **Paystack checkout + automatic EFT fallback**; booking success/failed; guest sign-up + onboarding + inline account-at-checkout; **My Trips** list + redesigned **Trip Details** (`/portal/trips/[id]`); **cancel** + **request refund**; **reviews** (submit + view); **public quote** accept/decline + view tracking; account notification prefs + POPIA data-deletion request.
**Partial:** guest account settings — **no profile self-edit** (name/avatar/phone locked to onboarding values).
**Not wired:** **guest inbox is read-only** (no compose/reply); **"Message host" from a listing is a dead link** — no pre-booking enquiry UI; **PayPal not offered at guest checkout** (and no PayPal webhook).

### Admin panel — ~82%
**Working:** dashboard KPIs; host management + verify; user/guest suspend/ban; booking management; payment management (read); review moderation queue; subscriptions (read); **impersonation** (signed cookie, audit-logged); **audit log**; broadcasts + individual notification send; full **help-centre CRUD**; directory/listing controls (filter/read); per-action permission gates.
**Partial:** staff management (reads invites/roles; no invite-create UI yet); data-request fulfilment.
**Not wired (stubs):** feature-flag-override editor; platform-settings editor. _(Admin AAL2/MFA gate intentionally disabled pre-MVP — restore before launch.)_

### Platform infrastructure
**Working:** notification system (in-app + email via Resend drain + push queue, with per-category prefs, quiet hours, digest); **12 pg_cron jobs** (pending/EFT booking expiry, 24h auto-cancel, review auto-publish + request queue, subscription expiry-warn + restrict, ranking recalc, response-rate, invite/log cleanup, email-queue drain); **Paystack webhook** (HMAC-SHA512 verified); EFT banking-details Edge Function; RLS + soft-delete across core tables; immutable audit log.
**Gaps:** **subscription billing is a no-op** (no Paystack/PayPal subscription create/renew; grace period never auto-set on a failed charge); **PayPal webhook missing**; admin refund **escalation/dispute** queue is read-only; Paystack + Resend round-trips **not yet smoke-tested end-to-end in production**.

### Mobile app — ~0%
Expo project scaffolded; NativeWind wiring and all screens not yet built.

---

## Known gaps to MVP (and the recommended launch path)

1. **Smoke-test the money + email round-trips in production** — create a real test booking and confirm the Paystack webhook flips it to confirmed and a Resend email actually lands. The code is wired; it has not been verified live.
2. **Decide guest↔host messaging scope** — guests currently cannot reply or send pre-booking enquiries (inbox is one-way). Either ship one-way for MVP or build guest compose + enquiry.
3. **PayPal** — either wire it end-to-end (checkout SDK + webhook) or remove PayPal from guest-facing copy and ship **Paystack + EFT only** for MVP.
4. **Ship free-plan-only** — keep paid plans locked behind a "coming soon" state until subscription provider billing is wired. Feature gates already short-circuit open during pre-MVP.
5. **Region / compliance** — Supabase is in **Frankfurt**; the spec targets `af-south-1` (Cape Town) for POPIA. Verify Resend sending domain (currently `resend.dev`), and re-enable the admin MFA gate. Sentry/PostHog are deferred to launch week.
6. **Smaller polish** — guest profile self-edit; admin feature-flag + platform-settings editors; admin refund escalation; data-request fulfilment; Reports/Channels (post-MVP).

**Recommended MVP:** free-plan-only, Paystack + EFT payments, after the live payment + email smoke test and a region decision. The host + guest core loop (host lists → guest discovers → books → pays → manages trip → reviews) is wired end-to-end today.

---

## Key commands

```bash
pnpm dev                                   # web app (from apps/web)
pnpm build                                 # production build (zero errors required)
pnpm lint                                  # lint (zero warnings required)
supabase db push --linked                  # apply migrations to the cloud project
supabase migration list --linked           # check migration sync
supabase gen types typescript --linked > packages/types/database.types.ts
```

---

## Documentation

Project docs live in the repo root. **Note:** `PHASE_PLAN.md` checkboxes are out of date (they predate most of the build) — this README's **Build status** is the current source of truth for what's done; `CHANGELOG.md` is the session-by-session history.

| File | Purpose |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Auto-loaded by Claude Code — project brief and workflow |
| [`RULES.md`](./RULES.md) · [`AGENT_RULES.md`](./AGENT_RULES.md) | Development rules and non-negotiable guardrails |
| [`CONVENTIONS.md`](./CONVENTIONS.md) · [`ARCHITECTURE.md`](./ARCHITECTURE.md) | How code is written; folder structure & data flow |
| [`DEVSTACK.md`](./DEVSTACK.md) · [`ENV_VARS.md`](./ENV_VARS.md) | Locked versions / dev setup; every env var |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | Brand tokens, components, UI patterns |
| [`EMAIL_TEMPLATES.md`](./EMAIL_TEMPLATES.md) · [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) | Email templates; push/in-app notification specs |
| [`BOOKING_SYNC.md`](./BOOKING_SYNC.md) · [`ERROR_CODES.md`](./ERROR_CODES.md) | iCal sync spec; Edge Function error codes |
| [`DECISIONS.md`](./DECISIONS.md) · [`SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md) | Architecture decision records; pre-launch security audit |
| [`CHANGELOG.md`](./CHANGELOG.md) · [`CURRENT_TASK.md`](./CURRENT_TASK.md) | Build history; current session scope |
| [`vilo-platform-mvp.md`](./vilo-platform-mvp.md) · [`supabase_database.md`](./supabase_database.md) · [`customer_journey.md`](./customer_journey.md) | Product spec; DB schema; user flows |

---

## Security

This platform handles real payments and personal data.
- `SUPABASE_SERVICE_ROLE_KEY` is **server-side only** — never in client code.
- All mutations go through Server Actions / Edge Functions; webhook signatures are verified before any DB write.
- Never commit `.env.local` or real secrets.
- Read [`AGENT_RULES.md`](./AGENT_RULES.md) and [`SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md) before contributing.

---

## Licence

Private and confidential. Not open source.
