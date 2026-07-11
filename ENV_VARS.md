# Vilo Platform — Environment Variables Reference

**Version:** 1.0
**Last Updated:** May 2026

This file documents every environment variable used across the platform, what it does, where to get it, and which environment it belongs in.

> **Never commit `.env.local` or any file containing real secret values. Use `.env.example` as the local template (copy it to `apps/web/.env.local`), and add real secrets to Vercel Environment Variables (marked Sensitive, scoped per environment) for Preview/Production.**

---

## 1. Quick Reference

| Variable | Web | Mobile | Edge Functions | Required |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | — | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | — | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | — | ✅ | ✅ |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | ✅ | ✅ | — | ✅ |
| `PAYSTACK_SECRET_KEY` | Server only | — | ✅ | ✅ |
| `PAYSTACK_WEBHOOK_SECRET` | — | — | ✅ | ✅ |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | ✅ | ✅ | — | ✅ |
| `PAYPAL_CLIENT_SECRET` | Server only | — | ✅ | ✅ |
| `PAYPAL_WEBHOOK_ID` | — | — | ✅ | ✅ |
| `RESEND_API_KEY` | — | — | ✅ | ✅ |
| `EMAIL_FROM_ADDRESS` | Server only | — | ✅ | ✅ |
| `EMAIL_WORKER_SECRET` | Server only | — | — | Staging/Prod |
| `NEXT_PUBLIC_APP_URL` | ✅ | — | ✅ | ✅ |
| `NEXT_PUBLIC_SENTRY_DSN` | ✅ | ✅ | — | Staging/Prod |
| `NEXT_PUBLIC_POSTHOG_KEY` | ✅ | ✅ | — | Staging/Prod |
| `BANKING_CIPHER_KEY` | Server only | — | ✅ | ✅ |
| `PAYMENT_CIPHER_KEY` | Server only | — | ✅ | ✅ |
| `ICAL_TOKEN_SECRET` | Server only | — | — | ✅ |
| `ICAL_SYNC_WORKER_SECRET` | Server only | — | — | Staging/Prod |
| `NEXT_PUBLIC_ROOT_DOMAIN` | ✅ | — | — | Website CMS |
| `VERCEL_TOKEN` | Server only | — | ✅ | Custom domains |
| `VERCEL_PROJECT_ID` | Server only | — | ✅ | Custom domains |
| `VERCEL_TEAM_ID` | Server only | — | ✅ | Custom domains |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ✅ | — | — | Website CMS (bot-hardening) |
| `TURNSTILE_SECRET_KEY` | Server only | — | — | Website CMS (bot-hardening) |
| `GOOGLE_MAPS_API_KEY` | Server only | — | ✅ | Address picker (`/api/geo` → Google Places + Geocoding). Enable **Places API (New)** + **Geocoding API** on the key. Without it the picker still loads but returns no suggestions. |

---

## Website CMS (hosted micro-sites)

### `NEXT_PUBLIC_ROOT_DOMAIN`
The apex domain tenant micro-sites hang off of — e.g. `wielo.site`. **This single
var is the feature switch for host-based site routing.** When unset, the
middleware classifies EVERY request as the app (host routing is a no-op), so the
platform behaves exactly as before. When set:
- `wielo.site`, `www.wielo.site`, `app.wielo.site`, `localhost`, `*.vercel.app` and
  every reserved subdomain stay on the app.
- `<sub>.wielo.site` (non-reserved) and any connected custom domain are rewritten
  into the public site routes (`/<locale>/site/…`) with an `x-wielo-site-host`
  header. See `WEBSITE_HOSTING.md`.
- Local dev: set it (e.g. `wielo.site`) and visit `<sub>.localhost:3000`.

### `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID`
Server-only credentials for the custom-domain connect + verification flow
(Vercel Domains API), used by the Domain tab actions + the
`/api/website-domain-poll` worker (W13). **The whole custom-domain feature is
inert until these are set** — `vercelConfigured()` returns false, the connect
button is disabled and the UI says custom domains aren't available yet.
- `VERCEL_TOKEN` — a Vercel access token (Account/Team Settings → Tokens).
  NEVER expose to the client.
