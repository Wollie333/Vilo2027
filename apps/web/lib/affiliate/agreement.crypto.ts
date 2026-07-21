import { createHash } from "node:crypto";

// Pure server-side helpers for the signed affiliate agreement (WS-6b). Kept
// apart from agreement.ts (which is `server-only` and DB-bound) so they can be
// unit-tested, and apart from agreement.shared.ts (client-safe) so node:crypto
// never reaches the browser bundle.

/** sha256 of the exact body text signed — the tamper check for a snapshot. */
export function agreementHash(bodyText: string): string {
  return createHash("sha256").update(bodyText, "utf8").digest("hex");
}

/**
 * `inet` rejects the port suffix some proxies append (`1.2.3.4:53102`) and any
 * hostname a spoofed XFF may carry. Return undefined rather than poison a write.
 */
export function normaliseIp(
  raw: string | null | undefined,
): string | undefined {
  const ip = raw?.trim();
  if (!ip) return undefined;
  const v4 = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (v4) return v4[1];
  const bracketed = ip.match(/^\[([0-9a-fA-F:]+)\](?::\d+)?$/);
  if (bracketed) return bracketed[1];
  return /^[0-9a-fA-F:]+$/.test(ip) && ip.includes(":") ? ip : undefined;
}
