import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "node:crypto";

// AES-256-GCM for host payment-gateway secrets (Paystack secret key / PayPal
// client secret). Storage format: v1.<nonce_b64>.<ciphertext_b64>.<tag_b64>
//
// Mirrors lib/crypto/banking.ts but reads a SEPARATE key (PAYMENT_CIPHER_KEY)
// so a compromise of one blast radius doesn't expose the other. Encryption is
// OPTIONAL in the same way: if the key is set we encrypt, otherwise we store
// plain text and round-trip transparently — so a deployment can turn it on or
// off without a data migration.
//
// NEVER log the ciphertext, the plaintext, or pair the secret with a row id —
// Sentry breadcrumbs auto-capture console.* so the same rule applies there.
// The decrypted secret must never be returned to a client; it is only used
// server-side to call the host's gateway.

const VERSION = "v1";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function tryLoadKey(): Buffer | null {
  const raw = process.env.PAYMENT_CIPHER_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `PAYMENT_CIPHER_KEY must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`, or unset it to store secrets in plain text.`,
    );
  }
  return key;
}

function isEncrypted(stored: string): boolean {
  if (!stored.startsWith(`${VERSION}.`)) return false;
  return stored.split(".").length === 4;
}

export function encryptSecret(plain: string): string {
  if (!plain) throw new Error("encryptSecret: empty plaintext");
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

export function decryptSecret(stored: string): string {
  if (!stored) throw new Error("decryptSecret: empty stored value");
  if (!isEncrypted(stored)) return stored;

  const key = tryLoadKey();
  if (!key) {
    throw new Error(
      "decryptSecret: row is encrypted but PAYMENT_CIPHER_KEY is not set",
    );
  }
  const [, nonceB64, ctB64, tagB64] = stored.split(".");
  const nonce = Buffer.from(nonceB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("decryptSecret: malformed payment ciphertext");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, nonce) as DecipherGCM;
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}

// Last 4 characters of a secret — what the host sees in the settings list so
// they can recognise which key is stored without ever exposing it.
export function secretLast4(plain: string): string {
  const trimmed = plain.trim();
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}
