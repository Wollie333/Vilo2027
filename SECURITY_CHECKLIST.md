# Vilo Platform — Security Checklist

**Version:** 1.0
**Last Updated:** May 2026
**Run this checklist:** Before every production deployment. All items must be ✅ before going live.

---

## 1. Authentication & Sessions

- [ ] Email verification required before host onboarding can complete
- [ ] Password requirements enforced: min 8 chars (Supabase Auth handles this)
- [ ] Rate limiting on login attempts: Supabase Auth built-in — confirm it's enabled in dashboard
- [ ] Refresh token rotation enabled in Supabase Auth settings
- [ ] JWT expiry set appropriately (Supabase default: 1 hour access token, 7 days refresh)
- [ ] Web: session stored in httpOnly cookie via `@supabase/ssr` — confirm no `localStorage` usage for tokens
- [ ] Mobile: session stored in `expo-secure-store` — confirm no `AsyncStorage` usage for tokens
- [ ] Google OAuth: confirm callback URL whitelisted in Google Cloud Console

---

## 2. Row Level Security

Run this query against the production database. Every table must have RLS enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

- [ ] All tables show `rowsecurity = true`
- [ ] `anon` role cannot read: `payments`, `refund_requests`, `eft_banking_details`, `admin_audit_log`, `subscriptions`, `host_feature_overrides`, `booking_notes`
- [ ] `anon` role CAN read: `listings` (published only), `hosts` (active only), `reviews` (published only), `plan_features`, `platform_settings`
- [ ] Guests can only read/modify their own `bookings`, `conversations`, `messages`, `reviews`
- [ ] Hosts can only read/modify their own `listings`, `bookings`, `conversations`, `blocked_dates`
- [ ] Staff access matches documented permission matrix (cannot access billing/subscriptions)
- [ ] `super_admin` role has full access where expected
- [ ] `service_role` key is only used in Edge Functions (never in client-side code)
- [ ] **SECURITY DEFINER functions that take a `p_host_id` (or any owner id) verify
  ownership internally** — they bypass RLS, so a signed-in user could otherwise
  forge the id over PostgREST and read another host's data (an IDOR). Fixed
  2026-07-17 (`20260717000500` + `..0600`): 17 analytics functions now call
  `_assert_can_read_host(p_host_id)`, which RAISEs 42501 for a non-owner and is a
  no-op for service-role/internal callers (`auth.uid()` IS NULL). 🔑 **The guard
  helper `_can_read_host` must `COALESCE(... , false)`** — three-valued logic
  (`false OR NULL` = NULL, `NOT NULL` = NULL) made every `IF NOT _can_read_host`
  check fail OPEN until `..0600`. Re-check with:
  ```sql
  SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
    AND pg_get_function_arguments(p.oid) ILIKE '%p_host_id%'
    AND p.prosrc NOT ILIKE '%_can_read_host%'
    AND p.prosrc NOT ILIKE '%auth.uid()%';  -- any hit = an unguarded owner-scoped fn
  ```

Verify with grep:
```bash
grep -r "SUPABASE_SERVICE_ROLE_KEY" apps/web/src
grep -r "SUPABASE_SERVICE_ROLE_KEY" apps/mobile
# Both should return zero results
grep -r "NEXT_PUBLIC_SUPABASE_SERVICE" apps/
# Should return zero results
```

---

## 3. API & Edge Functions

- [ ] All public Edge Functions have input validation via Zod before any DB operation
- [ ] All public Edge Functions validate the JWT before performing any action requiring auth
- [ ] Rate limiting confirmed: directory endpoints at 60 req/min per IP
- [ ] Edge Functions return `{ success: false, error: { code, message } }` on all error paths — no stack traces leaked to clients
- [ ] No Edge Function exposes internal implementation details in error messages

---

## 4. Payment Security

- [ ] **Paystack webhook signature verified** (HMAC SHA-512 on `x-paystack-signature`) before any DB write
- [ ] **PayPal webhook verified** via PayPal Webhook Verification API before any DB write
- [ ] Paystack `PAYSTACK_WEBHOOK_SECRET` is set in production Edge Function secrets
- [ ] PayPal `PAYPAL_WEBHOOK_ID` is set in production Edge Function secrets
- [ ] Price is **never trusted from the client** — `booking-create` always recalculates using `calculate_booking_price` DB function
- [ ] Refund amount validated: `approved_amount <= original_payment.amount` in `refund-process`
- [ ] Duplicate webhook delivery handled: `provider_reference` unique constraint prevents double-processing
- [ ] Paystack live keys active (`pk_live_...` / `sk_live_...`) — test keys must not be in production

---

## 5. Sensitive Data

