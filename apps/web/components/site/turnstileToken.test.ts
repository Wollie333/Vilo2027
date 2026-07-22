import { describe, expect, it, vi } from "vitest";

// ensureTurnstileToken is the fix for a real conversion problem: Turnstile
// often paints "Failed to connect" for a few seconds before retrying and going
// green. Forms used to reject the submit at that moment. These tests pin the
// behaviour that stops that costing a signup.

async function freshModule() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
  return import("./TurnstileWidget");
}

describe("ensureTurnstileToken", () => {
  it("returns a token already in hand without waiting", async () => {
    const { ensureTurnstileToken } = await freshModule();
    await expect(ensureTurnstileToken("have-it")).resolves.toBe("have-it");
  });

  it("resolves null immediately when Turnstile is not configured", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    const { ensureTurnstileToken } = await import("./TurnstileWidget");
    // Must not hang for the full timeout when the feature is off entirely.
    await expect(ensureTurnstileToken(null, 50)).resolves.toBeNull();
  });

  it("gives up after the timeout rather than hanging the submit forever", async () => {
    const { ensureTurnstileToken } = await freshModule();
    // The caller then decides — it does NOT mean the submit is refused.
    await expect(ensureTurnstileToken(null, 20)).resolves.toBeNull();
  });

  it("keeps its promise pending until a token arrives, then resolves it", async () => {
    // The whole point: a submit that lands mid-challenge waits, and completes
    // the moment Cloudflare answers, instead of erroring at the visitor.
    const mod = await freshModule();
    let settled: string | null | undefined;
    const pending = mod
      .ensureTurnstileToken(null, 5_000)
      .then((t) => (settled = t));

    await Promise.resolve();
    expect(settled).toBeUndefined(); // still waiting, not rejected

    // Simulate the widget's success callback landing late.
    mod.__publishTokenForTest("late-token");
    await pending;
    expect(settled).toBe("late-token");
  });

  it("does not resolve waiters on a transient error", async () => {
    // error-callback publishes null. A waiter must keep waiting for the retry
    // rather than treating the first blip as a final answer.
    const mod = await freshModule();
    let settled: string | null | undefined;
    const pending = mod
      .ensureTurnstileToken(null, 5_000)
      .then((t) => (settled = t));

    mod.__publishTokenForTest(null); // the "Failed to connect" moment
    await Promise.resolve();
    expect(settled).toBeUndefined();

    mod.__publishTokenForTest("after-retry"); // Turnstile retried and won
    await pending;
    expect(settled).toBe("after-retry");
  });
});
