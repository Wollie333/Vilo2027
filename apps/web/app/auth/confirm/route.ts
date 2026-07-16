import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { resolvePostAuthDestination } from "@/lib/auth/postAuth";
import { safeNextPath } from "@/lib/auth/safeNext";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next");

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/login?verify=failed", request.url));
  }

  const supabase = createServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(new URL("/login?verify=failed", request.url));
  }

  // A recovery (password-reset) verification must ALWAYS land on the set-new-
  // password page — never the dashboard — even if `next` was dropped somewhere
  // upstream. The verifyOtp above established the (recovery) session the
  // reset-password page requires.
  if (type === "recovery") {
    const dest = safeNextPath(next) ?? "/reset-password";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const destination = await resolvePostAuthDestination(user?.id ?? null, next);
  return NextResponse.redirect(new URL(destination, request.url));
}
