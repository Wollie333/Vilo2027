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
 * Read a PayPal order's current state WITHOUT capturing. Used by reconciliation
 * to tell an already-CAPTURED (COMPLETED) order — whose local flip was lost — apart
 * from a still-APPROVED order that needs capturing. Returns null on failure.
 */
export async function getPayPalOrder(
  orderId: string,
  creds: PayPalCreds,
): Promise<{ status: string } | null> {
  const token = await getPayPalAccessToken(creds);
  if (!token) return null;
  const res = await fetch(
    `${BASE_URL[creds.env]}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { status?: string };
  if (!json.status) return null;
  return { status: json.status };
}

// ─── Native subscriptions (Wielo platform rail) ──────────────────────────────
// PayPal recurring uses the Subscriptions API: a Catalog Product → a Billing Plan
// (fixed price, monthly/annual) → a Subscription the payer approves. PayPal then
// auto-charges each cycle and fires webhooks (PAYMENT.SALE.COMPLETED etc.). Only
// the PLATFORM PayPal app runs these (Wielo's own subscription revenue) — never a
// host key. Amounts are USD (PayPal can't hold ZAR); the ledger stays ZAR.

/**
 * Create (or reuse) a PayPal Catalog Product — the umbrella a Billing Plan hangs
 * off. One per Wielo product is enough; we create lazily and cache the id in
 * product_billing_plans. Returns the product id or null on failure.
 */
export async function createPayPalCatalogProduct(input: {
  name: string;
  description?: string;
  creds: PayPalCreds;
  requestId?: string;
}): Promise<string | null> {
  const token = await getPayPalAccessToken(input.creds);
  if (!token) return null;
  const res = await fetch(`${BASE_URL[input.creds.env]}/v1/catalogs/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(input.requestId ? { "PayPal-Request-Id": input.requestId } : {}),
    },
    body: JSON.stringify({
      name: input.name.slice(0, 127),
      description: input.description?.slice(0, 256),
      type: "SERVICE",
      category: "SOFTWARE",
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}

/**
 * Create a fixed-price Billing Plan on a Catalog Product. `amount` is USD (the
 * plan price is frozen at this value; ZAR drift is handled by re-versioning the
 * plan, not editing it). Returns the plan id or null on failure.
 */
export async function createPayPalBillingPlan(input: {
  productId: string;
  name: string;
  cycle: "monthly" | "annual";
  amount: number; // USD
  currency?: string; // "USD"
  creds: PayPalCreds;
  requestId?: string;
}): Promise<string | null> {
  const token = await getPayPalAccessToken(input.creds);
  if (!token) return null;
  const currency = input.currency ?? "USD";
  const res = await fetch(`${BASE_URL[input.creds.env]}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(input.requestId ? { "PayPal-Request-Id": input.requestId } : {}),
    },
    body: JSON.stringify({
      product_id: input.productId,
      name: input.name.slice(0, 127),
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: input.cycle === "annual" ? "YEAR" : "MONTH",
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // infinite until cancelled
          pricing_scheme: {
            fixed_price: {
              value: input.amount.toFixed(2),
              currency_code: currency,
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CANCEL",
        payment_failure_threshold: 1,
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}

/**
 * Create a Subscription on a Billing Plan → returns the subscription id + the
 * payer approval URL. `customId` correlates the PayPal subscription back to our
 * row (we pass the Wielo subscription id) and rides on every webhook. Capture the
 * subscription id + confirm ACTIVE when the payer returns. Null on failure.
 */
export async function createPayPalSubscription(input: {
  planId: string;
  returnUrl: string;
  cancelUrl: string;
  customId?: string;
  subscriberEmail?: string;
  brandName?: string;
  creds: PayPalCreds;
  requestId?: string;
}): Promise<{ subscriptionId: string; approveUrl: string } | null> {
  const token = await getPayPalAccessToken(input.creds);
  if (!token) return null;
  const res = await fetch(
    `${BASE_URL[input.creds.env]}/v1/billing/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(input.requestId ? { "PayPal-Request-Id": input.requestId } : {}),
      },
      body: JSON.stringify({
        plan_id: input.planId,
        custom_id: input.customId,
        subscriber: input.subscriberEmail
          ? { email_address: input.subscriberEmail }
          : undefined,
        application_context: {
          brand_name: input.brandName?.slice(0, 127) ?? "Wielo",
          user_action: "SUBSCRIBE_NOW",
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
          shipping_preference: "NO_SHIPPING",
        },
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    id?: string;
    links?: Array<{ rel: string; href: string }>;
  };
  const approve = json.links?.find((l) => l.rel === "approve")?.href;
  if (!json.id || !approve) return null;
  return { subscriptionId: json.id, approveUrl: approve };
}

/**
 * Read a subscription's current state (status, custom_id, billing_info) without
 * mutating it — used by the return page (confirm ACTIVE) and the reconcile cron
 * (drift). Returns null on failure.
 */
export async function getPayPalSubscription(
  subscriptionId: string,
  creds: PayPalCreds,
): Promise<{
  status: string;
  customId: string | null;
  planId: string | null;
  nextBillingTime: string | null;
} | null> {
  const token = await getPayPalAccessToken(creds);
  if (!token) return null;
  const res = await fetch(
    `${BASE_URL[creds.env]}/v1/billing/subscriptions/${encodeURIComponent(
      subscriptionId,
    )}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    status?: string;
    custom_id?: string;
    plan_id?: string;
    billing_info?: { next_billing_time?: string };
  };
  if (!json.status) return null;
  return {
    status: json.status,
    customId: json.custom_id ?? null,
    planId: json.plan_id ?? null,
    nextBillingTime: json.billing_info?.next_billing_time ?? null,
  };
}

/**
 * Cancel a PayPal subscription (used on downgrade/rebuild + host cancellation).
 * Returns true on success (204) or when the subscription is already inactive.
 */
export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason: string,
  creds: PayPalCreds,
): Promise<boolean> {
  const token = await getPayPalAccessToken(creds);
  if (!token) return false;
  const res = await fetch(
    `${BASE_URL[creds.env]}/v1/billing/subscriptions/${encodeURIComponent(
      subscriptionId,
    )}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: reason.slice(0, 127) }),
      cache: "no-store",
    },
  );
  // 204 = cancelled; 422 = already cancelled/expired (treat as done).
  return res.status === 204 || res.status === 422;
}

