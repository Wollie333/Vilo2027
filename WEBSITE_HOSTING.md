# Website CMS — Hosting & host routing

How tenant micro-sites (the per-business Website CMS) are served on
`<sub>.wielo.site` and custom domains, and the ops one-time setup. Part of the
Website CMS build (plan `~/.claude/plans/ok-it-has-come-spicy-snail.md` §3).

## How a request is routed

`apps/web/middleware.ts` runs a **host classifier FIRST** (pure logic in
`apps/web/lib/site/host.ts`, unit-tested in `host.test.ts`):

```
host = Host header (port + case normalised)
root = NEXT_PUBLIC_ROOT_DOMAIN          # e.g. wielo.site — the feature switch

classifyHost →
  "app"  for: no root configured · localhost / 127.0.0.1 · *.vercel.app ·
              root · www.root · app.root · <reserved>.root · a.b.root (multi-level)
  "site" for: <sub>.root (non-reserved) → ref = "<sub>"
              any other apex domain      → ref = full host (custom domain)
```

- **App host** → the existing pipeline is **UNCHANGED** (next-intl + Supabase
  `updateSession`). This allowlist is the single guard protecting the whole app;
  it is covered by an automated test (`lib/site/host.test.ts`) asserting every
  app hostname classifies as `app`.
- **Tenant host** → rewrite the path to `/<defaultLocale>/site<pathname>` and set
  the `x-wielo-site-host` header to the ref. The tenant branch does **not** run
  next-intl and does **not** refresh the Supabase session — **no cookies are ever
  set on a tenant host**. The public site loader (`lib/site/loadSitePage.ts`)
  reads that header, resolves the website by subdomain/custom-domain via the
  service-role client, and renders — or 404s if the host matches no website row
  (unknown Host = 404, never a passthrough).

> **Why `/<locale>/site` and not a standalone `(site)` route group?** Next.js
> treats `_`-prefixed folders (the plan's `__site`) as non-routable, and a second
> route-group root layout can't coexist with the non-grouped `[locale]` root that
> owns `<html>`. Mounting under `[locale]/site/` reuses the working root layout;
> tenant sites stay visually isolated via `SiteThemeRoot`'s scoped `--site-*` vars.

Booking CTAs on a tenant site deep-link the app domain
(`/{locale}/property/{slug}/book`), so the booking engine + ledger run in their
existing context — the micro-site is a marketing shell only.

## Reserved subdomains

Enforced in `lib/site/host.ts` (`RESERVED_SUBDOMAINS`) AND at claim time:
`app, www, api, admin, mail, smtp, ftp, ns1, ns2, staging, dev, blog, help,
docs, status, assets, cdn, static, wielo` + the locale codes (`en, af, fr, de, pt`).

## One-time ops setup

1. **Env** — set `NEXT_PUBLIC_ROOT_DOMAIN=wielo.site` (Vercel: all environments,
   and `.env.local` for dev). This is the on-switch; until it's set, host routing
   is a no-op and nothing changes.
2. **Wildcard DNS** — add a DNS record `*.wielo.site` → Vercel
   (`CNAME *  cname.vercel-dns.com`, or the apex `A 76.76.21.21` + a wildcard
   `CNAME`). Also keep `wielo.site` / `www` / `app` pointed at the app.
3. **Vercel project domains** — add `wielo.site` and the wildcard `*.wielo.site` to
   the project (wildcard TLS is issued automatically). Confirm the plan supports
   wildcard + the expected custom-domain volume/rate limits (fallback: Cloudflare
   for SaaS).
4. **Local dev** — `NEXT_PUBLIC_ROOT_DOMAIN=wielo.site` and browse
   `http://<sub>.localhost:3000` (modern browsers resolve `*.localhost` to
   loopback automatically).

## Custom domains (§13 — BUILT, inert until secrets are set)

A host connects their own domain on the website editor's **Domain** tab. The
flow uses the Vercel Domains API and is **inert until the founder wires the
secrets** — `vercelConfigured()` is false without them, so the UI shows
"Custom domains aren't available just yet" and the connect button is disabled.

**Code map:**
- `apps/web/lib/website/domain.ts` — pure validation + DNS-record builders.
- `apps/web/lib/website/vercel.ts` — Vercel Domains API wrapper (server-only).
- `apps/web/lib/website/domain-poll.ts` — `pollWebsiteDomain` SSOT (shared by
  the manual Refresh action + the cron worker).
- Actions in `dashboard/website/actions.ts`: `connectCustomDomainAction`,
  `refreshCustomDomainAction`, `removeCustomDomainAction` (owner-checked, then
  write via the admin client — `website_domain_events` is service-role-insert).
- `app/api/website-domain-poll/route.ts` — bearer worker (reuses
  `EMAIL_WORKER_SECRET`), polls domains stuck in `pending`/`verifying`.
- `migrations/20260618000000_website_domain_poll_cron.sql` — `poll-website-domains`
  pg_cron (every 2 min, Vault `website_domain_poll_url` + `email_worker_secret`).

State lives in `host_websites.custom_domain` / `domain_status` (`none → pending
→ verifying → active`/`error`) / `ssl_status`, with Vercel's TXT challenges
cached in `settings.domainChallenges` and an audit trail in `website_domain_events`.

**One-time ops to turn it on:**
1. Create a Vercel access token; note the project id + team id.
2. Set env (Vercel, all environments) + `.env.local`:
   `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`.
3. Register the poll-worker URL in Vault (Dashboard → SQL Editor):
   `SELECT vault.create_secret('https://<app-host>/api/website-domain-poll',
   'website_domain_poll_url', 'Custom-domain poll worker URL');`
   (the bearer reuses the existing `email_worker_secret`).
4. Confirm the Vercel plan allows the expected custom-domain volume (fallback:
   Cloudflare for SaaS).

DNS the host adds at their registrar: apex → `A 76.76.21.21`; subdomain →
`CNAME cname.vercel-dns.com`; plus any `_vercel` TXT challenge shown. Vercel
issues SSL automatically once the domain verifies.

## Testing without the middleware (pre-DNS)

Before wildcard DNS is live, a site is viewable on the app domain via the
temporary query param: `/<locale>/site?site=<subdomain>` (and
`…/site/<page>?site=<subdomain>`, `…/site/blog/<post>?site=<subdomain>`). Add
`&preview=1` to render draft (unpublished) content.
