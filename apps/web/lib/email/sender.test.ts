import { afterEach, describe, expect, it } from "vitest";

import { emailConfigStatus, emailFrom } from "./sender";

// The bug this guards: EMAIL_FROM_ADDRESS was read in four places, and the ones
// using `??` treated an env var that is SET BUT EMPTY as configured — handing
// Resend `from: ""`, which it rejects. Nothing bounced and nothing errored,
// because every send path swallows failures, so the only symptom was customers
// never hearing from us.

const ORIGINAL = {
  from: process.env.EMAIL_FROM_ADDRESS,
  key: process.env.RESEND_API_KEY,
};

afterEach(() => {
  process.env.EMAIL_FROM_ADDRESS = ORIGINAL.from;
  process.env.RESEND_API_KEY = ORIGINAL.key;
});

describe("emailFrom", () => {
  it("falls back when the variable is missing", () => {
    delete process.env.EMAIL_FROM_ADDRESS;
    expect(emailFrom()).toContain("resend.dev");
  });

  it("falls back when the variable is set but EMPTY", () => {
    process.env.EMAIL_FROM_ADDRESS = "";
    expect(emailFrom()).toContain("resend.dev");
  });

  it("falls back when the variable is only whitespace", () => {
    process.env.EMAIL_FROM_ADDRESS = "   ";
    expect(emailFrom()).toContain("resend.dev");
  });

  it("uses a real configured sender", () => {
    process.env.EMAIL_FROM_ADDRESS = "Wielo <hello@wielo.co.za>";
    expect(emailFrom()).toBe("Wielo <hello@wielo.co.za>");
  });
});

describe("emailConfigStatus", () => {
  it("reports delivery broken when there is no API key", () => {
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM_ADDRESS = "Wielo <hello@wielo.co.za>";
    const s = emailConfigStatus();
    expect(s.apiKeyPresent).toBe(false);
    expect(s.deliveryBroken).toBe(true);
    expect(s.reason).toMatch(/RESEND_API_KEY/);
  });

  it("reports delivery broken on the sandbox sender, even with a key", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM_ADDRESS = "";
    const s = emailConfigStatus();
    expect(s.apiKeyPresent).toBe(true);
    expect(s.senderConfigured).toBe(false);
    // The trap: a key IS set, so it looks configured — but resend.dev only
    // delivers to the Resend account owner, so no customer ever receives it.
    expect(s.deliveryBroken).toBe(true);
    expect(s.reason).toMatch(/EMAIL_FROM_ADDRESS/);
  });

  it("is healthy with both a key and a real sender", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM_ADDRESS = "Wielo <hello@wielo.co.za>";
    const s = emailConfigStatus();
    expect(s.deliveryBroken).toBe(false);
    expect(s.reason).toBeNull();
  });
});