- `VERCEL_PROJECT_ID` — the project the tenant domains attach to.
- `VERCEL_TEAM_ID` — required when the project lives under a Vercel team
  (appended as `?teamId=` to every API call); omit for a personal account.

Also register the poll-worker URL in Vault (`website_domain_poll_url`); the cron
bearer reuses `email_worker_secret`. Not needed for subdomain-only hosting. See
`WEBSITE_HOSTING.md` for the full one-time setup.

### `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`
Cloudflare Turnstile keys for bot-hardening the public, session-less tenant-site
write endpoints — the website form submit (`/api/website-form-submit`) and the
on-site checkout (`/api/site-booking`). **Both are inert until set**, so the
forms behave exactly as before (honeypot-only) in dev and any environment that
hasn't configured them:
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — the public sitekey. When unset, the
  `TurnstileWidget` renders nothing and no token is produced.
- `TURNSTILE_SECRET_KEY` — the server secret. When unset, `verifyTurnstile`
  skips verification (passes everything). NEVER expose to the client.

Get both from the Cloudflare dashboard → Turnstile → add a widget (set the
allowed hostnames to your tenant root domain + any custom domains). Verification
is fail-closed once the secret is set: a missing/expired/invalid token is
rejected. Read-only quote/availability endpoints are intentionally NOT gated.

---

## 2. Supabase

### `NEXT_PUBLIC_SUPABASE_URL`
- **What:** Your Supabase project URL
- **Format:** `https://[project-ref].supabase.co`
- **Where to get:** Supabase Dashboard → Project Settings → API → Project URL
- **Used in:** Web client, Mobile client
- **Environments:** All

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **What:** The public anonymous key for the Supabase project. Safe to expose — RLS protects the data.
- **Format:** Long JWT string
- **Where to get:** Supabase Dashboard → Project Settings → API → `anon public`
- **Used in:** Web client, Mobile client
- **Environments:** All

### `SUPABASE_SERVICE_ROLE_KEY`
- **What:** The service role key. **Bypasses all RLS policies.** Never expose to client.
- **Format:** Long JWT string
- **Where to get:** Supabase Dashboard → Project Settings → API → `service_role secret`
- **Used in:** Edge Functions, Next.js Server Actions (sparingly)
- **Environments:** All
- ⚠️ **Never prefix with `NEXT_PUBLIC_`. Never use in client-side code.**

### `SUPABASE_DB_URL` *(CI/migrations only)*
- **What:** Direct PostgreSQL connection string for running migrations in CI
- **Format:** `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`
- **Where to get:** Supabase Dashboard → Project Settings → Database → Connection String
- **Used in:** GitHub Actions CI only
- **Environments:** Staging, Production

---

## 3. Paystack

### `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
- **What:** Paystack public key (safe to expose)
- **Format:** `pk_test_...` (test) or `pk_live_...` (production)
- **Where to get:** Paystack Dashboard → Settings → API Keys & Webhooks
- **Used in:** Web frontend (Paystack Popup), Mobile
- **Environments:** All

### `PAYSTACK_SECRET_KEY`
- **What:** Paystack secret key. Used to initialise transactions and call Paystack APIs.
- **Format:** `sk_test_...` (test) or `sk_live_...` (production)
- **Where to get:** Paystack Dashboard → Settings → API Keys & Webhooks
- **Used in:** Edge Functions only
- **Environments:** All
- ⚠️ **Server-side only. Never expose to client.**

### `PAYSTACK_WEBHOOK_SECRET`
- **What:** Used to verify the HMAC SHA-512 signature on incoming Paystack webhooks
- **Format:** Long random string
- **Where to get:** Paystack Dashboard → Settings → API Keys & Webhooks → Webhook secret
- **Used in:** `webhooks/paystack` Edge Function
- **Environments:** Staging, Production (local dev uses test mode without signature verification)

---

## 4. PayPal

