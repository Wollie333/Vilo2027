"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  consumeBackupCode,
  disableMfaForUser,
  hasVerifiedFactor,
  listUserFactors,
  regenerateBackupCodes,
} from "@/lib/auth/mfa";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { requireReauth } from "@/lib/auth/reauth";
import { clientIpFromHeaders } from "@/lib/security/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Begin TOTP enrolment: create a factor and hand back the QR to scan.
 *
 * The factor is created UNVERIFIED — nothing changes about how the account signs
 * in until a first valid code proves the authenticator actually works. Enrolling
 * and walking away must never lock anybody out.
 */
export async function startMfaEnrolmentAction(): Promise<
  ActionResult<{ factorId: string; qr: string; secret: string }>
> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Please sign in." };

  if (await hasVerifiedFactor(user.id)) {
    return { ok: false, error: "Two-factor is already on for this account." };
  }

  // Clear abandoned attempts first — Supabase rejects a second factor with the
  // same friendly name, so a half-finished enrolment would block every retry.
  const admin = createAdminClient();
  for (const f of await listUserFactors(user.id)) {
    if (f.status !== "verified") {
      await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
  });
  if (error || !data) {
    return { ok: false, error: "Could not start setup. Try again." };
  }

  return {
    ok: true,
    data: {
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    },
  };
}

/**
 * Finish enrolment by proving the authenticator produces the right code, then
 * hand back the recovery codes ONCE — this is the only moment they exist in
 * readable form. 2FA is not considered on until this succeeds.
 */
export async function confirmMfaEnrolmentAction(
  factorId: string,
  code: string,
): Promise<ActionResult<{ backupCodes: string[] }>> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const limit = await checkRateLimit(
    clientIpFromHeaders(headers()),
    "mfa-verify",
    10,
    15,
  );
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many attempts. Wait a few minutes and try again.",
    };
  }

  const { data: challenge, error: challengeErr } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeErr || !challenge) {
    return { ok: false, error: "Could not verify that code. Try again." };
  }

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.replace(/\s/g, ""),
  });
  if (verifyErr) {
    return { ok: false, error: "That code isn't right. Try the next one." };
  }

  const backupCodes = await regenerateBackupCodes(user.id);
  if (!backupCodes) {
    // Recovery codes are not optional garnish — without them this account could
    // be stranded. Roll the whole thing back rather than half-enable 2FA.
    await disableMfaForUser(user.id);
    return {
      ok: false,
      error:
        "Could not create your recovery codes — two-factor was not turned on.",
    };
  }

  revalidatePath("/account/security");
  return { ok: true, data: { backupCodes } };
}

/**
 * Turn 2FA off — behind re-authentication.
 *
 * Without this gate the whole feature is decorative: someone holding a borrowed
 * session would simply switch it off. Disabling a security control has to be at
 * least as hard as the control itself.
 */
export async function disableMfaAction(
  currentPassword?: string,
): Promise<ActionResult> {
  const { user } = await requireUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const limit = await checkRateLimit(
    clientIpFromHeaders(headers()),
    "reauth",
    10,
    15,
  );
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many attempts. Wait a few minutes and try again.",
    };
  }

  const reauth = await requireReauth(user.email, currentPassword);
  if (!reauth.ok) return { ok: false, error: reauth.error };

  await disableMfaForUser(user.id);
  revalidatePath("/account/security");
  return { ok: true };
}

/** Issue a fresh set of recovery codes, invalidating every previous one. */
export async function regenerateBackupCodesAction(
  currentPassword?: string,
): Promise<ActionResult<{ backupCodes: string[] }>> {
  const { user } = await requireUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const limit = await checkRateLimit(
    clientIpFromHeaders(headers()),
    "reauth",
    10,
    15,
  );
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many attempts. Wait a few minutes and try again.",
    };
  }

  const reauth = await requireReauth(user.email, currentPassword);
  if (!reauth.ok) return { ok: false, error: reauth.error };

  const codes = await regenerateBackupCodes(user.id);
  if (!codes) return { ok: false, error: "Could not create new codes." };

  revalidatePath("/account/security");
  return { ok: true, data: { backupCodes: codes } };
}

/**
 * Redeem a recovery code at the sign-in challenge.
 *
 * A recovery code cannot produce an AAL2 session — only the authenticator can —
 * so redeeming one switches 2FA OFF and lets the user back in at AAL1. The UI
 * says so plainly beforehand; quietly downgrading someone's security would be
 * worse than the lockout it avoids.
 */
export async function redeemBackupCodeAction(
  code: string,
): Promise<ActionResult<{ disabled: true }>> {
  const { user } = await requireUser();
  if (!user) return { ok: false, error: "Please sign in first." };

  const limit = await checkRateLimit(
    clientIpFromHeaders(headers()),
    "mfa-recovery",
    8,
    15,
  );
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many attempts. Wait a few minutes and try again.",
    };
  }

  const consumed = await consumeBackupCode(user.id, code);
  if (!consumed) return { ok: false, error: "That recovery code isn't valid." };

  await disableMfaForUser(user.id);
  return { ok: true, data: { disabled: true } };
}

/** Silence the "turn on two-factor" suggestion. It stays optional either way. */
export async function dismissMfaPromptAction(): Promise<ActionResult> {
  const { user } = await requireUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  await admin
    .from("user_profiles")
    .update({ mfa_prompt_dismissed_at: new Date().toISOString() })
    .eq("id", user.id);
  return { ok: true };
}

// Status is read by the page directly (a server component). It deliberately
// does NOT live here: every export from a "use server" module becomes a callable
// endpoint, and a read helper has no business being one.
