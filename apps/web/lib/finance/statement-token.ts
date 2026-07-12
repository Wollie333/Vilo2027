import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Ephemeral, signed token for a Statement of Account (F4). A statement is a
// bank-style VIEW over a ledger — it mints NO document number and stores NO row.
// Instead the shareable link carries a signed payload describing WHICH slice to
// render ({party, counterparty, period}); the hosted page re-derives the numbers
// live from the ledger on every view. Past periods are immutable, so a shared
// statement stays stable. Modelled on lib/admin/impersonation.ts (HMAC payload
// + signature); the secret is SUPABASE_SERVICE_ROLE_KEY (server-only). No
// expiry: a statement link is meant to be kept, and it exposes only figures the
// recipient is already entitled to see.

export type StatementContext = "host_guest" | "wielo_host";

export type StatementToken = {
  v: 1;
  /** host_guest = host issues to a guest; wielo_host = Wielo issues to a host. */
  ctx: StatementContext;
  /** The host — issuer (host_guest) or the billed party (wielo_host). */
  hostId: string;
  /** host_guest only: the canonical guest key (gkey) the statement is scoped to. */
  gkey?: string;
  /** wielo_host only: the host's user id (platform_ledger is keyed by user_id). */
  userId?: string;
  /** Inclusive period start (ISO date) or null for all activity. */
  from: string | null;
  /** Inclusive period end / statement "as at" date (ISO date). */
  to: string;
  /** When the statement link was generated (ISO). */
  issuedAt: string;
  currency: string;
};

function getSecret(): Buffer {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for statement token signing.",
    );
  return Buffer.from(key);
}

export function signStatementToken(payload: StatementToken): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyStatementToken(token: string): StatementToken | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: StatementToken;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf-8"),
    ) as StatementToken;
  } catch {
    return null;
  }
  if (payload.v !== 1 || !payload.ctx || !payload.hostId || !payload.to) {
    return null;
  }
  return payload;
}