### `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- **What:** PayPal app client ID (safe to expose — used to load PayPal JS SDK)
- **Format:** Long alphanumeric string
- **Where to get:** PayPal Developer → My Apps & Credentials → App → Client ID
- **Used in:** Web frontend, Mobile
- **Environments:** All (different ID for sandbox vs live)

### `PAYPAL_CLIENT_SECRET`
- **What:** PayPal app client secret. Used to get OAuth tokens for server-side PayPal API calls.
- **Format:** Long alphanumeric string
- **Where to get:** PayPal Developer → My Apps & Credentials → App → Secret
- **Used in:** Edge Functions only
- **Environments:** All
- ⚠️ **Server-side only.**

### `PAYPAL_WEBHOOK_ID`
- **What:** The webhook ID used to verify PayPal webhook signatures via the verification API
- **Format:** Short alphanumeric string
- **Where to get:** PayPal Developer → My Apps & Credentials → App → Webhooks → Webhook ID
- **Used in:** `webhooks/paypal` Edge Function
- **Environments:** Staging, Production

### `NEXT_PUBLIC_PAYPAL_ENV`
- **What:** Controls whether the PayPal JS SDK loads in sandbox or production mode
- **Values:** `sandbox` | `production`
- **Used in:** Web frontend, Mobile
- **Environments:** `sandbox` for dev/staging, `production` for live

---

## 5. Email (Resend)

### `RESEND_API_KEY`
- **What:** Resend API key for sending transactional email
- **Format:** `re_...`
- **Where to get:** Resend Dashboard → API Keys → Create API Key
- **Used in:** Edge Functions only (via `_shared/email.ts`)
- **Environments:** All
- **Note:** Use a separate API key per environment. Configure allowed domains per key.

### `EMAIL_FROM_ADDRESS`
- **What:** The "from" address for all transactional emails
- **Value:** `Wielo <onboarding@resend.dev>` (dev / pre-domain) → `Wielo <noreply@wieloplatform.com>` once the sending domain verifies in Resend
- **Used in:** Next.js Route Handler (`/api/email-worker`) — see `DECISIONS.md` 2026-05-25 entry for why the worker is a Next.js route, not an Edge Function
- **Environments:** All

### `EMAIL_WORKER_SECRET`
- **What:** Shared bearer the `/api/email-worker` route requires on every POST. pg_cron sends it as `Authorization: Bearer …`.
- **Format:** 32+ random bytes — `openssl rand -hex 32`
- **Where to set:**
  1. **Vercel** (Production + Preview env) — the route reads `process.env.EMAIL_WORKER_SECRET`.
  2. **Supabase** — one-time SQL via the Dashboard SQL Editor, using Supabase Vault (managed-postgres blocks `ALTER DATABASE`):
     ```sql
     SELECT vault.create_secret(
       'https://vilo2027.vercel.app/api/email-worker',
       'email_worker_url',
       'Public URL the drain-email-queue cron POSTs to'
     );
     SELECT vault.create_secret(
       '<the same hex value as Vercel>',
       'email_worker_secret',
       'Shared bearer the /api/email-worker route requires'
     );
     ```
     (Migration `20260525000007_email_worker_use_vault.sql` reads both secrets on every tick; missing secrets = no-op with a NOTICE. Rotate via `vault.update_secret(<id>, <new_value>)`.)
- **Used in:** Route handler (Next.js) + pg_cron job (Postgres).
- **Environments:** Staging/Prod required. Local dev: omit to leave cron inert.

---

## 5a. Banking encryption

### `BANKING_CIPHER_KEY`
- **What:** AES-256-GCM key used to encrypt the `account_number` column of `eft_banking_details` at the application layer (per `AGENT_RULES.md` §1.5). Also decrypts on the server when rendering invoice/quote PDFs and when the EFT Edge Function exposes details to a verified guest.
- **Format:** Base64-encoded 32 bytes — `openssl rand -base64 32`
- **Where to get:** Generate once per environment; add to Vercel Environment Variables (Sensitive) for Preview/Production and to `apps/web/.env.local` for local dev.
- **Used in:** Next.js server runtime (Server Actions, PDF route handlers) AND Supabase Edge Functions. Same key, two runtimes.
- **Environments:** All
- ⚠️ **Server-side only. Rotating the key requires re-encrypting every `account_number` row with a key-prefix migration; see the `v1.` prefix in `apps/web/lib/crypto/banking.ts`.**

