#!/usr/bin/env node
/**
 * Encrypt secrets that are already sitting in the database in plain text.
 *
 * WHY THIS EXISTS
 * ---------------
 * encryptSecret()/encryptAccountNumber() only run when a row is WRITTEN. Setting
 * PAYMENT_CIPHER_KEY / BANKING_CIPHER_KEY therefore protects nothing that is
 * already stored — every existing gateway secret and bank account number stays
 * in the clear until somebody happens to re-save it by hand. That is a silent
 * half-migration, and it is exactly the kind of thing that gets marked "done".
 *
 * Storage format (identical in lib/crypto/payments.ts and lib/crypto/banking.ts,
 * but keyed separately so one compromise does not expose the other):
 *   v1.<nonce_b64>.<ciphertext_b64>.<tag_b64>     AES-256-GCM
 *
 * USAGE
 *   node scripts/encrypt-secrets-backfill.mjs            # dry run, changes nothing
 *   node scripts/encrypt-secrets-backfill.mjs --apply    # actually writes
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and whichever of
 * PAYMENT_CIPHER_KEY / BANKING_CIPHER_KEY you are backfilling. A column whose key
 * is absent is SKIPPED, never silently left half-done.
 *
 * Safe to re-run: already-encrypted values (v1.…) are detected and left alone.
 */
import { createCipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

// Load .env.local if present, without clobbering real environment values.
try {
  const env = readFileSync(new URL("../apps/web/.env.local", import.meta.url), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  // Running against real environment variables only — fine.
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

/** Every column that is supposed to be encrypted at rest, and by which key. */
const TARGETS = [
  { table: "platform_payment_settings", column: "paystack_secret_key", key: "PAYMENT_CIPHER_KEY" },
  { table: "platform_payment_settings", column: "paystack_test_secret_key", key: "PAYMENT_CIPHER_KEY" },
  { table: "platform_payment_settings", column: "paypal_secret_cipher", key: "PAYMENT_CIPHER_KEY" },
  { table: "host_payment_gateways", column: "secret_cipher", key: "PAYMENT_CIPHER_KEY" },
  { table: "host_websites", column: "meta_capi_access_token", key: "PAYMENT_CIPHER_KEY" },
  { table: "platform_integrations", column: "meta_capi_access_token", key: "PAYMENT_CIPHER_KEY" },
  { table: "eft_banking_details", column: "account_number", key: "BANKING_CIPHER_KEY" },
  { table: "affiliate_payout_methods", column: "account_number", key: "BANKING_CIPHER_KEY" },
];

function loadKey(name) {
  const raw = process.env[name];
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`${name} must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`.`);
  }
  return key;
}

function encrypt(plain, key) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", nonce.toString("base64"), ct.toString("base64"), tag.toString("base64")].join(".");
}

const isEncrypted = (v) => typeof v === "string" && v.startsWith("v1.") && v.split(".").length === 4;

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

let totalPlain = 0;
let totalEncrypted = 0;
let totalSkipped = 0;

for (const t of TARGETS) {
  let key;
  try {
    key = loadKey(t.key);
  } catch (e) {
    console.error(`  ✖ ${t.table}.${t.column}: ${e.message}`);
    process.exitCode = 1;
    continue;
  }

  let rows;
  try {
    rows = await rest(`${t.table}?select=id,${t.column}`);
  } catch (e) {
    console.log(`  – ${t.table}.${t.column}: unavailable (${String(e).slice(0, 60)})`);
    continue;
  }

  const plain = rows.filter((r) => r[t.column] && !isEncrypted(r[t.column]));
  if (plain.length === 0) {
    console.log(`  ✓ ${t.table}.${t.column}: nothing in plain text`);
    continue;
  }
  totalPlain += plain.length;

  if (!key) {
    console.log(`  ! ${t.table}.${t.column}: ${plain.length} plain — SKIPPED, ${t.key} is not set`);
    totalSkipped += plain.length;
    continue;
  }

  if (!APPLY) {
    console.log(`  → ${t.table}.${t.column}: ${plain.length} would be encrypted`);
    continue;
  }

  for (const row of plain) {
    // Value is never logged, in success or failure.
    await rest(`${t.table}?id=eq.${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ [t.column]: encrypt(String(row[t.column]), key) }),
    });
    totalEncrypted += 1;
  }
  console.log(`  ✓ ${t.table}.${t.column}: encrypted ${plain.length}`);
}

console.log(
  APPLY
    ? `\nDone. Encrypted ${totalEncrypted}. Skipped ${totalSkipped} for want of a key.`
    : `\nDry run. ${totalPlain} value(s) in plain text; ${totalSkipped} of those have no key set. Re-run with --apply.`,
);
if (totalSkipped > 0) {
  console.log("Set the missing key(s) and re-run — until then those values stay in the clear.");
}
