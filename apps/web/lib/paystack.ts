/**
 * Paystack API thin wrappers. **Server-side only.**
 *
 * Paystack amounts are in the lowest currency unit — for ZAR that's cents
 * (1 R = 100). Conversion happens here; the rest of the codebase stores and
 * displays amounts in full Rands.
 *
 * Direct-host payments: every call accepts an optional `secretKey`. When the
 * host has connected their OWN Paystack account we pass their decrypted secret
 * so funds settle directly to them (Wielo takes 0%). When omitted we fall back
 * to the platform `PAYSTACK_SECRET_KEY` env var — that path is reserved for
 * Wielo's own subscription billing.
 */

const PAYSTACK_BASE = "https://api.paystack.co";

function resolveSecretKey(override?: string): string {
  const key = override ?? process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "No Paystack secret key available (host key not supplied and PAYSTACK_SECRET_KEY is unset).",
    );
  }
  return key;
}

export type InitializeResponse = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

/**
 * Initialize a Paystack transaction. Returns the URL the customer is
 * redirected to so Paystack can collect card details. After they pay,
 * Paystack redirects to `callbackUrl`.
 *
 * `statementDescriptor` (host's chosen word/phrase for the customer's bank
 * statement) is forwarded in metadata. Final rendering on the statement is
 * subject to Paystack/issuer support; we always send it through.
 */
export async function initializeTransaction(input: {
  amount: number; // full Rands
  currency: string; // "ZAR"
  email: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  reference?: string;
  statementDescriptor?: string | null;
  /** Host's own Paystack secret. Omit to use the platform env key. */
  secretKey?: string;
}): Promise<InitializeResponse> {
  const metadata = {
    ...input.metadata,
    ...(input.statementDescriptor
      ? { statement_descriptor: input.statementDescriptor }
      : {}),
  };

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolveSecretKey(input.secretKey)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amount * 100),
      currency: input.currency,
      callback_url: input.callbackUrl,
      metadata,
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
 * Verify a transaction by reference (defence-in-depth — used by the success
 * page and as the primary confirmation for direct-host payments, which don't
 * rely on per-host webhooks).
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
  secretKey?: string,
): Promise<VerifyResponse | null> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${resolveSecretKey(secretKey)}` },
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

export type ChargeAuthorizationResponse = {
  status: "success" | "failed" | "abandoned" | string;
  reference: string;
  amount: number; // lowest unit (ZAR cents)
  currency: string;
  paid_at: string | null;
  gateway_response?: string;
};

/**
 * Re-charge a previously saved card authorization — the recurring-renewal engine
 * for the Paystack rail (hybrid model). The `authorization_code` is captured from
 * the first subscription `charge.success` and stored encrypted on the
 * subscription; the renewal worker decrypts it and calls this each cycle with a
 * per-(sub, period) idempotent `reference`.
 *
 * Returns the settled transaction, or **null** on an HTTP/parse failure. Null
 * means "unknown — leave it for the next tick"; a returned `status: "failed"` is
 * a real decline (route into dunning). Never treat null as a decline: a network
 * blip must not flip a paying host to past_due.
 */
export async function chargeAuthorization(input: {
  authorizationCode: string;
  email: string;
  amount: number; // full Rands
  currency: string; // "ZAR"
  reference: string;
  metadata?: Record<string, unknown>;
  /** Platform key for the active mode; omit to use the env key. */
  secretKey?: string;
}): Promise<ChargeAuthorizationResponse | null> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/charge_authorization`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolveSecretKey(input.secretKey)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      authorization_code: input.authorizationCode,
      email: input.email,
      amount: Math.round(input.amount * 100),
      currency: input.currency,
      reference: input.reference,
      metadata: input.metadata,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    status: boolean;
    message: string;
    data?: ChargeAuthorizationResponse;
  };
  if (!json.status || !json.data) return null;
  return json.data;
}

/**
 * Validate a host-supplied Paystack secret key by calling /balance. A 200 with
 * `status: true` means the key is live and usable. Returns the detected
 * environment (test/live) inferred from the key prefix, or null if invalid.
 */
export async function validatePaystackSecret(
  secretKey: string,
): Promise<{ valid: boolean; environment: "test" | "live" }> {
  const environment = secretKey.startsWith("sk_live_") ? "live" : "test";
  try {
    const res = await fetch(`${PAYSTACK_BASE}/balance`, {
      headers: { Authorization: `Bearer ${secretKey}` },
      cache: "no-store",
    });
    if (!res.ok) return { valid: false, environment };
    const json = (await res.json()) as { status?: boolean };
    return { valid: json.status === true, environment };
  } catch {
    return { valid: false, environment };
  }
}

/**
 * Create a shareable Paystack payment link on the host's own account — lets a
 * host accept a real payment today without the guest portal. Money settles
 * directly to the host. Returns the hosted checkout URL.
 */
export async function createPaystackPaymentLink(input: {
  amount: number; // full Rands
  email: string;
  reference?: string;
  description?: string;
  statementDescriptor?: string | null;
  callbackUrl?: string;
  secretKey: string;
}): Promise<{ url: string; reference: string }> {
  const result = await initializeTransaction({
    amount: input.amount,
    currency: "ZAR",
    email: input.email,
    callbackUrl:
      input.callbackUrl ??
      `${process.env.NEXT_PUBLIC_APP_URL || "https://wielo.co.za"}/pay/thanks`,
    reference: input.reference,
    statementDescriptor: input.statementDescriptor,
    metadata: input.description
      ? { description: input.description }
      : undefined,
    secretKey: input.secretKey,
  });
  return { url: result.authorization_url, reference: result.reference };
}
