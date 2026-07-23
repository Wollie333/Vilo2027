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

App-side items verified 2026-07-23 (dashboard-only items covered in pt64).

- [x] **Email verification is now HARD-REQUIRED — implemented 2026-07-23 (founder
  directive).** GoTrue runs auto-confirm ON, so the app tracks its OWN
  `user_profiles.email_verified_at`, set via a **stateless HMAC-signed** verify link
  (3-day TTL, rotation-aware, constant-time verify, dedicated `email-verify` secret —
  NOT the service-role key; `lib/auth/verifyEmail.ts`). **Every signed-in non-staff
  user is now WALLED** at `/verify-email-required` until they confirm:
  - **UI layer** — `dashboard/layout.tsx` + `portal/layout.tsx` redirect unverified
    non-staff to the wall (mirrors the `/suspended` wall; the page bounces a
    verified/staff user back so nobody is stranded). Platform staff exempt.
  - **Server layer** — `requireHost()` + `assertFullHost()` (`lib/host/current.ts`)
    reject unverified callers with `EMAIL_NOT_VERIFIED_ERROR`, so a crafted action
    call can't skip the UI wall. Fails OPEN only on an unreadable profile row.
  - **Guest booking is deliberately NOT blocked** — the directory booking flow
    creates the account inline and sends this very verification email, so blocking it
    would break first-time booking; the wall covers the persistent portal instead.
  - **Verified live** (dev): unverified `guest@` → both `/dashboard` and `/portal`
    redirect to the wall (correct email shown); after verifying, the portal renders;
    a verified/staff user is bounced off the wall. Seed scripts pre-stamp
    `email_verified_at` so re-seeds aren't walled.
- [x] Password min 8 — set in the Supabase dashboard (pt64, raised 6→8).
- [x] Login rate limiting — Supabase built-in confirmed active (pt64); app-side
  signup/re-auth throttle in `lib/auth/rateLimit.ts` (see §3).
- [x] Refresh-token rotation / reuse-detection — verified working (pt64).
- [ ] JWT expiry appropriate — Supabase default (dashboard, founder to confirm).
- [x] **Web session is httpOnly-cookie via `@supabase/ssr`; NO auth token in
  `localStorage`** — grepped every `localStorage`/`sessionStorage` use in `apps/`:
  all are UI prefs (sidebar, tour, cookie consent), autosave drafts, and analytics
  session ids — **zero auth tokens**.
- [x] **Mobile session is in `expo-secure-store`; NO `AsyncStorage`** — proven:
  `apps/mobile/src/lib/supabase.ts` wires an `ExpoSecureStoreAdapter` as the Supabase
  auth `storage`, and there are **zero** `AsyncStorage` references anywhere in `apps/`.
- [ ] Google OAuth callback URL whitelisted in Google Cloud Console (dashboard, founder).

---

## 2. Row Level Security

Run this query against the production database. Every table must have RLS enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

- [x] All tables show `rowsecurity = true` (only PostGIS `spatial_ref_sys` off — reference data; see the 2026-07-22 audit block above)
- [x] `anon` cannot read `payments`/`eft_banking_details`/`subscriptions`/… — 2026-07-22 audit block, all `[]`
- [x] `anon` CAN read **published** listings, not unpublished — proven live
  2026-07-23: `properties?is_published=eq.true` → rows; `is_published=eq.false` →
  `[]`. ⚠️ **Spec correction:** `plan_features` is NOT anon-readable — its only
  SELECT policy is `authenticated_read_plan_features` (6 rows exist; anon gets
  `[]`). That is *stricter* than this line claimed, so it's fine security-wise, but
  any public pricing surface must read it server-side/authenticated, not as anon.
- [x] **Guests can only read their own `bookings`, `conversations`, `messages`,
  `reviews`** — proven live 2026-07-23 (guest `guest@wielostarter.com`): sees
  **14/29 bookings — exactly their own 14**, **2/16 conversations — exactly their
  own 2**, 8 messages (all within those 2 conversations), and 4 reviews (all 4 are
  `is_published=true` — reviews are public when published, no unpublished leak).
- [x] **Guests can only read their own `payments`** — proven live 2026-07-23: the
  same session reads exactly 3 `payments` rows and **all 3 are their own bookings'
  payments** (`guest_read_own_payments` scopes SELECT to `booking_id IN (bookings
  WHERE guest_id = auth.uid())`); reads `[]` from `eft_banking_details` and
  `subscriptions`.
