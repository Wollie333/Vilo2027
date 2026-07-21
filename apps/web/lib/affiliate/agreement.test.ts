import { describe, expect, it } from "vitest";

import { agreementHash, normaliseIp } from "./agreement.crypto";
import { agreementParagraphs, renderAgreementBody } from "./agreement.shared";

// WS-6b — the signed affiliate agreement. What is snapshotted must be exactly
// what the partner read, and the hash must move the moment the text does.

describe("renderAgreementBody", () => {
  it("substitutes every {brand} token", () => {
    expect(renderAgreementBody("{brand} pays {brand} partners.", "Wielo")).toBe(
      "Wielo pays Wielo partners.",
    );
  });

  it("leaves text without tokens untouched", () => {
    expect(renderAgreementBody("Commission is paid monthly.", "Wielo")).toBe(
      "Commission is paid monthly.",
    );
  });
});

describe("agreementParagraphs", () => {
  it("splits on blank lines and drops empties", () => {
    expect(agreementParagraphs("One.\n\n  \n\nTwo.\n\nThree.\n\n")).toEqual([
      "One.",
      "Two.",
      "Three.",
    ]);
  });
});

describe("agreementHash", () => {
  it("is a stable 64-char sha256 hex digest", () => {
    const h = agreementHash("Terms v1");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(agreementHash("Terms v1")).toBe(h);
  });

  it("changes when a single character of the agreement changes", () => {
    expect(agreementHash("Commission is 10%.")).not.toBe(
      agreementHash("Commission is 15%."),
    );
  });

  it("hashes the RENDERED body, so a brand rename is a different document", () => {
    const raw = "{brand} pays commission.";
    expect(agreementHash(renderAgreementBody(raw, "Wielo"))).not.toBe(
      agreementHash(renderAgreementBody(raw, "Vilo")),
    );
  });
});

describe("normaliseIp", () => {
  it("keeps a bare IPv4", () => {
    expect(normaliseIp("41.13.7.22")).toBe("41.13.7.22");
  });

  it("strips the port some proxies append (inet would reject it)", () => {
    expect(normaliseIp("41.13.7.22:53102")).toBe("41.13.7.22");
  });

  it("keeps IPv6, bracketed or bare", () => {
    expect(normaliseIp("[2001:db8::1]:443")).toBe("2001:db8::1");
    expect(normaliseIp("2001:db8::1")).toBe("2001:db8::1");
  });

  it("rejects a spoofed hostname rather than poisoning the write", () => {
    expect(normaliseIp("evil.example.com")).toBeUndefined();
    expect(normaliseIp("  ")).toBeUndefined();
    expect(normaliseIp(null)).toBeUndefined();
  });
});
