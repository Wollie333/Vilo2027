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

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is already set, so the widget renders — but
`TURNSTILE_SECRET_KEY` is not, and verification **fails open**. Visitors solve a
challenge that stops nobody.

1. Cloudflare dashboard → Turnstile → your site → **Secret Key**
2. Vercel → add `TURNSTILE_SECRET_KEY` → Production
3. Redeploy
4. Check: the Configuration panel shows Bot protection green on both rows

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
