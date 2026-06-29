import "server-only";

/**
 * PayPal REST API thin wrappers. **Server-side only.**
 *
 * Direct-host payments: every call takes the host's OWN PayPal app credentials
 * (client id + secret) and environment, so orders are created and captured on
 * the host's account and funds settle directly to them (Wielo takes 0%). PayPal
 * is the "international" option — charged in USD (SA hosts can't hold a ZAR
 * PayPal balance), with the USD amount derived from the ZAR base via lib/fx.ts.
 */

export type PayPalEnv = "test" | "live";

export type PayPalCreds = {
  clientId: string;
  secret: string;
  env: PayPalEnv;
};

const BASE_URL: Record<PayPalEnv, string> = {
  test: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

/**
 * Fetch an OAuth access token for the host's PayPal app. Returns null on any
 * failure (bad credentials, wrong environment, network) — callers treat null
 * as "invalid / unusable credentials".
 */
export async function getPayPalAccessToken(
  creds: PayPalCreds,
): Promise<string | null> {
  try {
    const basic = Buffer.from(`${creds.clientId}:${creds.secret}`).toString(
      "base64",
    );
    const res = await fetch(`${BASE_URL[creds.env]}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Validate host-supplied PayPal credentials by obtaining an access token in
 * the chosen environment.
 */
export async function validatePayPalCredentials(
  creds: PayPalCreds,
): Promise<boolean> {
  return (await getPayPalAccessToken(creds)) !== null;
}

/**
 * Create a CAPTURE-intent order on the host's PayPal account. Returns the order
 * id and the payer-facing approval URL. Capture happens after the payer
 * approves (see capturePayPalOrder). Used by the guest checkout (later) and by
 * the host "request a payment" link.
 */
export async function createPayPalOrder(input: {
  amount: number; // full units, e.g. USD
  currency: string; // "USD"
  description?: string;
  returnUrl: string;
  cancelUrl: string;
  creds: PayPalCreds;
}): Promise<{ orderId: string; approveUrl: string } | null> {
  const token = await getPayPalAccessToken(input.creds);
  if (!token) return null;

  const res = await fetch(`${BASE_URL[input.creds.env]}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: input.currency,
            value: input.amount.toFixed(2),
          },
          description: input.description?.slice(0, 127),
        },
      ],
      application_context: {
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        user_action: "PAY_NOW",
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    id?: string;
    links?: Array<{ rel: string; href: string }>;
  };
  const approve = json.links?.find((l) => l.rel === "approve")?.href;
  if (!json.id || !approve) return null;
  return { orderId: json.id, approveUrl: approve };
}

/**
 * Capture an approved PayPal order on the host's account. Returns the capture
 * status (e.g. "COMPLETED") or null on failure.
 */
export async function capturePayPalOrder(
  orderId: string,
  creds: PayPalCreds,
): Promise<{ status: string; captureId: string | null } | null> {
  const token = await getPayPalAccessToken(creds);
  if (!token) return null;

  const res = await fetch(
    `${BASE_URL[creds.env]}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;

  const json = (await res.json()) as {
    status?: string;
    purchase_units?: Array<{
      payments?: { captures?: Array<{ id: string }> };
    }>;
  };
  if (!json.status) return null;
  const captureId =
    json.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
  return { status: json.status, captureId };
}