- [x] Hosts can only read/modify their own `listings`, `bookings`, `conversations`, `blocked_dates` — cross-host IDOR read **and** write proven scoped in the 2026-07-22 audit block (UPDATE/DELETE on another host's property affect 0 rows; row verified unchanged)
- [x] **Staff permission matrix is least-privilege for money** — proven live
  2026-07-23 from `admin_role_permissions`: only `finance` + `super_admin` hold
  the *mutating* finance keys (`payments.refund`, `subscriptions.edit`);
  `content_mod` (8 keys) and `ops` (4 keys) hold **zero** billing/subscription
  keys; `support_agent` is read-only here (`payments.view` only, no refund/edit).
  (⚠️ `payments.refund` still has zero call sites — §6.8/§9; the grant is
  forward-looking.)
- [x] `super_admin` has full access — 24 permission keys (every key), and the
  `admin_full_*` RLS policies gate on `is_super_admin()`.
- [x] `service_role` key is only used server-side (never client) — grep below
  returns **zero** in `apps/web/src` + `apps/mobile`; the key appears only in
  server-only libs (`lib/supabase/admin.ts`, `lib/auth/rateLimit.ts`,
  `lib/finance/statement-token.ts`, `lib/ical.ts`, API-route workers).
- [x] **SECDEF owner-scoped functions re-checked 2026-07-23 — the heuristic below
  flags 11, but ALL are safe.** The trap query (in-body `_can_read_host`/`auth.uid`
  guard) produces FALSE POSITIVES when EXECUTE is locked down instead — which is
  the real defence here. Of the 11 `p_host_id` functions it flags, **10 have
  EXECUTE revoked from PUBLIC and granted only to `postgres` + `service_role`**
  (incl. the money fn `apply_wielo_credit`), so a forged-id caller can't reach them
  over PostgREST — **proven live**: as an authenticated guest, `apply_wielo_credit`
  and `ensure_host_default_policies` both return `42501 permission denied` (403).
  The **one** anon/authenticated-callable hit, `host_public_suppressed`, returns a
  single boolean (`hidden_from_directory OR user-inactive`) that the public
  directory *must* be able to ask, with `COALESCE(...,false)` so a nonexistent id
  is not an existence oracle — returns `false` (200) to the guest. No IDOR.
- [x] **SECURITY DEFINER functions that take a `p_host_id` (or any owner id) verify
  ownership internally** (re-confirmed 2026-07-23, see the bullet above) — they bypass RLS, so a signed-in user could otherwise
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

Verified 2026-07-23 by reading all **6** deployed functions (`supabase functions
list`: `_shared`, `external-review-reply`, `external-reviews-sync`,
`paystack-webhook`, `report-scheduler`, `track-listing-view`; PayPal is a Next.js
API route, see §4).

- [x] **Public Edge Functions validate input before any DB write** — ⚠️ *manual*
  validation, not Zod (the Deno functions predate the shared schema pkg), but it is
  strict: `track-listing-view` (the public beacon) UUID-regex-gates `property_id`
  → 400, allowlists `device`/`country`, clamps `duration`; `external-review-reply`
  requires `review_id`+`reply` → 400; the two webhooks gate on signature before
  anything. `external-reviews-sync` takes no user input (reads sources from the DB).
- [x] **Auth validated before any action that needs it, and it FAILS CLOSED.**
  `external-review-reply` builds the client with the **caller's JWT** so RLS
  enforces review ownership (non-owner ⇒ 404 "access denied"), not the service
  role. `external-reviews-sync` requires a cron secret (timing-safe) **or** a
  `service_role` role-CLAIM bearer — the pt63 `return true` no-op is gone (proven
  wired: `isAuthorized` gates at line 99 → 401). `report-scheduler` refuses if
  `REPORT_SCHEDULER_SECRET` is unset → 401. `paystack-webhook` = HMAC + constant-time
  + `--no-verify-jwt` (§4).
- [ ] **Rate limiting — abuse-prone WRITES are covered; directory READS are not.**
  ⚠️ Correction: there is no per-IP limit on directory read endpoints (the "60
  req/min" line was aspirational — `track-listing-view` and public browse have
  none). What EXISTS (`lib/auth/rateLimit.ts`, salted-IP-hash ledger in
  `signup_rate_limits`, independent per-`purpose` buckets, **fail-open** behind
  Turnstile) guards the endpoints that actually matter for abuse: all signup flows
  (8/60 min), re-auth/password-verify (tighter), public enquiries, looking-for
  posts, website enquiries, and site checkout. Directory reads are stateless +
  RLS-safe, so this is a DoS/scraping-hardening gap, not a vulnerability — revisit
  with a real limiter (Vercel edge / Upstash) at scale.
- [x] **All error paths return `{ success: false, error: { code, message } }`
  with a GENERIC message** — every top-level `catch` in the 4 non-webhook functions
  returns `INTERNAL_ERROR` / a scoped code, never `error.message`, to the caller.
- [x] **No internal details leaked** — the `track-listing-view` property-existence
  oracle and the `external-reviews-sync` bare-string leak are both fixed (pt63/pt65).
  The only surviving `error.message` returns are (a) into per-source `results` for
  the **authenticated** sync caller (external-API text, not Postgres internals) and
  (b) DB columns (`last_sync_error`) — neither reaches an anonymous client.

---

## 4. Payment Security

Verified 2026-07-22 against the real code and the live database.

> ⚠️ **This section used to name three things that do not exist.** There is no
> `refund-process` Edge Function, no `booking-create` Edge Function, and the app
> does not call `calculate_booking_price`. Only **six** Edge Functions are
> deployed — `_shared`, `external-review-reply`, `external-reviews-sync`,
> `paystack-webhook`, `report-scheduler`, `track-listing-view` — and the PayPal
> webhook is a **Next.js API route**, not an Edge Function. The controls below are
> real and sound; the file names were stale. Check `supabase functions list`
> before writing an Edge Function name into this doc again.

- [x] **Paystack webhook signature verified** (HMAC SHA-512 on `x-paystack-signature`)
  before any DB write — `supabase/functions/paystack-webhook/index.ts`. Fails
  closed: no signature or no configured key that matches ⇒ `401`, before any
  write. It resolves the environment *from the key that matched*, so a test-key
  event can't be processed as live. Confirmed live in the audit block above:
  unsigned + forged both `401`, with **zero** rows written to `payments` /
  `platform_ledger`.
- [x] **PayPal webhook verified** via PayPal's `verify-webhook-signature` API
  before any DB write — `apps/web/app/api/paypal-webhook/route.ts` (**an API
  route, not an Edge Function**), using `verifyPayPalWebhookSignature`
  (`lib/paypal`). Headers alone are forgeable, so it calls PayPal to verify.
  Fails closed twice over: **no `PAYPAL_WEBHOOK_ID` ⇒ refuse**, unverifiable
  event ⇒ refuse. Confirmed live: unsigned ⇒ `401`.
- [x] **`PAYSTACK_WEBHOOK_SECRET` / `PAYPAL_WEBHOOK_ID` set in production** —
  both present; Doppler is the single source of truth and Vercel prod matches it
  exactly (29 vars, zero drift). See `docs/SECRETS_RUNBOOK.md`.
- [x] **Price is never trusted from the client** — the real chokepoint is
  **`lib/bookings/createBooking.ts`**, which recomputes every amount through
  **`priceStay`** (`lib/pricing`, the SSOT per `RULES.md` §3). Public on-site
  checkout (`app/api/site-booking/route.ts`) goes through the same core.
  ⚠️ `calculate_booking_price` is a **legacy DB function the app no longer
  calls** — it survives only in migrations, a README and a test script. Don't
  "restore" it. Confirmed in the audit block: the checkout schema accepts **no
  money field at all**, so there is nothing to tamper with.
- [x] **Refund amount validated** — enforced in the **database**, not just the
  app: `payments_refunded_le_amount CHECK (COALESCE(refunded_amount,0) <= amount)`
  (migration `20260717001000`). This is the backstop for a real race: the app
  checks `approved <= amount - refunded_amount`, but `refunded_amount` is only
  bumped later by the completion trigger, so two concurrent approvals both passed
  the app check. The CHECK rejects the overflowing one atomically (`23514`).
  Host self-service refunds live in `app/[locale]/dashboard/refunds/`.
- [x] **Duplicate webhook delivery handled** — `unique_provider_reference UNIQUE
  (provider_reference)` on `payments`, verified on the live database.
- [ ] **Paystack live keys** — **deferred on purpose** to launch day, see
  `docs/SMOKE_TESTS.md` §0.5 **G3**. Test keys staying active until then is
  intended, not an oversight.
- [x] **HMAC compared in constant time** — fixed + deployed 2026-07-22 (function
  version 20). It used `hash === signature`, which short-circuits at the first
  differing character and leaks how much of a guessed signature was correct.
  🔑 Deliberately a **plain XOR loop, not `timingSafeEqual`**: both `matchesSecret`
  calls sit inside a `try/catch` that returns `null`, so if `timingSafeEqual` were
  missing or threw in the Deno runtime, every **valid** webhook would be silently
  rejected and look identical to a bad signature — card payments would stop
  settling with nothing in the logs. There is no Deno or Docker on this machine to
  test that against, so the version with **no runtime-API dependency** is the one
  that ships. Accept + reject proven at unit level; on the deployed function:
  `GET → 405` (module booted), forged 128-char signature → `401 Invalid signature`
  (exercises the full equal-length loop), short signature → `401` (length guard,
  no throw).

- [x] 🔴 **The webhook was UNREACHABLE by Paystack — fixed 2026-07-22.** It was
  deployed with `verify_jwt` **on** (the CLI default), so the Supabase **edge
  gateway** rejected every request Paystack could actually make, before the
  function ever ran. Bare POST, `?apikey=<anon>` and an `apikey:` header all
  returned `{"code":"UNAUTHORIZED_NO_AUTH_HEADER"}`; only `Authorization: Bearer`
  got through, **which Paystack does not send**.

  **Proof it had never fired, not a guess:** the handler writes the raw event to
  `payments.provider_response` on *every* event, before any branching. All three
  Paystack payments — **including both that completed on 18 and 19 July** — have
  `provider_response IS NULL`. Card payments were being settled by the checkout
  **callback** / `booking-reconcile-worker` instead, so a working fallback hid a
  completely dead path for months (`RULES.md` §8.1: "test payments worked" is
  true of both worlds and therefore proves neither).

  ⚠️ **This is why the old check passed.** `docs/BETA_INFRA.md` recorded the
  webhook as "deployed + signature-gated (`POST … → 401`)". That 401 was the
  **gateway's**, not the function's — identical status code, different body.
  Read the BODY (`RULES.md` §2).

  Redeployed with `--no-verify-jwt`, which is the correct posture for a webhook:
  **the HMAC is the authentication.** Re-verified after the change, with **no
  auth header at all**: a Paystack-shaped `charge.success` with no signature →
  `401 Invalid signature`; forged 128-char signature → `401`; short signature →
  `401`; `GET` → `405`. And **zero rows written** — no `payments`, no
  `platform_ledger`, no `product_orders`.
  🔑 **Redeploying this function without `--no-verify-jwt` silently breaks it
  again.** Same for any other webhook endpoint.

  ✅ **And it is no longer a single point of failure** — `/api/product-order-reconcile-worker`
  + cron `reconcile-product-orders` (migration `20260723000500`) added 2026-07-22.
  Bookings had `reconcile-host-card-payments` and subscriptions had
  `subscription-reconcile-worker`, but `product_orders` had **nothing**, so for
  Wielo's own revenue the webhook was the only net. It settles through the
  canonical `confirmProductOrderByReference`, so an unpaid reference is left
  alone rather than force-settled.

  ⚖️ **Severity, corrected 2026-07-22 — the webhook is a BACKSTOP, not the
  primary settle path.** `confirmProductOrderByReference` says so in as many
  words: *"This is the PRIMARY settle path (the webhook is an idempotent
  backstop)"*, and bookings mirror it via `confirmHostCardPaymentByReference` +
  `booking-reconcile-worker`. So this was **a missing safety net, not a payments
  outage** — which is exactly why card payments have always worked. ⚠️ Note this
  **contradicts `docs/SMOKE_TESTS.md` §0.5 G3**, which calls the webhook *"the
  ONLY settle path for card money"*. The code is right; G3's wording is wrong.
  What was actually lost: the buyer who **closes the tab before redirecting
  back** never triggers the callback, so their order sat `pending` with their
  money taken. That is the case the backstop exists for.

