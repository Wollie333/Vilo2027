import { type NextRequest, NextResponse } from "next/server";

import { activateAffiliateIfReady } from "@/lib/affiliate/activation";
import {
  markEmailVerified,
  verifyVerificationToken,
} from "@/lib/auth/verifyEmail";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Confirming the inbox is normally the LAST activation gate for a partner who
  // signed up through the public form, so re-evaluate here. Best-effort: a
  // partner must still reach the "verified" page even if this fails — the same
  // check runs whenever they open their portal.
  try {
    const admin = createAdminClient();
    const { data: affiliate } = await admin
      .from("affiliate_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (affiliate) await activateAffiliateIfReady(admin, affiliate.id);
  } catch {
    // Never block email confirmation on affiliate activation.
  }

  return NextResponse.redirect(new URL("/login?verified=1", request.url));
}
