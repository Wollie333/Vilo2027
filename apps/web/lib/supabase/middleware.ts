import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/portal"];

// Non-default locales carry a URL prefix (/af, /fr, …); the default locale (en)
// has none. Strip any such prefix before matching auth/protected routes so
// /af/dashboard gates exactly like /dashboard.
const NON_DEFAULT_LOCALES = routing.locales.filter(
  (l) => l !== routing.defaultLocale,
);
const LOCALE_PREFIX = new RegExp(`^/(${NON_DEFAULT_LOCALES.join("|")})(?=/|$)`);

// /signup is intentionally NOT in AUTH_ROUTES: the host wizard signs the
// user in mid-flow (after step 1) and must keep rendering the rest of the
// wizard while logged in. Each /signup/* page handles "already onboarded"
// itself and redirects to the right destination.

/**
 * Refresh the Supabase auth session and enforce auth/protected-route gating.
 *
 * `baseResponse` is the response next-intl already produced for this request
 * (carrying its locale rewrite + NEXT_LOCALE cookie). When given, we attach the
 * refreshed auth cookies to THAT response rather than a fresh one, so neither
 * piece is lost. For non-localized routes (api, ical, …) it's called without a
 * base and behaves exactly as before.
 */
export async function updateSession(
  request: NextRequest,
  baseResponse?: NextResponse,
) {
  // Locale-stripped path, used for both the x-pathname header and route gating.
  const pathname = request.nextUrl.pathname.replace(LOCALE_PREFIX, "") || "/";

  // Mirror the (locale-stripped) pathname to a request header so server layouts
  // can branch on it (next/headers can read this in RSC). Used by the dashboard
  // layout to give /dashboard/inbox a full-bleed shell while every other
  // dashboard page stays capped at max-w-[1280px].
  request.headers.set("x-pathname", pathname);
  const supabaseResponse = baseResponse ?? NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Attach refreshed cookies to the existing response (next-intl's, when
          // present) — do NOT recreate it, or the locale rewrite/cookie is lost.
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = AUTH_ROUTES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the FULL original path (incl. any locale prefix) so the user
    // returns to the exact localized page after logging in.
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Admin gate: deeper checks (platform_staff membership, AAL2) happen in the
  // admin layout via requireAdmin(). Middleware only handles auth presence so
  // every request doesn't pay for an extra DB roundtrip.

  return supabaseResponse;
}