- [x] ✅ **PROVEN DELIVERING — 2026-07-22 20:58:57 UTC.** Made instrumentation
  the fix rather than arguing from inference: **`webhook_deliveries`** (migration
  `20260722234500`) records one row per signature-verified delivery, written
  **before** any business logic, so delivery is observable even when the handler
  legitimately does nothing. First real transaction after deploying it:
  `event_type='charge.success'`, `outcome='processed'`, `environment='test'`.
  🔑 `environment` is resolved **from the key that matched**, so that value alone
  proves the HMAC verified. The founder's Paystack webhook URL is registered
  correctly.

  **This is now the standing check — one query, no reasoning required:**
  ```sql
  SELECT received_at, event_type, outcome, environment, reference
  FROM webhook_deliveries ORDER BY received_at DESC LIMIT 20;
  ```
  `outcome` stuck on `'received'` = the handler threw. `'error'` = processEvent
  failed and Paystack was asked to retry. No rows after a card payment = not
  being delivered.
  ⚠️ Deliberately logs **only signature-verified** deliveries: the endpoint must
  be unauthenticated (the HMAC is the auth), so logging rejects would let anyone
  grow the table at will. A rejected delivery shows as a 401 in Paystack's
  dashboard instead.

### ⚠️ Why the DATABASE ALONE could not verify this (before the log existed)

