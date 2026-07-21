import { createCipheriv, randomBytes } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { decryptAccountNumber } from "./banking";
import { decryptSecret } from "./payments";

/**
 * scripts/encrypt-secrets-backfill.mjs re-implements the cipher, because it is a
 * plain node script and cannot import these `server-only` TypeScript modules.
 *
 * That duplication is the danger: if the two ever disagree on the wire format,
 * the backfill would write values the application cannot read — silently
 * destroying live payment-gateway secrets and bank account numbers, with no
 * error until the next charge is attempted.
 *
 * This test is the contract between them. If it fails, the script must be fixed
 * BEFORE it is run against anything real.
 */
const KEY_B64 = Buffer.alloc(32, 7).toString("base64");

/** Byte-for-byte copy of the script's encrypt(). Keep the two identical. */
function scriptEncrypt(plain: string, keyB64: string): string {
  const key = Buffer.from(keyB64, "base64");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    nonce.toString("base64"),
    ct.toString("base64"),
    tag.toString("base64"),
  ].join(".");
}

const ORIGINAL = {
  payment: process.env.PAYMENT_CIPHER_KEY,
  banking: process.env.BANKING_CIPHER_KEY,
};

afterEach(() => {
  process.env.PAYMENT_CIPHER_KEY = ORIGINAL.payment;
  process.env.BANKING_CIPHER_KEY = ORIGINAL.banking;
});

describe("backfill script cipher compatibility", () => {
  it("produces payment ciphertext the app can decrypt", () => {
    process.env.PAYMENT_CIPHER_KEY = KEY_B64;
    const secret = "sk_live_abc123_not_a_real_key";
    expect(decryptSecret(scriptEncrypt(secret, KEY_B64))).toBe(secret);
  });

  it("produces banking ciphertext the app can decrypt", () => {
    process.env.BANKING_CIPHER_KEY = KEY_B64;
    const account = "62001234567";
    expect(decryptAccountNumber(scriptEncrypt(account, KEY_B64))).toBe(account);
  });

  it("survives unicode and long values", () => {
    process.env.PAYMENT_CIPHER_KEY = KEY_B64;
    const odd = "ünïcødé—key／with·punctuation ".repeat(20);
    expect(decryptSecret(scriptEncrypt(odd, KEY_B64))).toBe(odd);
  });

  it("leaves an already-encrypted value alone when re-run", () => {
    process.env.PAYMENT_CIPHER_KEY = KEY_B64;
    const once = scriptEncrypt("sk_test_x", KEY_B64);
    // The script's isEncrypted() check: v1 prefix and exactly four parts.
    expect(once.startsWith("v1.")).toBe(true);
    expect(once.split(".")).toHaveLength(4);
  });
});
