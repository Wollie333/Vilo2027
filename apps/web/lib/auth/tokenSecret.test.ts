import { afterEach, describe, expect, it } from "vitest";

import { tokenSecret } from "./tokenSecret";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("tokenSecret", () => {
  it("NEVER falls back to a constant when nothing is configured", () => {
    delete process.env.EMAIL_VERIFY_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    // The bug this replaces: verifyEmail.ts ended its chain with the literal
    // "wielo-email-verify", so an environment missing both vars signed tokens
    // with a secret published in this repo. Refusing is the only safe answer.
    expect(() => tokenSecret("email-verify")).toThrow(/No signing secret/);
  });

  it("gives each purpose DIFFERENT material from the same base key", () => {
    delete process.env.EMAIL_VERIFY_SECRET;
    delete process.env.REVIEW_TOKEN_SECRET;
    delete process.env.STATEMENT_TOKEN_SECRET;
    delete process.env.IMPERSONATION_TOKEN_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-value";

    const keys = (["email-verify", "review", "statement", "impersonation"] as const).map(
      (p) => tokenSecret(p).toString("hex"),
    );
    expect(new Set(keys).size).toBe(4);
  });

  it("never returns the raw service-role credential as the signing key", () => {
    delete process.env.REVIEW_TOKEN_SECRET;
    const base = "service-role-key-value";
    process.env.SUPABASE_SERVICE_ROLE_KEY = base;
    expect(tokenSecret("review").toString("utf8")).not.toBe(base);
  });

  it("prefers a dedicated per-purpose secret when set", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-value";
    process.env.REVIEW_TOKEN_SECRET = "dedicated-review-secret";
    expect(tokenSecret("review").toString("utf8")).toBe(
      "dedicated-review-secret",
    );
  });

  it("is deterministic, so a token signed now verifies later", () => {
    delete process.env.REVIEW_TOKEN_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-value";
    expect(tokenSecret("review").toString("hex")).toBe(
      tokenSecret("review").toString("hex"),
    );
  });
});