Attempted 2026-07-22 with three real test transactions; recording it so nobody
burns the time again:
- **A successful payment proves nothing.** Both settle paths write *identical*
  state (`status='paid'`, `paid_at`, `method='paystack'`), and whichever loses
  the compare-and-set exits silently. The webhook leaves **no trace** when the
  order is already paid.
- **`payments.provider_response` does not help for product orders** — that write
  is scoped to a `payments` row, and a product order has none.
- **A declined card proves nothing either.** Only the webhook sets
  `product_orders.status='failed'` (verified: no app code ever does), but a
  declined test charge stayed `pending` through 6 polls — Paystack does not
  reliably emit `charge.failed` for it.
- **Abandoning the checkout is the right idea but not conclusive** — the order
  settled, yet the ~2s before navigating away is enough for the callback to have
  won. Not proof.

📌 **The only definitive check is the Paystack dashboard** → the transaction →
its **webhook / event delivery log** (attempts, response codes). A `200` there
means delivery works. Confirm the registered URL is
`https://zlcivjgvtyeaszikqleu.supabase.co/functions/v1/paystack-webhook`, on the
**Test** and **Live** webhook fields (not the Callback URL field — the app sends
its own `callback_url` per transaction).

---

## 5. Sensitive Data

Verified 2026-07-23 against the live database (probed, not read from code).

