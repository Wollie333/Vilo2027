# Secrets runbook — create, set, rotate

Every environment variable this platform uses: what it is, where it goes, in
what order, and how to change it later without breaking anything.

**Two separate environments. This is the mistake to avoid.**

| | Vercel | Supabase |
|---|---|---|
| Runs | the Next.js app (pages, server actions, cron routes) | Edge Functions (payment webhooks, schedulers) |
| Set at | Project → Settings → Environment Variables | Dashboard → Edge Functions → Secrets, or `supabase secrets set` |
| Check with | `wielo.co.za/admin/platform/errors` → Configuration | `supabase secrets list` |

A variable set in one is **not** set in the other. A few must be in **both** —
they are marked ⚠️ below, and getting that wrong is how you lose data.

**Vercel changes need a redeploy.** Editing a variable does not touch the
running deployment. Vercel → Deployments → ⋯ → Redeploy.

---

## 1. Generating a key

Anything described as "generate" below:

```bash
openssl rand -base64 32
```

Cipher keys **must** decode to exactly 32 bytes — the app refuses a wrong-length
key rather than silently producing garbage. Use the command; don't invent a
passphrase.

Never commit a key, paste one into a chat or ticket, or reuse one across
purposes. Each key exists so that losing one does not lose the others.

---

## 2. Order of setup

Follow this order. Later steps assume earlier ones.

### Step 1 — Turnstile secret (do this first: it is a live gap)

Everything else is already in place and verified:

- Widget **`0x4AAAAAADx7O8A2t5BqLv1Q`** ("Wielo") is embedded on all seven public
  forms, and that exact sitekey is inlined in the deployed production bundle.
- Server-side verification is the canonical `POST` to
  `challenges.cloudflare.com/turnstile/v0/siteverify`, form-urlencoded, sending
  `secret` + `response` + `remoteip`, gated on `success === true`
  (`lib/security/turnstile.ts`).

Only the secret is missing, so verification **fails open**: the widget renders,
the server accepts any answer, and visitors solve a challenge that stops nobody.

1. Cloudflare dashboard → Turnstile → the **Wielo** widget → **Secret Key**
2. Vercel → Settings → Environment Variables → add the secret, **Production**
   scope. Either name works: `TURNSTILE_SECRET_KEY` (preferred — what the config
   panel and this runbook name) or `TURNSTILE_SECRET` (what Cloudflare's own
   setup flow tells you to use). Both are read.
3. **Redeploy** — an env change does not touch the running deployment
4. Check: `/admin/platform/errors` → Bot protection (server) turns green

Verify the secret is bound to the right widget without needing a real visitor —
a valid secret + a junk token must answer `invalid-input-response`, and a wrong
secret answers `invalid-input-secret`:

```bash
curl -s -X POST https://challenges.cloudflare.com/turnstile/v0/siteverify \
  -d "secret=$TURNSTILE_SECRET_KEY" \
  -d "response=XXXX.DUMMY.TOKEN.XXXX" | jq
# expect: {"success":false,"error-codes":["invalid-input-response"]}
```

Also confirm the widget's **domains** include `wielo.co.za` (and `localhost` for
local work) — Cloudflare dashboard → Turnstile → Wielo → Settings. A hostname
missing there fails verification in production only, which is the worst place to
discover it.

After this, a visitor whose challenge genuinely fails gets a clear message
instead of sailing through. That is the point.

### Step 2 — ⚠️ Cipher keys in **Supabase**, before any backfill

`PAYMENT_CIPHER_KEY` and `BANKING_CIPHER_KEY` are set in Vercel but **not** in
Supabase. The deployed `paystack-webhook` reads
`platform_payment_settings.paystack_secret_key` and decrypts it.

That value is currently **plain text**, so the webhook works. Encrypt it while
Supabase has no key and **every Paystack webhook starts failing** — payments
stop confirming bookings, and nothing obvious says why.

```bash
# Use the SAME values already in Vercel.
supabase secrets set PAYMENT_CIPHER_KEY='…'
supabase secrets set BANKING_CIPHER_KEY='…'
supabase secrets list          # confirm both appear
```

Only then:

```bash
node scripts/encrypt-secrets-backfill.mjs            # dry run first
node scripts/encrypt-secrets-backfill.mjs --apply
```

Then make one real payment before trusting it.

### Step 3 — Signing keys (optional, recommended)

`EMAIL_VERIFY_SECRET`, `REVIEW_TOKEN_SECRET`, `STATEMENT_TOKEN_SECRET`,
`IMPERSONATION_TOKEN_SECRET`, `RATE_LIMIT_SALT`.