/**
 * Verify a PayPal webhook signature via PayPal's verification API — the ONLY
 * trustworthy way (headers alone are forgeable). Passes the transmission headers
 * + the RAW event body + our PAYPAL_WEBHOOK_ID; PayPal returns SUCCESS/FAILURE.
 * Returns false on any error (fail closed). `rawBody` MUST be the exact bytes
 * received (parse a fresh copy for the event; don't re-stringify).
 */
export async function verifyPayPalWebhookSignature(input: {
  headers: {
    transmissionId: string | null;
    transmissionTime: string | null;
    certUrl: string | null;
    authAlgo: string | null;
    transmissionSig: string | null;
  };
  rawBody: string;
  webhookId: string;
  creds: PayPalCreds;
}): Promise<boolean> {
  const h = input.headers;
  if (
    !h.transmissionId ||
    !h.transmissionTime ||
    !h.certUrl ||
    !h.authAlgo ||
    !h.transmissionSig ||
    !input.webhookId
  ) {
    return false;
  }
  const token = await getPayPalAccessToken(input.creds);
  if (!token) return false;
  try {
    const res = await fetch(
      `${BASE_URL[input.creds.env]}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // webhook_event must be the parsed JSON of the exact raw body.
        body: `{"transmission_id":${JSON.stringify(
          h.transmissionId,
        )},"transmission_time":${JSON.stringify(
          h.transmissionTime,
        )},"cert_url":${JSON.stringify(h.certUrl)},"auth_algo":${JSON.stringify(
          h.authAlgo,
        )},"transmission_sig":${JSON.stringify(
          h.transmissionSig,
        )},"webhook_id":${JSON.stringify(
          input.webhookId,
        )},"webhook_event":${input.rawBody}}`,
        cache: "no-store",
      },
    );
    if (!res.ok) return false;
    const json = (await res.json()) as { verification_status?: string };
    return json.verification_status === "SUCCESS";
  } catch {
    return false;
  }
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
