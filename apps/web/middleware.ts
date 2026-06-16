import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18n = createMiddleware(routing);

// Route-handler trees that must NOT get locale handling (no UI / no layout):
// api workers, the iCal feed, the Supabase auth callback, unsubscribe, the
// quote PDF handler, and the affiliate referral link (/r/<slug>). These still
// get Supabase session refresh, exactly as before.
const FUNCTIONAL = /^\/(api|ical|auth|unsubscribe|quote|r)(\/|$)/;

export async function middleware(request: NextRequest) {
  if (FUNCTIONAL.test(request.nextUrl.pathname)) {
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
  // (assets, sitemap.xml, robots.txt, favicon). api/ical/etc. still match here
  // and are routed to the Supabase-only branch above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
