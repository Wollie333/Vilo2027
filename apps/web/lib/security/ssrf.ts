import "server-only";

import net from "node:net";
import { lookup } from "node:dns/promises";

// SSRF guard for fetching user-supplied URLs server-side (e.g. iCal feed import).
// Without this, an authenticated user could point a feed at internal services or
// the cloud metadata endpoint (169.254.169.254) and exfiltrate the response via
// the stored error/feed content.

/** IPv4/IPv6 addresses that must never be fetched (loopback/private/link-local/ULA). */
function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true; // this-host / private / loopback
    if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::") return true; // loopback / unspecified
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique-local
  if (v.startsWith("fe80")) return true; // link-local
  const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/); // IPv4-mapped
  if (mapped) return isPrivateAddress(mapped[1]);
  return false;
}

/**
 * Reject a URL before fetching it: must be http(s), and its host must NOT resolve
 * to a private/loopback/link-local address. Throws with a user-safe message.
 */
export async function assertFetchableUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, ""); // unwrap [::1]
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("That address isn't allowed.");
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new Error("Couldn't resolve that host.");
  }
  if (addrs.length === 0) throw new Error("Couldn't resolve that host.");
  for (const a of addrs) {
    if (isPrivateAddress(a.address)) {
      throw new Error("That address isn't allowed.");
    }
  }
}
