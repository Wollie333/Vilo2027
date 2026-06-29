import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { classifyHost, isSeoFile, siteRewritePath } from "@/lib/site/host";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18n = createMiddleware(routing);

// Route-handler trees that must NOT get locale handling (no UI / no layout):
// api workers, the iCal feed, the Supabase auth callback, unsubscribe, the
// quote PDF handler, and the affiliate referral link (/r/<slug>). These still
// get Supabase session refresh, exactly as before.
const FUNCTIONAL = /^\/(api|ical|auth|unsubscribe|quote|r)(\/|$)/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Host classifier runs FIRST ──────────────────────────────
  // Tenant micro-sites (<sub>.wielo.site / custom domains) are rewritten into the
  // public site routes and given the x-wielo-site-host header. They do NOT run
  // next-intl and do NOT refresh the Supabase session — no cookies are ever set
  // on a tenant host. App hosts fall through to the UNCHANGED pipeline below.
  // Fail-safe: with no NEXT_PUBLIC_ROOT_DOMAIN, classifyHost() always returns
  // "app", so app routing can never regress.
  const host = classifyHost(
    request.headers.get("host"),
    process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  );
  if (host.kind === "site") {
    const headers = new Headers(request.headers);
    headers.set("x-wielo-site-host", host.ref);
    // Global route-handler trees (api workers, auth, ical, unsubscribe, quote,
    // /r) are NOT part of the per-site page tree — rewriting them into
    // /<locale>/site/* would 404. Let them reach their real handlers, just tagged
    // with the site host so a handler can resolve which tenant called it (the
    // on-site checkout + website form/funnel endpoints rely on this). SEO files
    // DO have per-site routes, so they still get rewritten below.
    if (FUNCTIONAL.test(pathname)) {
      return NextResponse.next({ request: { headers } });
    }
    const url = request.nextUrl.clone();
    url.pathname = siteRewritePath(pathname, routing.defaultLocale);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // ─── App hosts: existing behaviour, UNCHANGED ────────────────
  // Bare-host SEO files are plain route handlers (the app's /sitemap.xml); never
  // run them through next-intl, which would 307 them to /en/sitemap.xml.
  if (isSeoFile(pathname)) return NextResponse.next();

  if (FUNCTIONAL.test(pathname)) {
    return await updateSession(request);
  }

  // next-intl first: it may 307-redirect to normalise the locale prefix.
  const i18nResponse = handleI18n(request);
  if (i18nResponse.headers.get("location")) return i18nResponse;

  // Carry next-intl's rewrite + NEXT_LOCALE cookie into Supabase, which attaches
  // the refreshed auth cookies to that same response.
  return await updateSession(request, i18nResponse);
}

export const config = {
  // Run on everything except Next internals and files with an extension
  // (assets, favicon). api/ical/etc. still match here and route to the
  // Supabase-only branch above. sitemap.xml + robots.txt + feed.xml are listed
  // explicitly so the host classifier can rewrite them on tenant hosts (and
  // pass them through untouched on app hosts).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/sitemap.xml",
    "/robots.txt",
    "/feed.xml",
  ],
};