Nothing is broken without these — they derive from the service-role key. What
you gain is the ability to rotate them **independently of database access**.

Generate one per variable, set in **Vercel only**, redeploy.

Setting one for the first time is safe: verification still accepts the derived
key, so links already in people's inboxes keep working.

`IMPERSONATION_TOKEN_SECRET` is the one most worth isolating — it signs
staff-acting-as-a-user sessions.

### Step 4 — Optional integrations

| Variable | Where to get it | Needed for |
|---|---|---|
| `PAYPAL_WEBHOOK_ID` | PayPal developer dashboard → your app → Webhooks | PayPal recurring subscriptions (deliberately off until set) |
| `NEXT_PUBLIC_SITE_URL` | your own domain | only matters on preview deployments; production already falls back correctly |

---

## 3. Rotating a key

Rotation is supported by **adding a second variable**, not by overwriting one.
Every key reads as a list: the current value, then `<NAME>_PREVIOUS`.

### Signing keys — `EMAIL_VERIFY_SECRET`, `REVIEW_TOKEN_SECRET`, `STATEMENT_TOKEN_SECRET`

Tokens are signed with the current key and verified against **both**, so links
already sent keep working through the change.

1. `EMAIL_VERIFY_SECRET_PREVIOUS` = the current value
2. `EMAIL_VERIFY_SECRET` = a freshly generated value
3. Redeploy
4. Wait out the longest token life — **verification links last 3 days**, so
   wait at least that. Statement and review links are long-lived; if you are
   rotating because a key leaked, skip the wait and accept the dead links.
5. Delete `EMAIL_VERIFY_SECRET_PREVIOUS`, redeploy

Stop after step 3 and nothing is broken. That is the property that makes this
safe to do on a Friday.

### Cipher keys — ⚠️ `PAYMENT_CIPHER_KEY`, `BANKING_CIPHER_KEY`, `OAUTH_CIPHER_KEY`

Higher stakes: these protect data at rest. A row encrypted with a key you no
longer have is **gone**.

1. `<KEY>_PREVIOUS` = the current value — **in Vercel *and* Supabase**
2. `<KEY>` = a freshly generated value — **in both**
3. Redeploy. New writes use the new key; old rows still read via `_PREVIOUS`
4. Re-encrypt existing rows: `node scripts/encrypt-secrets-backfill.mjs --apply`
5. Verify: a host's payment settings still load, and a booking still pays
6. Only now delete `<KEY>_PREVIOUS` from both, and redeploy

**Do not skip step 4.** Deleting `_PREVIOUS` with rows still on the old key
makes them unreadable forever. The app throws a clear "could not decrypt with
`<KEY>` or `<KEY>_PREVIOUS`" rather than returning rubbish — but by then the
key is gone.

### `IMPERSONATION_TOKEN_SECRET` — deliberately NOT rotatable this way

It has no `_PREVIOUS` fallback on purpose. Rotating it immediately invalidates
every open impersonation session, which is exactly what you want from an
emergency kill-switch for staff access. Rotate it by overwriting the value.

### `SUPABASE_SERVICE_ROLE_KEY` — read this before rotating

While any signing key is unset, it is the material those keys derive from.
Rotating it therefore invalidates every outstanding verification, review and
statement link at once.

Set the dedicated signing keys **first** (step 3 above), and the service-role
key becomes safe to rotate on its own.

---

## 4. If something breaks

| Symptom | Cause | Fix |
|---|---|---|
| Paystack webhooks 4xx; bookings stay unconfirmed | `PAYMENT_CIPHER_KEY` missing in **Supabase** after a backfill | `supabase secrets set PAYMENT_CIPHER_KEY='…'` (the Vercel value) |
| "could not decrypt with `<KEY>`…" in logs | rotated without `_PREVIOUS`, rows not re-encrypted | restore the old value as `<KEY>_PREVIOUS`, redeploy, re-run the backfill |
| Verification / review links all dead | a signing key changed with no `_PREVIOUS` | set `<KEY>_PREVIOUS` to the old value and redeploy; re-send if it is lost |
| A variable is set but nothing changed | Vercel change without a redeploy | Deployments → ⋯ → Redeploy |
| Panel says missing, you know you set it | set on the wrong environment, or Preview-only scope | check the Production scope, and check whether it belongs in Supabase instead |

The Configuration panel at `/admin/platform/errors` reads the **running
server's** environment. If it says missing, the running app cannot see it —
whatever the dashboard shows.

---

## 5. One place to control both (Doppler)

The whole reason §2 exists is that Vercel and Supabase are set separately and
nothing notices when only one of them gets a value. Doppler syncs natively to
**both**, so a secret is entered once. Free Developer plan covers a solo founder.

