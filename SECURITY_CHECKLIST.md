# Vilo Platform — Security Checklist

**Version:** 1.0
**Last Updated:** May 2026
**Run this checklist:** Before every production deployment. All items must be ✅ before going live.

---

## Audit log — 2026-07-22 (run against PRODUCTION, not read from code)

Everything below was **probed live** with the public anon key and two real host
sessions. A tick here means a request was actually made and the response checked.

| Area | Result |
|---|---|
| RLS enabled on every public table | ✅ only PostGIS `spatial_ref_sys` is off (reference data, not a risk) |
| `anon` read on 11 sensitive tables | ✅ all return `[]` — and against tables that DO have rows, so the result is meaningful |
| Anon-callable functions (excl. PostGIS/triggers) | 19 real ones — 18 legitimate, **1 vulnerable → fixed** |
| Paystack webhook, unsigned + forged | ✅ 401, and **zero rows** written to `payments` / `platform_ledger` |
| PayPal webhook, unsigned | ✅ 401 |
| Cross-host IDOR (read) | ✅ scoped — bookings 3/29 and 1/29, banking 1/3, conversations 1/16 |
| Cross-host IDOR (write) | ✅ UPDATE + DELETE on another host's property affect **0 rows**; row verified unchanged |
| Client-supplied price | ✅ impossible — the checkout schema accepts no money field at all |

### The `docs/SCHEMA.md` red flags — all four judged

| Flagged | Verdict |
|---|---|
| `record_error_event` | 🔴 **vulnerable → fixed** (below) |
| `get_listing_policy_summary` | 🔴 **leaked draft listings → fixed**, migration `20260722163030`. Anon could read the policies of an unpublished listing (proven: "Mela Lodge"). Now gated on visibility / ownership / staff / super-admin / service_role, and returns `{}` for *both* hidden and nonexistent so no existence oracle remains. |
| `current_user_has_password` | ✅ **benign.** No parameters, scoped to `u.id = auth.uid()`. Probed: anon `false`, own session `true`, passing any argument gives `PGRST202`. It cannot be asked about another user. |
| `tr_help_article_feedback_counters` | 🔴 **silently broken → fixed**, migration `20260722163751`. SECURITY INVOKER updating a different RLS table: guests may insert feedback, but `help_articles` has no update policy for them, so the counter UPDATE matched zero rows with no error. Only an admin voting ever moved the numbers — the sole people who could test it were the sole people it worked for. Now SECURITY DEFINER with a pinned search_path. |

**🔴 Found and fixed: user-enumeration oracle** in `record_error_event`
(migration `20260722161500`). It is anon-executable by design, but wrote the
caller's `p_user_id` into a foreign-keyed column, so the response differed by
whether the uuid existed — random uuid `409`, real user `204`. Identity now comes
from `auth.uid()`; `p_user_id` is honoured only for `service_role`. Re-probed
after the fix: both cases `204`, and `user_id` lands NULL.

**Two traps worth remembering when re-running this:**
- **PostgREST returns 200/204 for "0 rows affected".** A write blocked by RLS
  looks like a success. Always re-read the target row to confirm it is untouched
  — status codes alone will tell you the opposite of the truth.
- **Pick the IDOR victim by the attacker's real owner id**, via `get_my_host_id()`
  under their JWT. Comparing against "some other row" can hand the attacker their
  own record and produce a scary-looking false positive (a FK `409` that is
  simply correct behaviour).

Still unticked below = **not yet verified**, not "known broken". The Supabase
dashboard items (token rotation, JWT expiry, login rate limiting) are founder-only.

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

Verified 2026-07-22 against the real code and the live database.

- [x] **Admin panel gated** — but **NOT in middleware** (`middleware.ts` has no admin
  branch; don't go looking for one). The gate is `requireAdmin()` in
  `app/[locale]/admin/layout.tsx`, which covers every admin *page*, plus a
  `requirePermission(key)` in every admin *server action* — server actions do not
  inherit a layout, so the layout alone would not protect them. Checked all **42**
  files under `app/[locale]/admin/**/actions.ts*`: every one calls
  `requirePermission` / `withAdminAudit` / `requireAdmin`.
  ⚠️ The gate is **active `platform_staff` + per-role permission**, not literally
  `role = 'super_admin'`; super_admin inherits every key. Re-check with:
  ```bash
  for f in $(find "app/[locale]/admin" -name "actions.ts*"); do
    grep -qE "requirePermission|withAdminAudit|requireAdmin" "$f" || echo "NO-GATE: $f"
  done
  ```
- [x] **Impersonation always creates an `impersonation_sessions` record** —
  `openImpersonationSession()` inserts before the signed cookie is set, and it is
  the only path. Session id, target and expiry are HMAC-signed; expiry is enforced
  **server-side** (a copied cookie would otherwise verify forever).
  ⚠️ `impersonation_sessions` reading **empty** while an `impersonation` audit row
  survives is **correct, not a bug**: `app_purge_user_account` DELETEs sessions but
  only NULLs `admin_audit_log.admin_id` / `impersonating` (anonymise, never delete).
- [x] **All admin mutations write to `admin_audit_log`** — fixed 2026-07-22. The six
  Looking-For moderation actions (flag/unflag/remove/suspend/resume/reinstate) wrote
  **no audit row at all**; there was no `target_type` that fitted, so migration
  `20260722213000` added `looking_for_post` and all six now run through
  `withAdminAudit`. Confirmed no DB trigger was auditing them behind the app's back —
  only `app_purge_user_account` and `forbid_admin_audit_log_mutation` reference the
  table.
  🔴 **And the writes themselves could vanish.** Five call sites hand-rolled the
  insert with a RAW `x-forwarded-for` and **discarded `{ error }`**. `ip_address` is
  a Postgres `inet` — proven live that `'unknown'` (proxies send this literal),
  `'102.65.1.1:443'` and `'fe80::1%eth0'` all fail `22P02`, so the row was dropped in
  silence. Every writer now goes through **`lib/admin/auditWrite.ts`**, which
  normalises the ip, retries without it, logs, and throws outside production.
  🔑 Note the ordering caveat: `withAdminAudit` writes the row **after** the mutation
  commits (eventual consistency), not before. `AGENT_RULES.md` §6.8 still requires
  finance/moderation actions to route through an Edge Function so the audit insert
  shares the transaction.
- [x] **Impersonation banner is not dismissible** — `ImpersonationBanner` renders in
  the admin layout's `banner` slot whenever the cookie verifies, and its only control
  is "End session". There is no dismiss affordance and no client state to hide it.
- [x] **Admin panel is not accessible from the mobile app** — `grep -rIn "admin"
  apps/mobile/src` returns **zero** matches. (Note: mobile source lives in
  `apps/mobile/src`, not `apps/mobile/app`.)
- [ ] ⚠️ **`/admin/platform/errors` is gated by `requireAdmin()` only** — no
  permission key, so ANY active staff member of ANY role can resolve error events.
  That deviates from `AGENT_RULES.md` §6.4 (RBAC via the DB, not an `is_active`-only
  check). Page and action are at least consistent with each other. Founder call:
  pick a key (`platform.settings`?) or document it as intentionally all-staff.

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
