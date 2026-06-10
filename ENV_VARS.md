# Vilo Platform — Environment Variables Reference

**Version:** 1.0
**Last Updated:** May 2026

This file documents every environment variable used across the platform, what it does, where to get it, and which environment it belongs in.

> **Never commit `.env.local` or any file containing real secret values. Use `.env.example` for templates and Doppler for staging/production.**

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
- **Value:** `Vilo <onboarding@resend.dev>` (dev / pre-domain) → `Vilo <noreply@viloplatform.com>` once the sending domain verifies in Resend
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
- **Where to get:** Generate once per environment; store in Doppler.
- **Used in:** Next.js server runtime (Server Actions, PDF route handlers) AND Supabase Edge Functions. Same key, two runtimes.
- **Environments:** All
- ⚠️ **Server-side only. Rotating the key requires re-encrypting every `account_number` row with a key-prefix migration; see the `v1.` prefix in `apps/web/lib/crypto/banking.ts`.**

### `PAYMENT_CIPHER_KEY`
- **What:** AES-256-GCM key used to encrypt the `secret_cipher` column of `host_payment_gateways` — i.e. each host's own Paystack secret key / PayPal client secret for direct booking payments. Separate from `BANKING_CIPHER_KEY` so the two blast radii are independent.
- **Format:** Base64-encoded 32 bytes — `openssl rand -base64 32`
- **Where to get:** Generate once per environment; store in Doppler (and Supabase Edge secrets if/when a payment Edge Function needs it).
- **Used in:** Next.js server runtime (Server Actions). The decrypted secret is used only to call the host's gateway and is NEVER returned to a client.
- **Environments:** All
- ⚠️ **Server-side only. If unset, secrets are stored as plain text (round-trips transparently) — fine for local dev, set it everywhere else. Rotating requires re-encrypting via the `v1.` prefix scheme in `apps/web/lib/crypto/payments.ts`.**

---

## 6. App Config

### `NEXT_PUBLIC_APP_URL`
- **What:** The full base URL of the web app (used for generating links in emails, callbacks)
- **Format:** `https://viloplatform.com` (production) | `https://staging.viloplatform.com` | `http://localhost:3000`
- **Used in:** Web, Edge Functions (for email links, OAuth redirects)
- **Environments:** All

### `NEXT_PUBLIC_APP_NAME`
- **What:** The product name used in UI and emails
- **Value:** `Vilo`
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

## 9. Local Development `.env.local` Template

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
EMAIL_FROM_ADDRESS=noreply@viloplatform.com

# ─── App ────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Vilo

# ─── Maps: keyless (Leaflet + OpenStreetMap + Photon/Nominatim) ─

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

*When adding a new environment variable: add it here, add it to `.env.example`, and add it to the Doppler configs for staging and production before deploying.*

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