- [ ] EFT `account_number` encrypted at application layer before DB storage — never stored in plain text
- [ ] EFT banking details only accessible to guests with `payment_method = 'eft'` confirmed bookings — enforced via Edge Function, not PostgREST
- [ ] Guest banking details (for EFT refunds) encrypted before storage in `refund_requests.guest_banking_details`
- [ ] No PII in error logs (no emails, phone numbers, or names in Sentry breadcrumbs)
- [ ] No secrets in application logs (no API keys, webhook secrets in `console.log`)
- [ ] `admin_audit_log` captures all super admin actions — confirm inserts are happening in production

---

## 6. File Uploads

- [ ] Supabase Storage bucket policies restrict file types:
  - `listing-photos`: image/jpeg, image/png, image/webp only
  - `eft-proofs`: image/jpeg, image/png, application/pdf only
  - `refund-requests`: image/jpeg, image/png, application/pdf only
- [ ] File size limits enforced per bucket (10 MB max for most — see `supabase_database.md` Section 20)
- [ ] Private buckets (`eft-proofs`, `message-attachments`, `refund-requests`) have no public read access
- [ ] Storage RLS policies restrict uploads to authenticated users scoped to their own data

---

## 7. Web Security Headers

Confirm these headers are set in `next.config.ts` for production:

```typescript
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  // Content Security Policy — restrict script sources
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.paystack.co https://www.paypal.com; img-src 'self' data: https://*.supabase.co https://*.tile.openstreetmap.org; connect-src 'self' https://*.supabase.co https://photon.komoot.io https://nominatim.openstreetmap.org https://exp.host;" },
]
```

- [x] `X-Frame-Options: SAMEORIGIN` — prevents clickjacking. **NOT `DENY`** (the
  spec above): the Brand Studio + Brand Preview iframe the app's own pages, which
  `DENY` would break. Set globally in `next.config.mjs` (2026-06-22).
- [x] `X-Content-Type-Options: nosniff` — prevents MIME sniffing (`next.config.mjs`).
- [x] `Referrer-Policy: strict-origin-when-cross-origin` (`next.config.mjs`).
- [x] `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`
  (`next.config.mjs`).
- [x] `Strict-Transport-Security: max-age=31536000` — HSTS without
  `includeSubDomains`/`preload` (so a connected custom domain can't force HTTPS
  onto the host's unrelated subdomains) (`next.config.mjs`).
- [ ] **Content Security Policy — DEFERRED to the Step-1 live-QA pass.** Must
  allow Paystack/PayPal/Supabase/OpenStreetMap/YouTube/Turnstile/GA4/Meta and be
  validated in a real browser before enabling. Will use `frame-ancestors 'self'`
  to refine the clickjacking control alongside `X-Frame-Options`.
- [x] Every `dangerouslySetInnerHTML` render is fed SANITISED content — see §7b
  (a bare grep is expected to return the ~17 legitimate, sanitised sinks, not
  zero).

---

## 7b. Injection Defenses (XSS / SQL / CSS) — standing checks

These are the "must-do" checks whenever you add a search box, a rich-text field,
or a host-styleable surface. The codebase has ONE sanitiser for each vector —
use it; never hand-roll.

### SQL / PostgREST filter injection
The Supabase JS client parameterises `.eq()/.gt()/…` VALUES and two-arg
`.ilike(col, pattern)` — those are safe. The danger is the **filter-STRING**
methods (`.or()`, `.filter()`, `.not()`, `.match()`) where user input is
interpolated into the `column.operator.value` grammar: a raw `,` `(` `)` is read
as filter structure and can inject extra conditions.

- [x] Every `.or(...)`/`.filter(...)` built from a user search term runs the term
  through **`sanitizeSearch`** (`lib/search/sanitizeSearch.ts`) first — strips
  `, ( ) % _ *  \`, collapses whitespace, caps length. Unit-tested
  (`sanitizeSearch.test.ts`).
- [x] No raw SQL execution anywhere (no `exec`/`query`/`sql\`\`` with user input);
  SECURITY DEFINER functions use `format('%I'/'%L', …)`, never `|| arg`.

```bash
# Any .or()/.filter() that interpolates a variable must import sanitizeSearch:
grep -rn "\.or(\`\|\.filter(\`" apps/web/app apps/web/lib | grep '\${'
```

### HTML injection via the WYSIWYG / rich text
All stored rich HTML MUST pass a `sanitize-html` allowlist sanitiser (drops
`<script>/<style>/<iframe>`, `on*=` handlers, `javascript:`/`data:` schemes) on
WRITE and/or at the render chokepoint:

- [x] Listing / policy / website `rich_text` / enquiry HTML → **`sanitiseListingHtml`**
  (`lib/sanitiseHtml.ts`). Website sections also re-sanitised at render
  (`sanitiseSectionsHtml`).