- [x] **EFT `account_number` encrypted at rest** — AES-256-GCM, storage format
  `v1.<nonce>.<ct>.<tag>` (`lib/crypto/banking.ts`, matching Deno impl in
  `supabase/functions/_shared/banking-crypto.ts`). **Proven live: all 3 rows in
  `eft_banking_details` are `v1.…` (4 dot-parts, not plain-numeric)** — zero
  plaintext. Encryption is deliberately *optional* (no key ⇒ plain, host EFT
  deposit accounts are a public business detail), but the key IS set in prod so
  every stored row is encrypted. Decrypt sniffs the format so legacy-plain rows
  round-trip without a migration.
- [x] **EFT banking is gated by booking ownership, NOT read by the guest over
  PostgREST.** ⚠️ The old wording "enforced via Edge Function" was stale (like the
  §4 phantom names). The real path: `app/[locale]/booking/[id]/success/page.tsx`
  (a Server Component) loads the booking with the **RLS-scoped user client**
  (`guest_read_own_bookings` ⇒ the guest can only reach *their own* booking, else
  `notFound()`), and only THEN uses the service-role admin client to fetch +
  decrypt the host's deposit account for that booking. **Proven live**: an
  authenticated guest session reading `eft_banking_details` over PostgREST returns
  `[]` (its only RLS policies are super-admin + `host_id = own host`; no
  guest-facing SELECT policy exists).
- [x] **Guest-banking-for-EFT-refunds — N/A, the feature does not exist.**
  `refund_requests.guest_banking_details` has **zero write sites** in app code and
  the one live row is NULL. Refunds return through the **original** payment
  provider (Paystack/PayPal), so no guest bank account is ever collected. The
  column is unused schema — don't "wire encryption" for data that is never stored.
