import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/portal"];

// /signup is intentionally NOT in AUTH_ROUTES: the host wizard signs the
// user in mid-flow (after step 1) and must keep rendering the rest of the
// wizard while logged in. Each /signup/* page handles "already onboarded"
// itself and redirects to the right destination.

export async function updateSession(request: NextRequest) {
  // Mirror the current pathname to a request header so server layouts can
  // branch on it (next/headers can read this in RSC). Used by the dashboard
  // layout to give /dashboard/inbox a full-bleed shell while every other
  // dashboard page stays capped at max-w-[1280px].
  request.headers.set("x-pathname", request.nextUrl.pathname);
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
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

  const { pathname } = request.nextUrl;
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
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Admin gate: deeper checks (platform_staff membership, AAL2) happen in the
  // admin layout via requireAdmin(). Middleware only handles auth presence so
  // every request doesn't pay for an extra DB roundtrip.

  return supabaseResponse;
}
