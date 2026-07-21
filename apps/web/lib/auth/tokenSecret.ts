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
