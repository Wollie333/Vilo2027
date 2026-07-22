import { describe, expect, it } from "vitest";

import { normalizeIp } from "./auditWrite";

/**
 * `admin_audit_log.ip_address` is a Postgres `inet`. Every value below was cast
 * against the LIVE database on 2026-07-22 to confirm which ones Postgres
 * accepts — these are not guesses:
 *
 *   '102.65.1.1' ok · '::1' ok · '2001:db8::1' ok
 *   '102.65.1.1:443' ERROR · 'unknown' ERROR · 'fe80::1%eth0' ERROR
 *
 * A rejected cast used to be swallowed (the insert's `{ error }` was discarded
 * at five call sites), so the audit row vanished with no trace — the silent
 * no-op pattern, RULES.md §8.1, applied to the audit log itself.
 */
describe("normalizeIp", () => {
  it("passes through addresses Postgres accepts as inet", () => {
    expect(normalizeIp("102.65.1.1")).toBe("102.65.1.1");
    expect(normalizeIp("::1")).toBe("::1");
    expect(normalizeIp("2001:db8::1")).toBe("2001:db8::1");
  });

  it("strips a port rather than letting the inet cast fail", () => {
    expect(normalizeIp("102.65.1.1:443")).toBe("102.65.1.1");
  });

  it("returns null for values Postgres rejects", () => {
    // Proxies really do send this literal string.
    expect(normalizeIp("unknown")).toBeNull();
    // Zone-suffixed IPv6.
    expect(normalizeIp("fe80::1%eth0")).toBeNull();
    // Out-of-range octets.
    expect(normalizeIp("999.1.1.1")).toBeNull();
    expect(normalizeIp("example.com")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(normalizeIp(null)).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
    expect(normalizeIp("")).toBeNull();
    expect(normalizeIp("   ")).toBeNull();
  });
});
