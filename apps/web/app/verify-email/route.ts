import { type NextRequest, NextResponse } from "next/server";

import {
  markEmailVerified,
  verifyVerificationToken,
} from "@/lib/auth/verifyEmail";

// Landing route for the confirmation link in the verification email. Validates
// the stateless signed token, stamps user_profiles.email_verified_at, and sends
// the visitor somewhere friendly. Works whether or not they're signed in — the
// userId comes from the token, not the session.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token");
  const userId = token ? verifyVerificationToken(token) : null;

  if (!userId) {
    return NextResponse.redirect(new URL("/login?verify=failed", request.url));
  }

  await markEmailVerified(userId);
  return NextResponse.redirect(new URL("/login?verified=1", request.url));
}
