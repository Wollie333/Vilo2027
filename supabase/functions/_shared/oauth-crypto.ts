// AES-256-GCM OAuth token crypto for Edge Functions (Deno runtime).
//
// Mirrors apps/web/lib/crypto/oauth.ts. Same key (OAUTH_CIPHER_KEY),
// same wire format: v1.<nonce_b64>.<ciphertext_b64>.<tag_b64>.
//
// Used to decrypt OAuth access/refresh tokens and API keys stored in
// external_review_sources when syncing reviews from external platforms.
//
// Web Crypto's encrypt() returns ciphertext concatenated with the 16-byte
// auth tag; we slice the tail off to match Node's separate getAuthTag()
// shape so both runtimes produce identical strings.
//
// Per security guidelines — never log the ciphertext, plaintext, or row id
// alongside the field name.

// @ts-expect-error Deno global
const env = Deno.env;

const VERSION = "v1";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function decodeBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeBase64(b: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin);
}

function isEncrypted(stored: string): boolean {
  if (!stored.startsWith(`${VERSION}.`)) return false;
  return stored.split(".").length === 4;
}

async function loadKey(): Promise<CryptoKey> {
  const raw = env.get("OAUTH_CIPHER_KEY");
  if (!raw) {
    throw new Error("OAUTH_CIPHER_KEY is not set on this Edge Function.");
  }
  const bytes = decodeBase64(raw);
  if (bytes.length !== 32) {
    throw new Error(
      `OAUTH_CIPHER_KEY must decode to 32 bytes (got ${bytes.length}).`,
    );
  }
  return await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypts an OAuth token or API key for storage.
 */
export async function encryptOAuthToken(plain: string): Promise<string> {
  if (!plain) throw new Error("encryptOAuthToken: empty plaintext");
  const key = await loadKey();
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const ctWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: TAG_BYTES * 8 },
      key,
      new TextEncoder().encode(plain),
    ),
  );
  // Web Crypto appends the auth tag to the ciphertext; split it back out so
  // the on-disk format matches the Node implementation.
  const ct = ctWithTag.slice(0, ctWithTag.length - TAG_BYTES);
  const tag = ctWithTag.slice(ctWithTag.length - TAG_BYTES);
  return [
    VERSION,
    encodeBase64(nonce),
    encodeBase64(ct),
    encodeBase64(tag),
  ].join(".");
}

/**
 * Decrypts an OAuth token or API key from storage.
 * Handles both encrypted (v1.…) and plain rows transparently.
 */
export async function decryptOAuthToken(stored: string): Promise<string> {
  if (!stored) throw new Error("decryptOAuthToken: empty stored value");

  // Plain text (unencrypted) — return as-is
  if (!isEncrypted(stored)) return stored;

  const [, nonceB64, ctB64, tagB64] = stored.split(".");
  const key = await loadKey();
  const nonce = decodeBase64(nonceB64);
  const ct = decodeBase64(ctB64);
  const tag = decodeBase64(tagB64);
  if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("decryptOAuthToken: malformed ciphertext");
  }
  // Recombine for Web Crypto's expected shape.
  const ctWithTag = new Uint8Array(ct.length + tag.length);
  ctWithTag.set(ct, 0);
  ctWithTag.set(tag, ct.length);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, tagLength: TAG_BYTES * 8 },
      key,
      ctWithTag,
    ),
  );
  return new TextDecoder().decode(plain);
}

/**
 * Masks a token for logging (last 4 chars visible).
 */
export function maskToken(plain: string): string {
  if (plain.length <= 4) return "••••";
  return `••••${plain.slice(-4)}`;
}
