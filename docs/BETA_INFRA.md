# Beta infra — CSP, secrets, workers, region

> Status of the four pre-beta infra items, 2026-07-19. ✅ = done/verified by me ·
> 👤 = needs your account/keys (I can't do it) · ⚠️ = wired but needs a real device/live keys.

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
| `PAYPAL_CLIENT_SECRET` / `PAYPAL_WEBHOOK_ID` | PayPal payments + webhook verify (🔴 gate) |
| `PAYMENT_CIPHER_KEY` | decrypts each host's own gateway secret — payments fail without it |
| `BANKING_CIPHER_KEY` | decrypts EFT account numbers on invoices/PDFs |
| `ICAL_TOKEN_SECRET` | iCal export (throws if unset) |
| `RESEND_API_KEY` / `EMAIL_FROM_ADDRESS` | transactional email |
| `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_*` | core |
| `EMAIL_WORKER_SECRET` | must equal the Vault `email_worker_secret` value (they matched — email drained live) |

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

---

## 4. af-south-1 (Cape Town) region move — 👤 runbook (do it NOW, while the DB is empty)

**I cannot execute this** — it's a Supabase project-level operation (create
projects, dump/restore, DNS, secrets) that needs your Supabase + Vercel accounts.
A project's region **cannot** be changed in place.

**🔑 Do it before beta.** Per the pre-MVP data policy the DB has **no data worth
preserving**, so the move is a clean re-provision, not a data migration — the
hardest part (dumping/restoring live data + auth users + storage) doesn't exist
yet. Every hour of real beta data makes this harder.

### Runbook (empty-DB path — the easy one)
1. **Create** a new Supabase project in **`af-south-1` (Cape Town)**.
2. **Link + push schema:** `supabase link --project-ref <new-ref>` →
   `supabase db push --linked` (re-runs every migration in order).
3. **Regenerate types** against the new project (`supabase gen types … --linked`).
4. **Deploy Edge Functions:** `supabase functions deploy <each>` and re-add the
   Edge secrets (§2) in the new project's dashboard.
5. **Recreate Vault secrets** (§2 list) via the SQL Editor —
   `vault.create_secret(url, name, desc)` for each worker (same values as today).
6. **Recreate pg_cron jobs** — they live in the DB; if not covered by a migration,
   re-run the cron migrations (they are). Verify with `SELECT * FROM cron.job`.
7. **Re-seed** if desired (`supabase/seed.sql` + the starter accounts).
8. **Repoint the app:** update Vercel env `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (+ Edge/DB URLs) to
   the new project → redeploy.
9. **Smoke test:** sign in, create a listing, run a booking; confirm workers fire
   (queues drain), and re-run the 401 probe on the worker endpoints.
10. **Storage buckets:** re-create the buckets + policies (migrations cover the
    `storage.*` policies; bucket rows may need re-creating). Re-upload seed assets.
11. Pause/delete the old (Frankfurt) project once the new one is verified.

> If you'd rather keep the current project, Supabase Support can do a paid
> in-place region migration on Pro+ — but the empty-DB re-provision above is
> faster, free, and lower-risk right now.

---

## Bottom line for beta
- **CSP**: ✅ shipped (enforced-safe + report-only), validated.
- **Secrets**: ✅ Vault verified; 👤 you confirm the Vercel/Edge payment + cipher keys.
- **Workers**: ✅ email deployed + gated + draining; ⚠️ push needs one real device.
- **Region**: 👤 run the empty-DB runbook now (cheap while the DB is empty).
- **Still the #1 gate** (unchanged): a live sandbox **card + PayPal round-trip** —
  you enter the card, I verify the confirm→ledger→email loop.