### Which variables belong where

Vercel holds all 42. Supabase Edge Functions need **exactly six** — everything
else would be noise in that runtime:

| Variable | Read by | Also on Vercel? |
|---|---|---|
| `PAYMENT_CIPHER_KEY` | `paystack-webhook` | ⚠️ yes — must match |
| `BANKING_CIPHER_KEY` | `eft-banking-details` | ⚠️ yes — must match |
| `OAUTH_CIPHER_KEY` | `external-review-*` | ⚠️ yes — must match |
| `REPORT_SCHEDULER_SECRET` | `report-scheduler` | ⚠️ yes — caller/callee pair |
| `EXTERNAL_REVIEWS_WORKER_SECRET` | `external-reviews-sync` | ⚠️ yes — caller/callee pair |
| `PAYSTACK_SECRET_KEY` | `paystack-webhook` | optional — falls back to the DB |

**Never put `SUPABASE_URL`, `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
into the Supabase config.** That runtime injects them itself and reserves the
`SUPABASE_` prefix. They belong in the Vercel config only (as
`NEXT_PUBLIC_SUPABASE_URL` etc.).

### Structure

A branch config **implicitly inherits everything** from its environment's root
config — no `--inherits` flag needed (verified on this project: a secret set in
`prd` appeared in `prd_supabase` immediately). Inheritance is total, so the root
must hold **only** what both runtimes need:

```
wielo
├── prd            ← ONLY the 6 shared secrets. Anything here reaches BOTH.
    ├── prd_vercel   → Vercel sync (Production) — the other 36 live here
    └── prd_supabase → Supabase sync — adds nothing of its own
```

Enter a cipher key once in `prd`; both branches inherit it. That is the property
that makes the §2 failure impossible to repeat.

⚠️ **Do not put the other 36 in `prd`.** Because inheritance is total, they would
be pushed into the Edge Function runtime too — including `SUPABASE_`-prefixed
names, which that runtime reserves. Vercel-only variables belong in
`prd_vercel`.

### Order of adoption — least destructive first

Doppler's docs do **not** state whether its Vercel sync deletes Vercel variables
that are absent from the Doppler config. Until that is proven on this project,
treat it as if it might:

1. **Supabase first.** That runtime currently holds almost nothing, so there is
   nothing to lose. It is also where the live gap is. Verify with
   `supabase secrets list`.
2. **Vercel Preview second** — a separate integration is required per Vercel
   environment, so Preview is a real blast-radius-limited rehearsal. Confirm
   afterwards that Preview still has variables Doppler does not manage.
3. **Vercel Production last**, and only once the config holds **all 42**. A
   partial config pointed at Production is the one move that can break the app.

### Collecting the values

Most cannot be read back out of Vercel — `vercel env pull` writes empty strings
for them. Two kinds:

- **Symmetric secrets you can simply regenerate** — the cipher keys and both
  worker secrets. They only need to match *each other*, and Doppler pushes the
  new value everywhere at once, so regenerating is safe and cheaper than
  recovering. (A cipher key is the exception: regenerating abandons any data
  already encrypted with the old one — see §3.)
- **Third-party keys that must be re-fetched from the provider** — Supabase,
  Resend, Paystack, PayPal, Google Maps/Reviews, Facebook, Cloudflare Turnstile,
  PostHog, Sentry, Mapbox, Anthropic.

⚠️ `EMAIL_WORKER_SECRET` and `ICAL_TOKEN_SECRET` exist as **separate Preview and
Production entries** in Vercel and may hold different values. Check both before
collapsing them onto one Doppler value.

### After any sync

A Vercel sync still needs a **redeploy** to reach the running deployment, exactly
as a manual edit does. Then confirm on both sides — `supabase secrets list` and
the Configuration panel. Checking only one side is the original bug.

### Proving two runtimes hold the SAME value

Presence is not equality. A wrong-but-present key fails exactly like a missing
one, and neither dashboard will tell you.

**The `DIGEST` column in `supabase secrets list` is a plain SHA-256 of the
value.** So a secret can be proven identical without ever reading it:

```bash
printf '%s' "$(doppler secrets get BANKING_CIPHER_KEY -p wielo -c prd --plain)" \
  | sha256sum
supabase secrets list          # compare against the DIGEST column
```

Vercel offers no equivalent — `vercel env pull` returns empty strings for these,
so the Vercel side can only be confirmed **functionally**: redeploy, then exercise
a path that decrypts (a host's banking details, a Paystack webhook). Treat the
Configuration panel's green tick as "present", never as "correct".
