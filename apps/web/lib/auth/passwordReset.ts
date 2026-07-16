import "server-only";

import { createElement } from "react";

import { PasswordReset } from "@vilo/emails";

import { getBrandName } from "@/lib/brand";
import { sendReactEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

// Password-reset delivery — Wielo-owned.
//
// Why not supabase.auth.resetPasswordForEmail? Its email routes through
// Supabase's own /auth/v1/verify endpoint, and the `redirect_to` we ask for is
// ignored unless it's in Supabase's allowlist — so it fell back to the bare
// SITE_URL, landing the (now recovery-authenticated) user on the homepage →
// dashboard, never the set-new-password page. Instead we mint the recovery link
// OURSELVES via admin.generateLink and point it at our own /auth/confirm route
// (the token_hash PKCE flow), which verifies the OTP and forwards to
// /reset-password. This bypasses the allowlist entirely and uses our branded
// email. Best-effort + anti-enumeration: never reveals whether the email exists.

function firstNameOf(fullName: string | null | undefined): string {
  const n = (fullName ?? "").trim().split(/\s+/)[0];
  return n || "there";
}

/**
 * Generate a recovery link for `email` and email it via Resend with the branded
 * PasswordReset template. Returns { ok } best-effort; callers should NOT branch
 * their UX on it (always show a neutral "check your inbox" to avoid leaking
 * whether the address is registered).
 */
export async function sendPasswordResetEmail(input: {
  email: string;
  origin: string;
}): Promise<{ ok: boolean }> {
  const base = input.origin || process.env.NEXT_PUBLIC_APP_URL || "";
  const email = input.email.trim().toLowerCase();
  if (!base || !email) return { ok: false };

  const admin = createAdminClient();

  // Mint a recovery link — the redirectTo is only a fallback; we build our own
  // /auth/confirm URL from the returned hashed_token so we never depend on the
  // Supabase redirect allowlist.
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${base}/auth/confirm?next=/reset-password` },
  });
  const hashed = link?.properties?.hashed_token;
  if (error || !hashed) {
    // No account for this email (or GoTrue error). Stay silent — the caller
    // still shows the neutral "check your inbox" state (anti-enumeration).
    return { ok: false };
  }

  const confirmUrl =
    `${base}/auth/confirm?token_hash=${encodeURIComponent(hashed)}` +
    `&type=recovery&next=${encodeURIComponent("/reset-password")}`;

  // Best-effort first-name for the greeting.
  let fullName: string | null = null;
  const userId = link?.user?.id;
  if (userId) {
    const { data: prof } = await admin
      .from("user_profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    fullName = prof?.full_name ?? null;
  }

  const brandName = await getBrandName();
  const res = await sendReactEmail({
    to: email,
    subject: `Reset your password — ${brandName}`,
    react: createElement(PasswordReset, {
      firstName: firstNameOf(fullName),
      resetUrl: confirmUrl,
      brandName,
    }),
  });
  if (!res.ok) console.error("[passwordReset] send failed:", res.error);
  return { ok: res.ok };
}
