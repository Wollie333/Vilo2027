import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/portal"];
// The second step of signing in — deliberately NOT an auth route (see below).
const MFA_ROUTE = "/login/2fa";

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

  // /login/2fa is the SECOND step of signing in, so it must not count as an
  // "auth route" — those bounce a signed-in user to /dashboard, and /dashboard
  // sends anyone with an outstanding 2FA step straight back here. That is an
  // infinite redirect, and it takes the challenge page down for exactly the
  // people who need it.
  const isMfaRoute =
    pathname === MFA_ROUTE || pathname.startsWith(`${MFA_ROUTE}/`);
  const isAuthRoute =
    !isMfaRoute &&
    AUTH_ROUTES.some(
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

  // Two-factor gate. A user who has switched 2FA on must finish the second step
  // before any protected page renders — after a magic link just as much as after
  // a password, since an attacker holding the inbox is exactly who this stops.
  //
  // Costs no extra roundtrip: getUser() above already returned the factor list,
  // and the current level is a claim inside the access token we already hold.
  if (user && isProtectedRoute && !isMfaRoute) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session && mfaStepOutstanding(user, session.access_token)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login/2fa";
      url.search = "";
      url.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  // Admin gate: deeper checks (platform_staff membership) happen in the admin
  // layout via requireAdmin(). Middleware only handles auth presence so every
  // request doesn't pay for an extra DB roundtrip.

  return supabaseResponse;
}

/**
 * Is there a second step still owed on this session?
 *
 * True when the account has a VERIFIED factor but the session is still aal1.
 * Unverified factors are ignored deliberately — an abandoned enrolment must
 * never start challenging anyone, which would lock a user out of an account they
 * never finished securing.
 *
 * Fails OPEN on an unreadable token: this gate runs on every protected request,
 * and a malformed claim should not lock the whole app out. The account is still
 * password/link protected, and every sensitive action re-authenticates anyway.
 */
function mfaStepOutstanding(
  user: { factors?: { status?: string }[] | null },
  accessToken: string,
): boolean {
  const verified = (user.factors ?? []).some((f) => f?.status === "verified");
  if (!verified) return false;

  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return false;
    const claims = JSON.parse(
      Buffer.from(
        payload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8"),
    ) as { aal?: string };
    return claims.aal !== "aal2";
  } catch {
    return false;
  }
}