- [x] Help / knowledge-base HTML → **`sanitizeHelpHtml`** (`lib/help/sanitize.ts`).
- [x] Plain-text-only surfaces (meta descriptions, push, email subjects) →
  **`stripHtml`**.
- [x] JSON-LD `<script>` blocks escape `<` → `<` (use `components/site/JsonLd.tsx`).

### CSS-value injection (host site styling)
Host-supplied CSS VALUES interpolated into a `<style dangerouslySetInnerHTML>`
body can break out of the element (`bg: "x}</style><script>…"`).

- [x] Every host style value (`bg`, `color`, `borderColor`, `backgroundImage`)
  interpolated into a `<style>` runs through **`sanitizeCssValue`**
  (`lib/website/cssValue.ts`) — strips `< > { } ; \ " '`. Applied at the
  `elementDecls`/`frameRules`/`resolveBorderColor` chokepoint in
  `components/site/sections/_shared.tsx`. Unit-tested (`cssValue.test.ts`).

> Accepted trust boundary: the Custom Code feature (`PageHeadCode`/`PageBodyCode`)
> lets a host run arbitrary JS on THEIR OWN public site by design — ownership +
> POPIA-consent gated. That is not the same as the unintended style-breakout above.

---

## 8. Secrets & Environment

- [ ] All secrets in Vercel Environment Variables (marked Sensitive) — not in `.env` files committed to git
- [ ] `.env.local` is in `.gitignore`
- [ ] No hardcoded API keys in source code
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only in Edge Function secrets — not in Vercel env vars
- [ ] Vercel environment variables reviewed — no secrets marked `NEXT_PUBLIC_` that shouldn't be

```bash
# Scan for accidental key exposure
grep -r "sk_live_" apps/
grep -r "sk_test_" apps/
grep -r "re_" apps/
# All should return zero results (keys must be in env vars only)
```

---

## 9. Admin Panel

- [ ] Admin panel accessible only to `super_admin` role — middleware check confirmed
- [ ] Impersonation sessions always create an `impersonation_sessions` record
- [ ] All admin mutations write to `admin_audit_log` before completing
- [ ] Impersonation banner is not dismissible and always visible during an active session
- [ ] Admin panel is not accessible from the mobile app

---

## 10. POPIA Compliance (South Africa)

- [ ] Privacy policy page live at `/privacy`
- [ ] Terms of service page live at `/terms`
- [ ] Cookie consent banner shown to new visitors (web)
- [ ] Data deletion request flow works: guest/host can request via account settings → admin review flow
- [ ] Supabase region is `af-south-1` (Cape Town) — verify in Supabase dashboard
- [ ] PostHog hosted on EU region (`eu.posthog.com`) — confirm in `ENV_VARS.md`
- [ ] No PII sent to PostHog event properties (only anonymised identifiers)

---

## 11. Calendar Sync (iCal)

- [ ] iCal export URLs use a per-listing secret token — confirm token is not guessable (32-byte random hex)
- [ ] iCal export endpoint does NOT require auth (must be subscribable by external calendars) but does validate the token
- [ ] iCal import: URL is fetched server-side only (Edge Function) — never from the client browser
- [ ] iCal import: validate the fetched content is valid RFC 5545 before parsing — reject non-iCal responses
- [ ] iCal import: cap imported events at 500 per feed to prevent DoS via giant feeds
- [ ] iCal import: only block dates within the next 24 months — ignore far-future events
- [ ] External feed URLs are stored in DB — confirm no SSRF vector (reject private IP ranges: 10.x, 192.168.x, localhost, 127.x)
- [ ] Feed error states do not expose raw error messages to the host UI — log to Sentry, show friendly message
- [ ] Rotating an iCal export token is an irreversible action — confirm host is warned before proceeding

---

## 12. Mobile App

- [ ] No sensitive data in `AsyncStorage` — all auth tokens in `expo-secure-store`
- [ ] Deep link scheme `vilo://` registered and verified in `app.json`
- [ ] No hardcoded secrets in `app.json` or `eas.json`
- [ ] Google Maps API key in Android build restricted to the app's package name in Google Cloud Console
- [ ] Push notification permissions requested gracefully with explanatory copy before system prompt

---

## Sign-Off

Before production deployment, this checklist must be reviewed and signed off:

| Item | Reviewer | Date | Status |
|---|---|---|---|
| Sections 1–4 (auth, RLS, API, payments) | | | |
| Sections 5–8 (data, uploads, headers, secrets) | | | |
| Sections 9–11 (admin, POPIA, mobile) | | | |

**All items must be ✅ before going live. No exceptions.**
