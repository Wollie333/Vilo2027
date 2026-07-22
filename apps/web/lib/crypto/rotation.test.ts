import { afterEach, describe, expect, it, vi } from "vitest";

// Rotation is the property these tests exist to protect. Without a _PREVIOUS
// fallback, changing a cipher key makes every row encrypted with the old one
// permanently unreadable — silent data loss found weeks later, when someone
// tries to take a payment or pay a host out.

const KEY_A = Buffer.alloc(32, 1).toString("base64");
const KEY_B = Buffer.alloc(32, 2).toString("base64");

async function paymentsWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.stubEnv("PAYMENT_CIPHER_KEY", env.PAYMENT_CIPHER_KEY ?? "");
  vi.stubEnv(
    "PAYMENT_CIPHER_KEY_PREVIOUS",
    env.PAYMENT_CIPHER_KEY_PREVIOUS ?? "",
  );
  return import("./payments");
}

afterEach(() => vi.unstubAllEnvs());

describe("cipher key rotation", () => {
  it("round-trips with a single key", async () => {
    const m = await paymentsWith({ PAYMENT_CIPHER_KEY: KEY_A });
    const stored = m.encryptSecret("sk_live_secret");
    expect(stored).not.toContain("sk_live_secret");
    expect(m.decryptSecret(stored)).toBe("sk_live_secret");
  });

  it("reads OLD rows after the key is rotated, when _PREVIOUS is set", async () => {
    // Step 1 of the runbook: encrypted under A.
    const old = await paymentsWith({ PAYMENT_CIPHER_KEY: KEY_A });
    const stored = old.encryptSecret("sk_live_secret");

    // Step 2: A moves to _PREVIOUS, B becomes current.
    const rotated = await paymentsWith({
      PAYMENT_CIPHER_KEY: KEY_B,
      PAYMENT_CIPHER_KEY_PREVIOUS: KEY_A,
    });
    expect(rotated.decryptSecret(stored)).toBe("sk_live_secret");
  });

  it("encrypts NEW rows with the current key, not the previous one", async () => {
    const rotated = await paymentsWith({
      PAYMENT_CIPHER_KEY: KEY_B,
      PAYMENT_CIPHER_KEY_PREVIOUS: KEY_A,
    });
    const fresh = rotated.encryptSecret("written-during-rotation");

    // Step 4: _PREVIOUS retired. The new row must still read.
    const after = await paymentsWith({ PAYMENT_CIPHER_KEY: KEY_B });
    expect(after.decryptSecret(fresh)).toBe("written-during-rotation");
  });

  it("fails LOUDLY on a row no available key can read", async () => {
    // The dangerous case: rotated without _PREVIOUS, old rows not re-encrypted.
    // It must throw, never return rubbish that gets sent to a payment gateway.
    const old = await paymentsWith({ PAYMENT_CIPHER_KEY: KEY_A });
    const stored = old.encryptSecret("sk_live_secret");

    const broken = await paymentsWith({ PAYMENT_CIPHER_KEY: KEY_B });
    expect(() => broken.decryptSecret(stored)).toThrow(/could not decrypt/i);
  });

  it("passes plain-text rows straight through", async () => {
    // Rows written before encryption was switched on stay readable.
    const m = await paymentsWith({ PAYMENT_CIPHER_KEY: KEY_A });
    expect(m.decryptSecret("sk_test_plain")).toBe("sk_test_plain");
  });

  it("rejects a wrong-length key rather than producing garbage", async () => {
    const m = await paymentsWith({ PAYMENT_CIPHER_KEY: "dG9vLXNob3J0" });
    expect(() => m.encryptSecret("x")).toThrow(/32 bytes/);
  });
});
