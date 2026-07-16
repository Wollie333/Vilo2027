import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { createElement } from "react";

import { ConfirmEmail, ExistingAccount } from "@vilo/emails";

import { getBrandName } from "@/lib/brand";
import { sendReactEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

// App-level email verification (soft).
//
// Why not Supabase's `email_confirmed_at`? This project runs GoTrue with
// auto-confirm on (`enable_confirmations = false`), so every admin-created user
// — and any auth email-link we generate — comes back already confirmed. That
// makes GoTrue's confirmation flag useless as a "has this person proved they
// own the inbox?" signal. So we track verification ourselves in
// `user_profiles.email_verified_at` and gate the nag banner on it.
//
// The verify link carries a stateless HMAC-signed token (no tokens table):
//   token = <userId>.<expiryUnixSeconds>.<hmacSha256Hex>
// The /verify-email route validates the signature + expiry and stamps
// `email_verified_at = now()`. Everything is best-effort: a missing Resend key
// (dev / pre-launch) just means no email is sent and the banner offers Resend.

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days

function secret(): string {
  return (
    process.env.EMAIL_VERIFY_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "wielo-email-verify"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Mint a signed verification token for a user id. */
export function createVerificationToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Validate a token; returns the userId when valid + unexpired, else null. */
export function verifyVerificationToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const expected = sign(`${userId}.${expStr}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  return userId;
}

/**
 * Send (or resend) the verification email to a user. Uses the shared Shell-based
 * ConfirmEmail template so it matches every other Wielo email. Best-effort:
 * returns `{ ok: false }` when Resend isn't configured or the send fails.
 */
export async function sendVerificationEmail(input: {
  userId: string;
  email: string;
  origin: string;
  firstName?: string | null;
}): Promise<{ ok: boolean }> {
  // Fall back to NEXT_PUBLIC_APP_URL when the request origin header is missing
  // (some proxy/edge setups), so the link can't silently fail to build in prod.
  const base = input.origin || process.env.NEXT_PUBLIC_APP_URL || "";
  if (!base || !input.email) return { ok: false };
  const brandName = await getBrandName();
  const token = createVerificationToken(input.userId);
  const link = `${base}/verify-email?token=${encodeURIComponent(token)}`;
  const res = await sendReactEmail({
    to: input.email,
    subject: `Confirm your email — ${brandName}`,
    react: createElement(ConfirmEmail, {
      firstName: input.firstName ?? "there",
      confirmUrl: link,
      brandName,
    }),
  });
  if (!res.ok) console.error("[verifyEmail] send failed:", res.error);
  return { ok: res.ok };
}

/**
 * Anti-enumeration: when someone tries to sign up with an email that already
 * has an account, we DON'T confirm existence to the browser — instead we email
 * the real owner a heads-up (+ a sign-in / reset link). Uses the shared
 * ExistingAccount Shell template. Best-effort; inert without a Resend key. The
 * signup rate limit caps how often this can fire, so it can't email-bomb an inbox.
 */
export async function sendExistingAccountNotice(input: {
  email: string;
  origin: string;
}): Promise<{ ok: boolean }> {
  const base = input.origin || process.env.NEXT_PUBLIC_APP_URL || "";
  if (!base || !input.email) return { ok: false };
  const brandName = await getBrandName();
  const res = await sendReactEmail({
    to: input.email,
    subject: `You already have a ${brandName} account`,
    react: createElement(ExistingAccount, {
      signInUrl: `${base}/login`,
      resetUrl: `${base}/forgot-password`,
      brandName,
    }),
  });
  return { ok: res.ok };
}

/** Stamp a user's profile as verified. Idempotent. */
export async function markEmailVerified(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("user_profiles")
      .update({ email_verified_at: new Date().toISOString() })
      .eq("id", userId);
    return !error;
  } catch {
    return false;
  }
}
