// AES-256-GCM banking-detail crypto for Edge Functions (Deno runtime).
//
// Mirrors apps/web/lib/crypto/banking.ts. Same key (BANKING_CIPHER_KEY),
// same wire format: v1.<nonce_b64>.<ciphertext_b64>.<tag_b64>.
//
// Web Crypto's encrypt() returns ciphertext concatenated with the 16-byte
// auth tag; we slice the tail off to match Node's separate getAuthTag()
// shape so both runtimes produce identical strings.
//
// Per AGENT_RULES.md §1.5 — never log the ciphertext, plaintext, or row id
// alongside the field name. The decrypted value only goes into the response
// body when the caller has been verified as the booking's guest with an
// active EFT payment per §4.4.

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

async function loadKey(): Promise<CryptoKey> {
  const raw = env.get("BANKING_CIPHER_KEY");
  if (!raw) {
    throw new Error("BANKING_CIPHER_KEY is not set on this Edge Function.");
  }
  const bytes = decodeBase64(raw);
  if (bytes.length !== 32) {
    throw new Error(
      `BANKING_CIPHER_KEY must decode to 32 bytes (got ${bytes.length}).`,
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

export async function encryptAccountNumber(plain: string): Promise<string> {
  if (!plain) throw new Error("encryptAccountNumber: empty plaintext");
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

export async function decryptAccountNumber(stored: string): Promise<string> {
  if (!stored) throw new Error("decryptAccountNumber: empty stored value");
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("decryptAccountNumber: unrecognised banking ciphertext");
  }
  const [, nonceB64, ctB64, tagB64] = parts;
  const key = await loadKey();
  const nonce = decodeBase64(nonceB64);
  const ct = decodeBase64(ctB64);
  const tag = decodeBase64(tagB64);
  if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("decryptAccountNumber: malformed banking ciphertext");
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
