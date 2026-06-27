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
// Encrypts OAuth tokens (access_token, refresh_token) and API keys for
// external review sources. Uses OAUTH_CIPHER_KEY (separate from banking key
// for security isolation).
//
// The matching Deno implementation lives in supabase/functions/_shared/
// oauth-crypto.ts.
//
// NEVER log the ciphertext, the plaintext, or the field name together with
// a row id. Sentry breadcrumbs auto-capture console.* so the same rule
// applies there.

const VERSION = "v1";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function tryLoadKey(): Buffer | null {
  const raw = process.env.OAUTH_CIPHER_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `OAUTH_CIPHER_KEY must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`, or unset it to store tokens in plain text.`,
    );
  }
  return key;
}

function isEncrypted(stored: string): boolean {
  if (!stored.startsWith(`${VERSION}.`)) return false;
  return stored.split(".").length === 4;
}

/**
 * Encrypts an OAuth token or API key for storage.
 * If OAUTH_CIPHER_KEY is not set, returns the plain text (fail-open for dev).
 */
export function encryptOAuthToken(plain: string): string {
  if (!plain) {
    throw new Error("encryptOAuthToken: empty plaintext");
  }
  const key = tryLoadKey();
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

/**
 * Decrypts an OAuth token or API key from storage.
 * Handles both encrypted (v1.…) and plain rows transparently.
 */
export function decryptOAuthToken(stored: string): string {
  if (!stored) {
    throw new Error("decryptOAuthToken: empty stored value");
  }
  if (!isEncrypted(stored)) return stored;

  const key = tryLoadKey();
  if (!key) {
    throw new Error(
      "decryptOAuthToken: row is encrypted but OAUTH_CIPHER_KEY is not set",
    );
  }
  const [, nonceB64, ctB64, tagB64] = stored.split(".");
  const nonce = Buffer.from(nonceB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("decryptOAuthToken: malformed ciphertext");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, nonce) as DecipherGCM;
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}

/**
 * Masks a token for display (last 4 chars visible).
 */
export function maskToken(plain: string): string {
  if (plain.length <= 4) return "••••";
  return `••••${plain.slice(-4)}`;
}

/**
 * Convenience: decrypt + mask in one call for list rendering.
 */
export function decryptAndMask(stored: string): string {
  return maskToken(decryptOAuthToken(stored));
}