- [x] **No PII in error logs — reviewed 2026-07-23.** ⚠️ There is NO Sentry (no
  `@sentry` package, config, or import anywhere) — so there is no third-party
  breadcrumb sink to leak into. Errors go to the app's OWN sink: `reportError`
  (`lib/observability/reportError.ts`) → `record_error_event` → the `error_events`
  table. It stores `message`/`stack`/`url` (truncated) + a **uuid** `user_id`
  resolved SERVER-side (never a client-supplied identity; the enumeration oracle was
  fixed in pt63), never an email/name/phone field. The grouping *fingerprint* is
  scrubbed (strips uuids, long digit runs, long path segments). **Access is airtight:
  `error_events` has RLS ENABLED with ZERO policies → deny-by-default; only the
  service-role admin client can read it, behind the `platform.settings`-gated
  `/admin/platform/errors` page.** Proven live: an authenticated guest reads `[]`.
  Residual (low, acceptable for beta): the raw `message`/`stack` text is not actively
  scrubbed, so a PII substring baked into an error string would be stored — but only
  ops/super_admin can ever see it. A `beforeStore` scrubber is a nice-to-have, not a
  launch blocker.
- [x] **No secret VALUES or PII in production logs.** Grepped every
  `console.*` in `apps/web` for `account_number|secret|password|api_key|token|
  cipher`: the only hits are (1) dev **seed scripts** printing *test* account
  creds to the operator's terminal (not shipped runtime), (2) `passwordReset.ts`
  logging the send *error message* (not the password), (3) `ical-sync-worker`
  logging the *name* of an unset secret, not its value. `lib/crypto/banking.ts`
  carries an explicit "NEVER log ciphertext/plaintext/field-name+row-id" rule.
- [x] **`admin_audit_log` inserts ARE happening in production** — proven live:
  236 rows, latest `2026-07-23 08:26 UTC`, **23 in the last 48 h**. (Append-only:
  anonymise-not-delete, `forbid_admin_audit_log_mutation`.)

---

## 6. File Uploads

Verified 2026-07-23 against the live `storage.buckets` + `storage.objects` RLS.

- [x] **Bucket file-type allowlists match spec** — `listing-photos` =
  jpeg/png/webp; `eft-proofs` = jpeg/png/pdf; `refund-requests` = jpeg/png/pdf
  (exact match). All image buckets are jpeg/png/webp(+gif/svg where noted).
- [x] **Size limits enforced** — 5–20 MB per bucket. ⚠️ Three buckets carry NO
  MIME/size limit (`marketing-assets`, `host-brochures`, `quote-uploads`) — but
  **none of them has a client INSERT policy**, so only the service role (Server
  Actions, which validate server-side) can write them. `marketing-assets` being
  *public + any-mime* is therefore NOT user-writable — the "any" is safe.
- [x] **Private buckets have no public read** — `eft-proofs`, `message-attachments`,
  `refund-requests`, plus `invoice-pdfs`, `credit-note-pdfs`, `quote-uploads`,
  `host-brochures` are all `public=false` with **no `public_read` policy**; their
  SELECT policies scope to booking/conversation participants or the owner host/guest
  (+ super-admin for refund docs). The Storage CDN won't serve them without a signed
  URL.
- [x] **Every upload (INSERT) policy is authenticated + owner-scoped** — each
  `with_check` requires `auth.uid()` AND a folder-ownership match: host uploads keyed
  to `get_my_host_id()` owning the property/website/addon; guest uploads keyed to
  `bookings.guest_id = auth.uid()`; avatar/lf-images keyed to the `auth.uid()`
  top-level folder. No unauthenticated or cross-owner write path exists.