### `PAYMENT_CIPHER_KEY`
- **What:** AES-256-GCM key used to encrypt the `secret_cipher` column of `host_payment_gateways` — i.e. each host's own Paystack secret key / PayPal client secret for direct booking payments. Separate from `BANKING_CIPHER_KEY` so the two blast radii are independent.
- **Format:** Base64-encoded 32 bytes — `openssl rand -base64 32`
- **Where to get:** Generate once per environment; add to Vercel Environment Variables (Sensitive) for Preview/Production and to `apps/web/.env.local` for local dev (and Supabase Edge secrets if/when a payment Edge Function needs it).
- **Used in:** Next.js server runtime (Server Actions). The decrypted secret is used only to call the host's gateway and is NEVER returned to a client.
- **Environments:** All
- ⚠️ **Server-side only. If unset, secrets are stored as plain text (round-trips transparently) — fine for local dev, set it everywhere else. Rotating requires re-encrypting via the `v1.` prefix scheme in `apps/web/lib/crypto/payments.ts`.**

---

## 5b. iCal calendar sync

### `ICAL_TOKEN_SECRET`
- **What:** HMAC-SHA256 secret used to derive each listing's unguessable iCal export feed token (the `/ical/[listing_id]/[token].ics` URL). One secret → all per-listing tokens; rotating it invalidates every already-distributed feed URL.
- **Format:** 32+ random bytes, hex — `openssl rand -hex 32`
- **Where to get:** Generate once per environment; add to Vercel Environment Variables (Sensitive) for Preview/Production and to `apps/web/.env.local` for local dev.
- **Used in:** Next.js server runtime only — `apps/web/lib/ical.ts` (`signListingToken` / `verifyListingToken`) and the export route handler.
- **Environments:** All
- ⚠️ **Server-side only and REQUIRED for iCal export. There is deliberately NO fallback to `SUPABASE_SERVICE_ROLE_KEY` — the platform's most powerful secret must never derive public feed tokens. If unset, `signListingToken` throws and iCal export is unavailable.**

### `ICAL_SYNC_WORKER_SECRET`
- **What:** Shared bearer the `/api/ical-sync-worker` route requires on every POST. The `sync-ical-feeds` pg_cron job sends it as `Authorization: Bearer …` every 15 min to re-import all active/errored feeds (this is what makes calendar sync hands-off — without it hosts must click "Sync now").
- **Format:** 32+ random bytes, hex — `openssl rand -hex 32`
- **Where to set:**
  1. **Vercel** (Production + Preview env) — the route reads `process.env.ICAL_SYNC_WORKER_SECRET`.
  2. **Supabase Vault** — one-time SQL via the Dashboard SQL Editor. Managed Postgres blocks `ALTER DATABASE ... SET` (42501), so the cron (migration `20260707130000_ical_sync_cron_use_vault.sql`) reads from `vault.decrypted_secrets` — same pattern as the email worker:
     ```sql
     SELECT vault.create_secret(
       'https://vilo2027.vercel.app/api/ical-sync-worker',
       'ical_sync_worker_url',
       'Public URL the sync-ical-feeds cron POSTs to'
     );
     SELECT vault.create_secret(
       '<the same hex value as Vercel ICAL_SYNC_WORKER_SECRET>',
       'ical_sync_worker_secret',
       'Shared bearer the /api/ical-sync-worker route requires'
     );
     ```
     Rotate with `vault.update_secret(<id>, <new_value>)`. If either secret is unset the cron tick is a no-op (NOTICE logged) — the job stays inert until wired.
