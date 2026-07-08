import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getBrandName } from "@/lib/brand";
import { sendTransactionalEmail } from "@/lib/email/send";
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

function verifyEmailHtml(input: {
  brandName: string;
  link: string;
  firstName: string | null;
}): string {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi there,";
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1f2937;">
    <h1 style="font-size:20px;font-weight:700;color:#064E3B;margin:0 0 16px;">Confirm your email</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
      Welcome to ${input.brandName}. Please confirm this is your email address so we can
      keep your account and bookings secure.
    </p>
    <a href="${input.link}" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">
      Confirm my email
    </a>
    <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:24px 0 0;">
      If the button doesn't work, copy and paste this link into your browser:<br />
      <a href="${input.link}" style="color:#10B981;word-break:break-all;">${input.link}</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:16px 0 0;">
      This link expires in 3 days. Didn't create a ${input.brandName} account? You can
      safely ignore this email.
    </p>
  </div>`;
}

/**
 * Send (or resend) the verification email to a user. Best-effort: returns
 * `{ ok: false }` when Resend isn't configured or the send fails, never throws.
 */
export async function sendVerificationEmail(input: {
  userId: string;
  email: string;
  origin: string;
  firstName?: string | null;
}): Promise<{ ok: boolean }> {
  if (!input.origin || !input.email) return { ok: false };
  const brandName = await getBrandName();
  const token = createVerificationToken(input.userId);
  const link = `${input.origin}/verify-email?token=${encodeURIComponent(token)}`;
  const res = await sendTransactionalEmail({
    to: input.email,
    subject: `Confirm your email — ${brandName}`,
    html: verifyEmailHtml({
      brandName,
      link,
      firstName: input.firstName ?? null,
    }),
  });
  if (!res.ok) console.error("[verifyEmail] send failed:", res.error);
  return { ok: res.ok };
}

function existingAccountHtml(input: {
  brandName: string;
  signInLink: string;
  resetLink: string;
}): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1f2937;">
    <h1 style="font-size:20px;font-weight:700;color:#064E3B;margin:0 0 16px;">You already have an account</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hi there,</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
      Someone (hopefully you) just tried to sign up for ${input.brandName} with this email
      address — but you already have an account. There's nothing new to set up; just sign in.
    </p>
    <a href="${input.signInLink}" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">
      Sign in
    </a>
    <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:24px 0 0;">
      Forgot your password? <a href="${input.resetLink}" style="color:#10B981;">Reset it here</a>.
    </p>
    <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:16px 0 0;">
      If this wasn't you, you can safely ignore this email — no one can access your account without
      your password.
    </p>
  </div>`;
}

/**
 * Anti-enumeration: when someone tries to sign up with an email that already
 * has an account, we DON'T confirm existence to the browser — instead we email
 * the real owner a heads-up (+ a sign-in / reset link). Best-effort; inert
 * without a Resend key. The signup rate limit caps how often this can fire, so
 * it can't be used to email-bomb an inbox.
 */
export async function sendExistingAccountNotice(input: {
  email: string;
  origin: string;
}): Promise<{ ok: boolean }> {
  if (!input.origin || !input.email) return { ok: false };
  const brandName = await getBrandName();
  const res = await sendTransactionalEmail({
    to: input.email,
    subject: `You already have a ${brandName} account`,
    html: existingAccountHtml({
      brandName,
      signInLink: `${input.origin}/login`,
      resetLink: `${input.origin}/forgot-password`,
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
