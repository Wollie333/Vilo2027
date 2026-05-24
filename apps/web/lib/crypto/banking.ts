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
// Per AGENT_RULES.md §1.5 every banking account_number is encrypted at the
// application layer before storage. This module is Node-side; the matching
// Deno implementation lives in supabase/functions/_shared/banking-crypto.ts.
//
// NEVER log the ciphertext, the plaintext, or the field name together with
// a row id. Sentry breadcrumbs auto-capture console.* so the same rule
// applies there.

const VERSION = "v1";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function loadKey(): Buffer {
  const raw = process.env.BANKING_CIPHER_KEY;
  if (!raw) {
    throw new Error(
      "BANKING_CIPHER_KEY is not set. Generate with `openssl rand -base64 32` and set it in Doppler (dev→Vercel + dev→Supabase Edge syncs forward it).",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `BANKING_CIPHER_KEY must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`.`,
    );
  }
  return key;
}

export function encryptAccountNumber(plain: string): string {
  if (!plain) {
    throw new Error("encryptAccountNumber: empty plaintext");
  }
  const key = loadKey();
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
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("decryptAccountNumber: unrecognised banking ciphertext");
  }
  const [, nonceB64, ctB64, tagB64] = parts;
  const key = loadKey();
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