- **Optional companion:** `ICAL_SYNC_MIN_INTERVAL_MINUTES` (default `180`) — how stale a feed must be before the worker re-syncs it. Keep it in step with the `interval '3 hours'` gate in the cron migration.
- **Used in:** Route handler (Next.js) + pg_cron job (Postgres).
- **Environments:** Staging/Prod required for hands-off syncing. Local dev: omit to leave the cron inert (manual "Sync now" still works). ⚠️ Server-side only.

---

## 6. App Config

### `NEXT_PUBLIC_APP_URL`
- **What:** The full base URL of the web app (used for generating links in emails, callbacks)
- **Format:** `https://wieloplatform.com` (production) | `https://staging.wieloplatform.com` | `http://localhost:3000`
- **Used in:** Web, Edge Functions (for email links, OAuth redirects)
- **Environments:** All

### `NEXT_PUBLIC_APP_NAME`
- **What:** The product name used in UI and emails
- **Value:** `Wielo`
- **Environments:** All

---

## 7. Maps

**No environment variable required.** Maps are keyless — Leaflet rendering
OpenStreetMap tiles, with Photon (komoot) and Nominatim for geocoding and
reverse-geocoding. See `components/location/LocationPicker.tsx` and
`app/listing/[slug]/LocationMap.tsx`. (Superseded the previous Mapbox token —
see ADR-013 in `DECISIONS.md`.)

---

## 8. Monitoring

### `NEXT_PUBLIC_SENTRY_DSN`
- **What:** Sentry Data Source Name for error reporting
- **Format:** `https://[key]@[org].ingest.sentry.io/[project]`
- **Where to get:** Sentry Dashboard → Project Settings → Client Keys → DSN
- **Used in:** Web, Mobile
- **Environments:** Staging, Production (skip in local dev to avoid noise)

### `SENTRY_AUTH_TOKEN`
- **What:** Used by the Sentry CLI to upload source maps during build
- **Used in:** GitHub Actions CI
- **Environments:** Staging, Production

### `NEXT_PUBLIC_POSTHOG_KEY`
- **What:** PostHog public API key for product analytics
- **Format:** `phc_...`
- **Where to get:** PostHog Dashboard → Project Settings → Project API Key
- **Used in:** Web, Mobile
- **Environments:** Staging, Production

### `NEXT_PUBLIC_POSTHOG_HOST`
- **What:** PostHog ingestion endpoint
- **Value:** `https://app.posthog.com` (cloud) or your self-hosted URL
- **Environments:** Staging, Production

---

## 9. External Reviews Integration

OAuth connections to Google Business Profile and Facebook Pages, plus API key storage for Trustpilot.

### `OAUTH_CIPHER_KEY`
- **What:** AES-256-GCM encryption key for OAuth tokens stored in the database
- **Format:** Base64-encoded 32-byte key
- **Generate:** `openssl rand -base64 32`
- **Used in:** Server Actions, Edge Functions
- **Environments:** All
- ⚠️ **Server-side only. Never expose to client. If lost, all OAuth tokens must be re-authenticated.**

### `GOOGLE_REVIEWS_CLIENT_ID`
- **What:** Google Cloud OAuth 2.0 client ID for Google Business Profile API
- **Format:** `123456789-abcdef.apps.googleusercontent.com`
- **Where to get:** Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application)
- **Required scopes:** `https://www.googleapis.com/auth/business.manage`
- **Used in:** Server Actions (OAuth flow)
- **Environments:** All

### `GOOGLE_REVIEWS_SECRET`
- **What:** Google Cloud OAuth 2.0 client secret
- **Format:** `GOCSPX-...`
- **Where to get:** Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Client secret
- **Used in:** Server Actions (token exchange)
- **Environments:** All
- ⚠️ **Server-side only.**

### `FACEBOOK_APP_ID`
- **What:** Facebook App ID for Pages API access
- **Format:** Numeric string (e.g., `123456789012345`)
- **Where to get:** Meta for Developers → My Apps → App Settings → Basic → App ID
- **Required permissions:** `pages_read_engagement`, `pages_manage_engagement`
- **Used in:** Server Actions (OAuth flow)
- **Environments:** All

