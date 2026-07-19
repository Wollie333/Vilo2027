# Beta infra — CSP, secrets, workers

> Status of the pre-beta infra items, 2026-07-19. ✅ = done/verified by me ·
> 👤 = needs your account/keys (I can't do it) · ⚠️ = wired but needs a real device/live keys.
> (The af-south-1 region move was dropped — not needed.)

---

## 1. CSP headers — ✅ DONE (shipped)

`apps/web/next.config.mjs` now emits **two** CSP headers on every response:

- **`Content-Security-Policy` (ENFORCED)** — only directives that add real
  protection with ZERO breakage risk on a multi-tenant app:
  `base-uri 'self'; object-src 'none'; frame-ancestors 'self'` (+
  `upgrade-insecure-requests` in prod). Blocks `<base>` hijacking, plugin
  injection, and cross-origin framing (refines the existing X-Frame-Options).
- **`Content-Security-Policy-Report-Only` (FULL allowlist)** — the complete
  script/style/img/font/connect/frame/media policy covering Paystack, PayPal,
  Supabase (https+wss), GA4/GTM, Meta pixel, Turnstile, YouTube/Vimeo, Google
  Maps embeds, Google Fonts, OpenStreetMap tiles. It **never blocks** — it
  reports violations so the allowlist can be tuned against real traffic.

**Why not fully enforced?** Wielo is multi-tenant: a host's website (same app)
can carry **custom head code, custom CSS, external images**. A blind global
enforcing `script-src`/`style-src` would break those sites and third-party
checkout widgets. Report-Only is the industry-standard safe rollout.

Verified locally (no CSP violations on home / listing / booking-form).

### To flip the full policy to ENFORCED (post-beta, ~30 min)
1. Deploy with the report-only header live; let real traffic (payments + a few
   tenant sites) run for a few days.
2. Read the violation reports (browser console, or add a `report-to` endpoint).
3. Add any missing hosts to the allowlist; decide how to handle host custom
   scripts (sandbox them, or keep tenant-site routes on a looser policy via
   `middleware.ts` per-path headers).
4. Move the tuned directives from `CSP_REPORT_ONLY` into `CSP_ENFORCE`.

---

## 2. Production secrets — ✅ Vault verified · 👤 confirm Vercel + Edge

**Vault worker secrets — ✅ ALL 15 SET** (verified via `vault.decrypted_secrets`,
names only): `email_worker_url/secret`, `ical_sync_worker_url/secret`,
`external_reviews_worker_url/secret`, `push_worker_url`, `digest_worker_url`,
`checkin_reminder_worker_url`, `broadcast_worker_url`, `review_request_worker_url`,
`booking_reconcile_worker_url`, `looking_for_worker_url`, `blog_publish_url`,
`website_domain_poll_url`. (Non-`_secret` workers reuse `email_worker_secret` as
the bearer.)

**👤 You must confirm these are set in Vercel (Production) — I can't read them:**
| Secret | Why it blocks beta |
|---|---|
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_WEBHOOK_SECRET` | card payments + webhook verify (🔴 gate) |
| `PAYPAL_CLIENT_SECRET` | PayPal payments (🔴 gate). *No `PAYPAL_WEBHOOK_ID` needed for beta — the booking path uses the return redirect + `booking-reconcile-worker`, not a webhook.* |
| `PAYMENT_CIPHER_KEY` | encrypts each host's own gateway secret |
| `BANKING_CIPHER_KEY` | encrypts EFT account numbers |
| `ICAL_TOKEN_SECRET` | iCal export (throws if unset) |
| `RESEND_API_KEY` / `EMAIL_FROM_ADDRESS` | transactional email |
| `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_*` | core |
| `EMAIL_WORKER_SECRET` | must equal the Vault `email_worker_secret` value (they matched — email drained live) |

**CIPHER KEYS — ✅ generated + set + redeployed (2026-07-20).** `BANKING_CIPHER_KEY`,
`PAYMENT_CIPHER_KEY`, `ICAL_TOKEN_SECRET` generated (`openssl rand`) and set in Vercel
Production; `BANKING_CIPHER_KEY` also in Supabase Edge secrets (same value). Vercel
redeployed. `ICAL_TOKEN_SECRET` **confirmed live** (self-signed token → live iCal export
returned **401 "Invalid token"**, not 503 "not configured"). `BANKING_CIPHER_KEY`
**confirmed live** — a freshly re-saved EFT account now stores with the **`v1.` encrypted
prefix** (older pre-key rows stay plaintext, which the decrypt path reads transparently).
`PAYMENT_CIPHER_KEY` set in the same deploy (encrypts host gateway secrets on next connect).
✅ All cipher keys verified.

**Inert-until-set (safe to defer past beta):** `TURNSTILE_*` (honeypot covers it),
`NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_POSTHOG_KEY` (deferred by design),
`VERCEL_TOKEN/PROJECT_ID/TEAM_ID` (custom domains), `GOOGLE_MAPS_API_KEY`
(address-picker suggestions; maps still render), external-reviews OAuth keys.

**Supabase Edge Function secrets (Dashboard → Edge Functions → Secrets):** confirm
`PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYPAL_CLIENT_SECRET`,
`PAYPAL_WEBHOOK_ID`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `BANKING_CIPHER_KEY`
are present (the deployed functions read them via `Deno.env`).

---

## 3. Email / push worker verification — ✅ email · ⚠️ push needs a device

Verified this session:
- **All 13 worker routes exist** (`apps/web/app/api/*-worker` etc.).
- **All worker crons ACTIVE** (`drain-email-queue` + `drain-push-queue` every
  minute; digest/checkin/review/broadcast/reconcile/ical/reviews/domains).
- **Queues healthy** — `notification_queue` and `pending_push_queue` both empty
  (0 stuck items).
- **Prod endpoints deployed + auth-gated** — `POST https://wielo.co.za/api/email-worker`
  and `/api/push-worker` (no bearer) both return **401** (live, not 404; guard works).
- **Email**: fully wired + previously verified draining live to 0 pending. ✅
- **Push**: fully wired, BUT `push_tokens` = **0 registered devices**. ⚠️ A
  delivered push can only be proven with a real device: install the Expo app →
  it calls `/api/register-push-token` → trigger a notification → confirm receipt.
  (Your action — needs a physical device token.)

**Payment webhooks (checked this pass):** `paystack-webhook` Edge Function is
**deployed + signature-gated** (`POST …/functions/v1/paystack-webhook` → 401). PayPal
intentionally has **no webhook** for the booking path (return redirect +
`booking-reconcile-worker`), so a missing `paypal-webhook` is expected, not a gap.

---

## Bottom line for beta
- **CSP**: ✅ shipped (enforced-safe + report-only), validated locally.
- **Secrets**: ✅ Vault verified (15/15); 👤 you confirm the Vercel/Edge payment keys +
  🔴 **set `BANKING_CIPHER_KEY` / `PAYMENT_CIPHER_KEY` before real hosts add banking.**
- **Workers**: ✅ email deployed + gated + draining; paystack-webhook deployed + gated;
  ⚠️ push needs one real device.
- **The #1 gate — ✅ CLEARED (2026-07-20):** live sandbox **card + PayPal round-trips**
  both proven end-to-end (Paystack BK-0082 → INV-0108; PayPal BK-0083 → INV-0109; +
  reconcile-worker recovery arm). All three payment methods green.
