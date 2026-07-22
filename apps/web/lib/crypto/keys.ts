import "server-only";

/**
 * Cipher-key resolution shared by the banking / payment / oauth modules.
 *
 * The point of this file is ROTATION. Every cipher key here protects data at
 * rest, which makes rotating one far more dangerous than rotating a signing
 * key: change the variable and every row already encrypted with the old key
 * becomes permanently unreadable. Not "links stop working" — actual data loss,
 * discovered later, when someone tries to take a payment or pay a host out.
 *
 * So each key reads as a LIST, newest first:
 *
 *   <KEY>            the current key — the only one ever used to ENCRYPT
 *   <KEY>_PREVIOUS   the key being rotated out — accepted for DECRYPT only
 *
 * Rotation then becomes safe and reversible, done entirely from the hosting
 * dashboard:
 *
 *   1. set <KEY>_PREVIOUS to the CURRENT value        (nothing changes yet)
 *   2. set <KEY> to the NEW value, redeploy           (new writes use the new
 *                                                      key; old rows still read)
 *   3. re-encrypt existing rows                       (scripts/encrypt-secrets-
 *                                                      backfill.mjs, or let
 *                                                      writes migrate them)
 *   4. delete <KEY>_PREVIOUS, redeploy                (old key retired)
 *
 * Stop after step 2 and nothing is broken — that is the property worth having.
 * The dangerous version was: change the value, hope.
 */

/** Every key that may legitimately decrypt a row, newest first. */
export function cipherKeys(envName: string): Buffer[] {
  const out: Buffer[] = [];
  for (const name of [envName, `${envName}_PREVIOUS`]) {
    const raw = process.env[name];
    if (!raw?.trim()) continue;
    const key = Buffer.from(raw.trim(), "base64");
    if (key.length !== 32) {
      throw new Error(
        `${name} must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`.`,
      );
    }
    out.push(key);
  }
  return out;
}

/** The key to ENCRYPT with — always the current one. null = store plain text. */
export function currentCipherKey(envName: string): Buffer | null {
  return cipherKeys(envName)[0] ?? null;
}

/**
 * Try each candidate key in turn, newest first.
 *
 * A wrong key fails GCM's auth tag rather than returning wrong bytes, so
 * "try the next one" is safe here in a way it would not be with an unauthenticated
 * cipher. Throws the supplied error when every key fails, so a genuinely
 * corrupt or foreign-keyed row is still loud.
 */
export function decryptWithAny<T>(
  keys: Buffer[],
  attempt: (key: Buffer) => T,
  onExhausted: () => never,
): T {
  for (const key of keys) {
    try {
      return attempt(key);
    } catch {
      // Wrong key for this row — try the next.
    }
  }
  onExhausted();
}
