import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "node:crypto";

// AES-256-GCM. Storage format: v1.<nonce_b64>.<ciphertext_b64>.<tag_b64>
//
// Per AGENT_RULES.md §1.5 banking account_number SHOULD be encrypted at the
// application layer. Encryption is now OPTIONAL: if BANKING_CIPHER_KEY is
// set we encrypt new rows; if it's absent we store the value as plain text
// (hosts treat their EFT deposit account as a public business detail). The
// matching Deno implementation lives in supabase/functions/_shared/banking-
// crypto.ts.
//
// On read, decryptAccountNumber sniffs the stored format and handles both
// encrypted (v1.…) and plain rows transparently, so a deployment can turn
// encryption back on (or off) without a data migration.
//
// NEVER log the ciphertext, the plaintext, or the field name together with
// a row id. Sentry breadcrumbs auto-capture console.* so the same rule
// applies there.

const VERSION = "v1";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function tryLoadKey(): Buffer | null {
  const raw = process.env.BANKING_CIPHER_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    // A misconfigured key is worse than no key — it would silently produce
    // garbage. Fail loudly so the deployer notices.
    throw new Error(
      `BANKING_CIPHER_KEY must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`, or unset it to store account numbers in plain text.`,
    );
  }
  return key;
}

function isEncrypted(stored: string): boolean {
  // Encrypted form is exactly four dot-separated parts starting with v1.
  // Plain-text account numbers are digits with no dots, so the check is
  // unambiguous.
  if (!stored.startsWith(`${VERSION}.`)) return false;
  return stored.split(".").length === 4;
}

export function encryptAccountNumber(plain: string): string {
  if (!plain) {
    throw new Error("encryptAccountNumber: empty plaintext");
  }
  const key = tryLoadKey();
  // No key → fall back to plain storage. The caller stores whatever we
  // return; decryptAccountNumber will round-trip it correctly below.
  if (!key) return plain;
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce) as CipherGCM;
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    nonce.toString("base64"),
    ct.toString("base64"),
    tag.toString("base64"),
  ].join(".");
}

export function decryptAccountNumber(stored: string): string {
  if (!stored) {
    throw new Error("decryptAccountNumber: empty stored value");
  }
  // Plain row (or a row stored back when encryption was disabled) — return
  // as-is. This means rotating BANKING_CIPHER_KEY does NOT break old plain
  // rows; the migration is forward-only and lazy.
  if (!isEncrypted(stored)) return stored;

  const key = tryLoadKey();
  if (!key) {
    // The row is encrypted but the deployer removed the key. That's a
    // configuration mistake — fail loudly rather than silently masking it.
    throw new Error(
      "decryptAccountNumber: row is encrypted but BANKING_CIPHER_KEY is not set",
    );
  }
  const [, nonceB64, ctB64, tagB64] = stored.split(".");
  const nonce = Buffer.from(nonceB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("decryptAccountNumber: malformed banking ciphertext");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, nonce) as DecipherGCM;
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}

// Last 4 digits of the account number, prefixed with bullets. Used wherever
// we display banking to a caller who's allowed to know an account exists but
// not its full number (the host's own list, admin views).
export function maskAccountNumber(plain: string): string {
  const digits = plain.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return `••••${digits.slice(-4)}`;
}

// Convenience: decrypt + mask in one call for list rendering. Throws on
// malformed input so a corrupted row surfaces in logs rather than silently
// rendering as "••••".
export function decryptAndMask(stored: string): string {
  return maskAccountNumber(decryptAccountNumber(stored));
}
