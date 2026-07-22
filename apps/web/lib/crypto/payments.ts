import "server-only";

import { cipherKeys, currentCipherKey, decryptWithAny } from "./keys";

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
  return currentCipherKey("PAYMENT_CIPHER_KEY");
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
  // Newest key first, falling back to PAYMENT_CIPHER_KEY_PREVIOUS during a
  // rotation. GCM authenticates, so a wrong key throws rather than returning
  // plausible-looking rubbish.
  return decryptWithAny(
    cipherKeys("PAYMENT_CIPHER_KEY"),
    (k) => {
      const decipher = createDecipheriv("aes-256-gcm", k, nonce) as DecipherGCM;
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
        "utf8",
      );
    },
    () => {
      throw new Error(
        "decryptSecret: could not decrypt with PAYMENT_CIPHER_KEY or PAYMENT_CIPHER_KEY_PREVIOUS — wrong key, or the row was encrypted with a key that is gone.",
      );
    },
  );
}

// Last 4 characters of a secret — what the host sees in the settings list so
// they can recognise which key is stored without ever exposing it.
export function secretLast4(plain: string): string {
  const trimmed = plain.trim();
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}
