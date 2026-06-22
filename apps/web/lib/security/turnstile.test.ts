import { afterEach, describe, expect, it, vi } from "vitest";

// turnstile.ts is a server module (`import "server-only"`); stub that marker so
// the helper can be unit-tested in the node environment.
vi.mock("server-only", () => ({}));

import { clientIpFromHeaders, verifyTurnstile } from "@/lib/security/turnstile";

const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET_KEY;

function okResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = ORIGINAL_SECRET;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("verifyTurnstile", () => {
  it("is inert (passes, no network) when no secret is configured", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await verifyTurnstile("anything")).toEqual({
      ok: true,
      skipped: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a missing/blank token once a secret is set", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await verifyTurnstile(undefined)).toEqual({
      ok: false,
      reason: "missing-token",
    });
    expect(await verifyTurnstile("   ")).toEqual({
      ok: false,
      reason: "missing-token",
    });
    // Never hit the network when there's nothing to verify.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes when Cloudflare returns success:true", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse({ success: true })),
    );
    expect(await verifyTurnstile("token")).toEqual({ ok: true });
  });

  it("fails closed when Cloudflare returns success:false", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        okResponse({
          success: false,
          "error-codes": ["invalid-input-response"],
        }),
      ),
    );
    expect(await verifyTurnstile("token")).toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("fails closed on a network error", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await verifyTurnstile("token")).toEqual({
      ok: false,
      reason: "error",
    });
  });

  it("posts the secret, token and remoteip to siteverify", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sek";
    const fetchSpy = vi.fn(async () => okResponse({ success: true }));
    vi.stubGlobal("fetch", fetchSpy);

    await verifyTurnstile("tok", "1.2.3.4");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("siteverify");
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe("sek");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });
});

describe("clientIpFromHeaders", () => {
  it("prefers CF-Connecting-IP", () => {
    const h = new Headers({
      "cf-connecting-ip": "9.9.9.9",
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
    });
    expect(clientIpFromHeaders(h)).toBe("9.9.9.9");
  });

  it("falls back to the first x-forwarded-for hop", () => {
    const h = new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" });
    expect(clientIpFromHeaders(h)).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip, then undefined", () => {
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "3.3.3.3" }))).toBe(
      "3.3.3.3",
    );
    expect(clientIpFromHeaders(new Headers())).toBeUndefined();
  });
});
