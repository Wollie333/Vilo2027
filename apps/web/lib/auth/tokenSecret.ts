import "server-only";

import { createHmac } from "node:crypto";

/**
 * Signing material for the app's own bearer tokens (email verification, review
 * links, statement links, impersonation).
 *
 * Three problems this replaces:
 *
 * 1. verifyEmail.ts ended its fallback chain with the LITERAL STRING
 *    "wielo-email-verify". Any environment missing both env vars would sign
 *    verification tokens with a secret that is published in this repository —
 *    forging one marks an arbitrary account's email as verified, and email
 *    verification now gates affiliate activation. A signing key must fail
 *    CLOSED, never fall back to a constant.
 *
 * 2. Every module used the raw SUPABASE_SERVICE_ROLE_KEY as HMAC material. That
 *    is a database credential doing a signing key's job — and it means the
 *    signing secret cannot be rotated without rotating database access, so in
 *    practice it never is.
 *
 * 3. All purposes shared one secret, so they were not domain-separated. A token
 *    minted for one purpose is structurally a token for another; only the
 *    payload shape stood between them.
 *
 * A dedicated per-purpose env var is used when present. Otherwise the key is
 * DERIVED from the service-role key with the purpose as the label, so each
 * purpose gets distinct material and the raw credential is never the signing
 * key itself. With neither available it throws.
 *
 * NOTE: this changes the derivation, so tokens minted before it are no longer
 * valid — outstanding verification and review links must be re-sent. Acceptable
 * under the pre-MVP data policy; it would need a dual-verify window otherwise.
 */
export type TokenPurpose =
  | "email-verify"
  | "review"
  | "statement"
  | "impersonation";

/** Dedicated override per purpose — set these in production and rotate freely. */
const ENV_BY_PURPOSE: Record<TokenPurpose, string> = {
  "email-verify": "EMAIL_VERIFY_SECRET",
  review: "REVIEW_TOKEN_SECRET",
  statement: "STATEMENT_TOKEN_SECRET",
  impersonation: "IMPERSONATION_TOKEN_SECRET",
};

/** Material derived from the service-role key — the no-dedicated-key fallback. */
function derived(purpose: TokenPurpose): Buffer | null {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base) return null;
  // Domain separation: one compromised purpose must not yield the others.
  return createHmac("sha256", base).update(`wielo/token/${purpose}`).digest();
}

/**
 * Every secret a token may LEGITIMATELY have been signed with — newest first.
 *
 * Signing always uses the first entry. Verification tries them all, which is
 * what makes a key rotatable at all: without it, changing the variable
 * instantly invalidates every verification link, review link and statement URL
 * already in someone's inbox, and the only symptom is customers reporting that
 * "the link doesn't work".
 *
 * Order:
 *   1. `<PURPOSE>_SECRET`           — current, used for signing
 *   2. `<PURPOSE>_SECRET_PREVIOUS`  — the key being rotated out
 *   3. derived from the service-role key
 *
 * (3) matters more than it looks: production currently has no dedicated keys,
 * so every outstanding link is signed with derived material. Keeping it in the
 * verify list means setting a dedicated key for the first time does NOT break
 * links already sent — the migration is seamless in the safe direction.
 *
 * Rotating is then: set `_PREVIOUS` to the old value, set the main key to the
 * new one, wait out the longest token lifetime, delete `_PREVIOUS`.
 */
export function tokenSecretsForVerify(purpose: TokenPurpose): Buffer[] {
  const out: Buffer[] = [];
  const current = process.env[ENV_BY_PURPOSE[purpose]]?.trim();
  if (current) out.push(Buffer.from(current, "utf8"));

  const previous = process.env[`${ENV_BY_PURPOSE[purpose]}_PREVIOUS`]?.trim();
  if (previous) out.push(Buffer.from(previous, "utf8"));

  const fallback = derived(purpose);
  if (fallback) out.push(fallback);

  if (out.length === 0) {
    throw new Error(
      `No signing secret available for "${purpose}". Set ${ENV_BY_PURPOSE[purpose]} (or SUPABASE_SERVICE_ROLE_KEY).`,
    );
  }
  return out;
}

export function tokenSecret(purpose: TokenPurpose): Buffer {
  const dedicated = process.env[ENV_BY_PURPOSE[purpose]]?.trim();
  if (dedicated) return Buffer.from(dedicated, "utf8");

  const base = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base) {
    // Fail closed. An unsigned or predictably-signed token is worse than a
    // feature that refuses to work, because it fails silently and in the
    // attacker's favour.
    throw new Error(
      `No signing secret available for "${purpose}". Set ${ENV_BY_PURPOSE[purpose]} (or SUPABASE_SERVICE_ROLE_KEY).`,
    );
  }

  // Domain separation: one compromised purpose must not yield the others.
  return createHmac("sha256", base).update(`wielo/token/${purpose}`).digest();
}
