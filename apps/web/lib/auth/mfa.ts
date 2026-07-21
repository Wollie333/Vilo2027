import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Optional two-factor authentication (TOTP).
 *
 * 2FA is offered to every account type and required of none — it is suggested to
 * hosts and staff, where the money and the guest data are, and simply available
 * to everyone else. Supabase Auth handles the TOTP factor itself; what it does
 * NOT provide is recovery codes, so those live here.
 *
 * Recovery codes matter more than the TOTP maths. Optional 2FA that can strand
 * someone out of their own account is worse than no 2FA — they will avoid it,
 * or we will spend launch week doing manual account recovery.
 */

const CODE_COUNT = 10;
// Crockford-ish alphabet: no O/0, I/1, or U — a recovery code is read off a
// screen and typed back later, often from a photo or a scrap of paper.
const ALPHABET = "ABCDEFGHJKLMNPQRSTVWXYZ23456789";

export function hashBackupCode(code: string): string {
  // Normalised before hashing so formatting (case, dashes, spaces) never
  // decides whether someone gets back into their account.
  return createHash("sha256")
    .update(code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(), "utf8")
    .digest("hex");
}

function generateCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

/**
 * Replace the user's recovery codes and return the PLAINTEXT set — the only
 * time they are ever knowable. Regenerating invalidates every previous code, so
 * a printout that may have been seen cannot still be used.
 */
export async function regenerateBackupCodes(
  userId: string,
): Promise<string[] | null> {
  const admin = createAdminClient();
  const codes = Array.from({ length: CODE_COUNT }, generateCode);

  await admin.from("user_mfa_backup_codes").delete().eq("user_id", userId);
  const { error } = await admin.from("user_mfa_backup_codes").insert(
    codes.map((c) => ({
      user_id: userId,
      code_hash: hashBackupCode(c),
    })),
  );
  if (error) return null;
  return codes;
}

/** How many unused recovery codes remain — shown so "2 left" prompts a refresh. */
export async function countUnusedBackupCodes(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("user_mfa_backup_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);
  return count ?? 0;
}

/**
 * Redeem a recovery code. Single-use: the update is conditional on the row still
 * being unused, so two simultaneous attempts cannot both succeed on one code.
 */
export async function consumeBackupCode(
  userId: string,
  code: string,
): Promise<boolean> {
  if (!code?.trim()) return false;
  const admin = createAdminClient();

  const { data } = await admin
    .from("user_mfa_backup_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("code_hash", hashBackupCode(code))
    .is("used_at", null)
    .select("id");

  return !!data && data.length > 0;
}

export async function deleteBackupCodes(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("user_mfa_backup_codes").delete().eq("user_id", userId);
}

export type MfaFactorSummary = {
  id: string;
  status: string;
  friendlyName: string | null;
  createdAt: string | null;
};

/**
 * The user's TOTP factors, read with the service role.
 *
 * Unverified factors accumulate whenever someone opens the enrolment page and
 * walks away, so callers that ask "is 2FA on?" must look for a VERIFIED one —
 * an abandoned enrolment must never start challenging anybody.
 */
export async function listUserFactors(
  userId: string,
): Promise<MfaFactorSummary[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error || !data) return [];
  return (data.factors ?? []).map((f) => ({
    id: f.id,
    status: f.status,
    friendlyName: f.friendly_name ?? null,
    createdAt: f.created_at ?? null,
  }));
}

export async function hasVerifiedFactor(userId: string): Promise<boolean> {
  return (await listUserFactors(userId)).some((f) => f.status === "verified");
}

/**
 * Turn 2FA off entirely: remove every factor and burn the recovery codes.
 *
 * Also the recovery path. A recovery code cannot mint an AAL2 session — only the
 * authenticator can — so redeeming one necessarily means "switch 2FA off and let
 * me back in", after which the user is asked to set it up again. Anything else
 * would be pretending to a level of assurance that was never reached.
 */
export async function disableMfaForUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  const factors = await listUserFactors(userId);
  for (const f of factors) {
    await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
  }
  await deleteBackupCodes(userId);
}
