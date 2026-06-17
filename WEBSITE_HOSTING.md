# Website CMS — Hosting & host routing

How tenant micro-sites (the per-business Website CMS) are served on
`<sub>.vilo.site` and custom domains, and the ops one-time setup. Part of the
Website CMS build (plan `~/.claude/plans/ok-it-has-come-spicy-snail.md` §3).

## How a request is routed

`apps/web/middleware.ts` runs a **host classifier FIRST** (pure logic in
`apps/web/lib/site/host.ts`, unit-tested in `host.test.ts`):

```
host = Host header (port + case normalised)
root = NEXT_PUBLIC_ROOT_DOMAIN          # e.g. vilo.site — the feature switch

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
  the `x-vilo-site-host` header to the ref. The tenant branch does **not** run
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
docs, status, assets, cdn, static, vilo` + the locale codes (`en, af, fr, de, pt`).

## One-time ops setup

1. **Env** — set `NEXT_PUBLIC_ROOT_DOMAIN=vilo.site` (Vercel: all environments,
   and `.env.local` for dev). This is the on-switch; until it's set, host routing
   is a no-op and nothing changes.
2. **Wildcard DNS** — add a DNS record `*.vilo.site` → Vercel
   (`CNAME *  cname.vercel-dns.com`, or the apex `A 76.76.21.21` + a wildcard
   `CNAME`). Also keep `vilo.site` / `www` / `app` pointed at the app.
3. **Vercel project domains** — add `vilo.site` and the wildcard `*.vilo.site` to
   the project (wildcard TLS is issued automatically). Confirm the plan supports
   wildcard + the expected custom-domain volume/rate limits (fallback: Cloudflare
   for SaaS).
4. **Local dev** — `NEXT_PUBLIC_ROOT_DOMAIN=vilo.site` and browse
   `http://<sub>.localhost:3000` (modern browsers resolve `*.localhost` to
   loopback automatically).

## Custom domains (later phase — §13)

Connecting a guest-supplied apex/CNAME domain uses the Vercel Domains API
(`VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID`) via
`website-domain-connect` + a `website-domain-poll` Edge Function + pg_cron, with
status tracked in `host_websites.domain_status` / `ssl_status` and the
`website_domain_events` audit table. Not required for subdomain-only hosting.

## Testing without the middleware (pre-DNS)

Before wildcard DNS is live, a site is viewable on the app domain via the
temporary query param: `/<locale>/site?site=<subdomain>` (and
`…/site/<page>?site=<subdomain>`, `…/site/blog/<post>?site=<subdomain>`). Add
`&preview=1` to render draft (unpublished) content.