### `FACEBOOK_APP_SECRET`
- **What:** Facebook App secret
- **Format:** Alphanumeric string
- **Where to get:** Meta for Developers → My Apps → App Settings → Basic → App Secret
- **Used in:** Server Actions (token exchange)
- **Environments:** All
- ⚠️ **Server-side only.**

### `EXTERNAL_REVIEWS_WORKER_SECRET`
- **What:** Bearer token for authenticating the daily sync cron job
- **Format:** Random string (min 32 characters)
- **Generate:** `openssl rand -base64 32`
- **Used in:** `/api/external-reviews-worker` route, Supabase Vault
- **Environments:** Staging, Production
- **Note:** Store in Supabase Vault as `external_reviews_worker_secret`

---

## 10. Local Development `.env.local` Template

```env
# ─── Supabase (local) ───────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>

# ─── Paystack (test keys) ───────────────────────────────
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_XXXXXXXXXXXXXXXXXXXX
PAYSTACK_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXX
PAYSTACK_WEBHOOK_SECRET=                        # not needed locally

# ─── PayPal (sandbox) ───────────────────────────────────
NEXT_PUBLIC_PAYPAL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXX
PAYPAL_CLIENT_SECRET=XXXXXXXXXXXXXXXXXXXX
PAYPAL_WEBHOOK_ID=                              # not needed locally
NEXT_PUBLIC_PAYPAL_ENV=sandbox

# ─── Email ──────────────────────────────────────────────
RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXXXX
EMAIL_FROM_ADDRESS=noreply@wieloplatform.com

# ─── App ────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Wielo

# ─── Maps: keyless (Leaflet + OpenStreetMap + Photon/Nominatim) ─

# ─── Website CMS bot-hardening (Turnstile — inert if unset) ─
NEXT_PUBLIC_TURNSTILE_SITE_KEY=                 # leave blank locally
TURNSTILE_SECRET_KEY=                           # leave blank locally

# ─── Monitoring (optional locally) ─────────────────────
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

> Copy this into `.env.local` and fill in real values. Never commit `.env.local`.

---

## 10. Edge Function Environment Variables

Edge Functions in Supabase read environment variables via `Deno.env.get()`. Set these in:
- **Local dev:** `.env.local` file passed via `supabase functions serve --env-file .env.local`
- **Staging/Production:** Supabase Dashboard → Edge Functions → Secrets

Edge Functions need:
- `SUPABASE_URL` (auto-injected by Supabase runtime)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-injected by Supabase runtime)
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `NEXT_PUBLIC_APP_URL` (for generating links in emails)

---

*When adding a new environment variable: add it here, add it to `.env.example`, and add it to Vercel Environment Variables (Preview + Production, marked Sensitive) before deploying.*

---

## 11. Additional Variables (from DevStack.md)

### `GOOGLE_MAPS_API_KEY`
- **What:** Google Maps API key for Android mobile map rendering
- **Format:** `AIza...`
- **Where to get:** Google Cloud Console → APIs & Services → Credentials → Create API Key (restrict to Maps SDK for Android)
- **Used in:** `apps/mobile/app.json` (Android build config via EAS)
- **Environments:** All
- **Note:** Restrict this key to the app's Android package name in Google Cloud Console for production.

### `EXPO_ACCESS_TOKEN`
- **What:** Expo access token for EAS CLI authentication in CI/CD
- **Format:** Long alphanumeric string
- **Where to get:** expo.dev → Account Settings → Access Tokens → Create Token
- **Used in:** GitHub Actions CI (EAS Build + EAS Submit)
- **Environments:** CI only (not needed locally if you run `eas login` interactively)

### `SUPABASE_JWT_SECRET`
- **What:** JWT secret used for custom JWT validation in Edge Functions
- **Format:** Long random string
- **Where to get:** Supabase Dashboard → Project Settings → API → JWT Secret
- **Used in:** Edge Functions that need to verify JWTs manually (outside the standard `supabase.auth` flow)
- **Environments:** Staging, Production
- ⚠️ **Never expose to client. Edge Functions only.**