- ⚠️ **FLAGGED (low, defense-in-depth) — WEBSITE SUB-BRANCH TERRITORY, do NOT action
  from main:** `website-assets` is **public + host-writable + allows `image/svg+xml`**.
  An SVG can carry `<script>` that runs when the object URL is opened as a top-level
  document. It's served from the storage origin (not the app's cookie domain) and is
  the host's own content, so impact is limited. The website builder is being built in
  a separate sub-branch (founder directive: leave all website features alone) — this
  note is for that branch to weigh (drop `svg`, or serve `Content-Disposition:
  attachment`, only if the builder doesn't rely on SVG logos). Not changed here.

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

Verified 2026-07-23 (source scan) + pt62 (Doppler = single source of truth, 0 plaintext).

- [x] Secrets live in Doppler → synced to Vercel/Supabase, not committed (pt62).
- [x] `.env.local` is gitignored — `git check-ignore` confirms both root and
  `apps/web/.env.local`.
- [x] **No hardcoded API keys in source** — grep for `sk_live_`/`sk_test_`/`re_…`
  across `apps/web/{app,lib}` + `apps/mobile/src` returns **zero** (test files excluded).
- [x] `SUPABASE_SERVICE_ROLE_KEY` is server-side only — 0 client hits (§2); ⚠️ note it
  IS a Vercel *server* env var (Server Actions need it), which the original wording
  ("Edge Function secrets only") didn't allow for — that's correct, not a leak, since
  it's never `NEXT_PUBLIC_`.
- [x] **No mis-prefixed public secrets** — grep for
  `NEXT_PUBLIC_*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)` returns zero.

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
- [x] **`/admin/platform/errors` now requires `platform.settings`** — fixed
  2026-07-22. It took only `requireAdmin()`, so ANY active staff of ANY role could
  resolve error events *and* read `configHealth()`, which reports which platform
  secrets are configured. `platform.settings` is held by `ops` + `super_admin`
  only; `content_mod`, `support_agent` and `finance` do **not** hold it (verified
  against `admin_role_permissions`). Page and action both gated.
- [x] **Wielo support inbox sends are audited** — fixed 2026-07-22, migration
  `20260722224500` adds the `conversation` target type. Posting as "Wielo Support"
  and sending payment links are outbound messages to real users made on the
  platform's behalf, previously with no record of which staff member sent them.
  `adminMarkPlatformReadAction` is deliberately NOT audited (clearing the admin
  side's own unread counter changes nothing a user can see).
- [x] **Finance/moderation atomicity (`AGENT_RULES.md` §6.8)** — `users.suspend` is
  done via `admin_set_user_active` (migration `20260722231500`): the mutation and
  its audit row commit in ONE transaction. **Proven** by forcing the audit INSERT
  to fail with a bad `admin_id` — the suspension rolled back with it (`23503`,
  `is_active` unchanged), plus a blank reason rejected (`22023`) and
  `anon`/`authenticated` having **no** EXECUTE.
  🔑 **§6.8's old wording was wrong and has been corrected:** it prescribed an Edge
  Function wrapping `BEGIN … COMMIT`, but an Edge Function reaches the DB over
  PostgREST and **every PostgREST request is its own transaction** — that gives no
  atomicity at all. Only a single DB call (plpgsql function via RPC) does.
  ⚠️ `payments.refund` and `bookings.cancel` are seeded and granted to `finance`
  but have **zero call sites** — there is no admin refund or booking-cancel action
  yet, so §6.8 is forward-looking for those two.

---

## 10. POPIA Compliance (South Africa)

Verified 2026-07-23 (routes/flows present); dashboard/region items are founder-only.

- [x] Privacy page live at `/privacy` (`app/[locale]/privacy/page.tsx`) — renders a
  DB-stored legal doc, not the .tsx (pt60).
- [x] Terms page live at `/terms` (`app/[locale]/terms/page.tsx`) — same DB-doc render.
- [x] Cookie consent banner exists (`app/_components/CookieBanner.tsx`, choice persisted;
  privacy-first default per the harness rules).
- [x] Data-deletion flow exists — `dashboard/settings/data/` (`DeleteAccountSection.tsx`
  + `actions.ts`), backed by `app_purge_user_account` (the GDPR purge derived from the
  live FK graph).
- [ ] Supabase region `af-south-1` — dashboard, founder to confirm.
- [n/a] PostHog EU region / no-PII — **PostHog is not referenced in app code** (no
  `posthog` import or host in `apps/web`); if analytics land later, re-open these two.

---

## 11. Calendar Sync (iCal)

Verified 2026-07-23 by reading the real `lib/ical*.ts`, `lib/security/ssrf.ts`, and
the export route (NOT the in-repo worktree copies, which greps also surface).

- [x] **Export token is unguessable** — HMAC-SHA256(`ICAL_TOKEN_SECRET`, listingId),
  base64url, 22 chars ≈ **128 bits** (`lib/ical.ts`). ⚠️ Not the "32-byte random hex"
  the spec named — it's *derived* (no `ical_feeds` table yet; per-listing rotation is
  Phase 3) and 128-bit, but secret-keyed so unforgeable without the secret, and it
  deliberately **refuses to fall back to the service-role key**.
- [x] **Export endpoint is token-gated, no auth session** —
  `app/ical/[property_id]/[token]/route.ts`: uuid-validates the id (400), 503 if
  `ICAL_TOKEN_SECRET` unset, `verifyListingToken` **constant-time** (`timingSafeEqual`)
  → 401 on a bad token; only ever emits `blocked_dates`. 🔑 **Event SUMMARY is generic
  ("Booked"/"Blocked" + room) — the free-text block `reason` is deliberately NEVER
  echoed** (could hold guest PII; BOOKING_SYNC.md "No guest data exported").
- [x] **Import is server-side only** — `syncFeed` (`lib/ical-sync.ts`) is `server-only`,
  called by the "Sync now" action + the `ical-sync-worker` cron; never the browser.
- [~] **RFC 5545 validation** — the parser is *tolerant*, not strict: non-iCal input
  yields **zero ranges** (no crash, no injection, feed just blocks nothing) rather than
  an explicit "reject non-iCal". Safe, but it does not surface "this isn't a calendar"
  to the host — minor UX gap, not a security one.
- [x] **Import caps + timeout** — ⚠️ cap is **1000 expanded dates** (`MAX_IMPORTED_DATES`),
  not "500 events" as the spec worded it (dates ≠ events; the DoS intent — can't flood
  `blocked_dates` — is met), plus a **30 s fetch timeout** and an atomic non-destructive
  `import_ical_blocks` RPC (a real Wielo block always wins via ON CONFLICT DO NOTHING).
- [x] **Only blocks dates in [today, today+24 mo]** — `rangesToDates(maxDays = 365*2 =
  730)` clamps both past (→ today) and far-future (→ cutoff); `STATUS:CANCELLED`
  tombstones skipped.
- [x] **No SSRF** — `assertFetchableUrl` (`lib/security/ssrf.ts`) runs BEFORE every
  fetch: http(s)-only, and it **resolves DNS then checks the RESOLVED addresses**
  against loopback/private/link-local/ULA/CGNAT **and the cloud-metadata IP
  169.254.169.254** — so a hostname that resolves to a private IP is caught, not just a
  literal one. Covers 10.x / 192.168.x / 127.x / 172.16-31 / 169.254 / IPv6 `::1`/`fc`/
  `fd`/`fe80`/IPv4-mapped.
- [~] **Feed error states** — stored generic + truncated (`last_error = message.slice(0,
  500)`); the SSRF/fetch messages returned are user-safe ("That address isn't allowed").
  ⚠️ One path returns `rpcError.message` (a Postgres message) to the host's OWN feed UI —
  low risk (their own feed), consider a friendly string + `reportError` (there is no Sentry).
- [n/a] Rotating an export token — **no per-listing rotation exists yet** (Phase 3, with
  the `ical_feeds` migration); global rotation = rotating `ICAL_TOKEN_SECRET`. Nothing to
  warn about until the feature ships.

---

## 12. Mobile App

Verified 2026-07-23 against `apps/mobile` source.

- [x] **No sensitive data in `AsyncStorage`; auth tokens in `expo-secure-store`** —
  `src/lib/supabase.ts` uses an `ExpoSecureStoreAdapter` for the Supabase auth
  `storage`; **zero** `AsyncStorage` references anywhere in `apps/`.
- [x] **Deep link scheme `vilo` registered** — `app.json` → `"scheme": "vilo"`.
- [x] **No hardcoded secrets in `app.json` / `eas.json`** — grep for
  `sk_`/`SERVICE_ROLE`/`secret`/`apiKey` returns nothing; the client uses only the
  public `EXPO_PUBLIC_SUPABASE_ANON_KEY` (never the service role).
- [ ] Google Maps Android key restricted to the package name (Google Cloud Console —
  dashboard, founder).
- [ ] Push-permission copy shown before the system prompt — UX check, not re-traced
  this pass.

---

## Sign-Off

Before production deployment, this checklist must be reviewed and signed off:

| Item | Reviewer | Date | Status |
|---|---|---|---|
| Sections 1–4 (auth, RLS, API, payments) | | | |
| Sections 5–8 (data, uploads, headers, secrets) | | | |
| Sections 9–11 (admin, POPIA, mobile) | | | |

**All items must be ✅ before going live. No exceptions.**
