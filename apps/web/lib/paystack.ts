/**
 * Paystack API thin wrappers. **Server-side only.**
 *
 * Paystack amounts are in the lowest currency unit — for ZAR that's cents
 * (1 R = 100). Conversion happens here; the rest of the codebase stores and
 * displays amounts in full Rands.
 */

const PAYSTACK_BASE = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not set.");
  }
  return key;
}

export type InitializeResponse = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

/**
 * Initialize a Paystack transaction. Returns the URL the guest is redirected
 * to so Paystack can collect card details. After the guest pays, Paystack
 * redirects them to `callback_url` and fires a webhook.
 */
export async function initializeTransaction(input: {
  amount: number; // full Rands
  currency: string; // "ZAR"
  email: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  reference?: string;
}): Promise<InitializeResponse> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amount * 100),
      currency: input.currency,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      reference: input.reference,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paystack initialize failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    status: boolean;
    message: string;
    data?: InitializeResponse;
  };

  if (!json.status || !json.data) {
    throw new Error(`Paystack initialize rejected: ${json.message}`);
  }

  return json.data;
}

/**
 * Verify a transaction by reference (defence-in-depth — webhook is the
 * primary signal; verify is used by the success page as a fast-path).
 */
export type VerifyResponse = {
  status: "success" | "failed" | "abandoned" | string;
  reference: string;
  amount: number; // in lowest unit
  currency: string;
  paid_at: string | null;
  customer: { email: string };
};

export async function verifyTransaction(
  reference: string,
): Promise<VerifyResponse | null> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${getSecretKey()}` },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    status: boolean;
    data?: VerifyResponse;
  };
  if (!json.status || !json.data) return null;
  return json.data;
}
