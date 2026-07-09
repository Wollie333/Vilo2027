import "server-only";

import { getPlatformPaystackSecret } from "@/lib/billing/platform-billing";
import { findOrCreateLeadIdentity } from "@/lib/enquiry/lead-identity";
import { convertZarToUsd } from "@/lib/fx";
import { slugify, uniqueSlug } from "@/lib/help/slug";
import { createPayPalOrder, capturePayPalOrder } from "@/lib/paypal";
import { getPlatformPayPal } from "@/lib/payments/platform-paypal";
import { initializeTransaction, verifyTransaction } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";

// Wielo product checkout — mirrors the host booking pay-link, but for Wielo's own
// products. The admin generates an order + tokenised pay-link; the user pays via
// Paystack (platform key) or EFT.

function token(): string {
  // URL-safe random token for the pay-link.
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return uuid.replace(/-/g, "");
}

// Absolute base URL for links Paystack (or the browser) must resolve. The
// request `origin` (threaded from the calling server action) is authoritative —
// env vars are unreliable here: the dev server runs on an autoPort so a hardcoded
// localhost:3000 would be wrong, and NEXT_PUBLIC_SITE_URL isn't always set. This
// was the bug: an empty base made Paystack's callback_url relative, so a
// successful test payment never redirected back to the thank-you page.
function resolveSiteBase(origin?: string | null): string {
  return (
    origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  );
}

export type CreateOrderResult =
  | { ok: true; token: string; url: string }
  | { ok: false; error: string };

// Create a pending order for a product + a pay-link to send the user.
export async function createProductOrder(
  input: {
    productId: string;
    email: string;
    createdBy: string | null;
  },
  origin?: string | null,
): Promise<CreateOrderResult> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, name, price, currency, is_active")
    .eq("id", input.productId)
    .maybeSingle();
  if (!product || !product.is_active) {
    return { ok: false, error: "Product not found or inactive." };
  }

  // Link to an existing Wielo account if the email matches one.
  const { data: payer } = await admin
    .from("user_profiles")
    .select("id")
    .ilike("email", input.email)
    .maybeSingle();

  const payToken = token();
  const { error } = await admin.from("product_orders").insert({
    product_id: product.id,
    product_name: product.name,
    payer_email: input.email.toLowerCase(),
    payer_user_id: payer?.id ?? null,
    amount: Number(product.price),
    currency: product.currency,
    status: "pending",
    pay_token: payToken,
    created_by: input.createdBy,
  });
  if (error) return { ok: false, error: error.message };

  const siteUrl = resolveSiteBase(origin);
  return {
    ok: true,
    token: payToken,
    url: `${siteUrl}/pay/product/${payToken}`,
  };
}

// Self-serve purchase from a product's standalone page (/p/[slug]).
export async function startProductPurchaseBySlug(
  slug: string,
  email: string,
  origin?: string | null,
): Promise<CreateOrderResult> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (!product || !product.is_active) {
    return { ok: false, error: "This product isn't available." };
  }
  return createProductOrder(
    { productId: product.id, email, createdBy: null },
    origin,
  );
}

// Self-serve subscription checkout that jumps STRAIGHT to the Paystack card form
// (skipping the /pay/product/[token] summary page) whenever card payment is
// available for the product. Falls back to the summary page for EFT-only
// products, or if Paystack init fails / isn't configured — so the user can still
// pick a method there. Used by the signup wizard's "Continue to payment".
export async function startProductCheckoutDirect(
  slug: string,
  email: string,
  origin?: string | null,
  signupReturn?: boolean,
): Promise<CreateOrderResult> {
  const order = await startProductPurchaseBySlug(slug, email, origin);
  if (!order.ok) return order;

  // Card available = product offers Paystack AND the platform has it enabled.
  const admin = createAdminClient();
  const [{ data: product }, { data: settings }] = await Promise.all([
    admin
      .from("products")
      .select("payment_methods")
      .eq("slug", slug)
      .maybeSingle(),
    admin
      .from("platform_payment_settings")
      .select("paystack_enabled")
      .eq("id", true)
      .maybeSingle(),
  ]);
  const methods: string[] = Array.isArray(product?.payment_methods)
    ? (product!.payment_methods as string[])
    : ["paystack"];
  const cardAvailable =
    methods.includes("paystack") && !!settings?.paystack_enabled;

  if (cardAvailable) {
    const pay = await startProductPaystack(order.token, origin, signupReturn);
    if (pay.ok) {
      return { ok: true, token: order.token, url: pay.authorizationUrl };
    }
    // Init failed — fall through to the summary page (still lets them retry/EFT).
  }
  return order;
}

export type PurchaseResult =
  | { ok: true; url: string; free: boolean }
  | { ok: false; error: string };

/**
 * Public self-serve entry that branches on price: a FREE product provisions the
 * buyer + returns an auto-sign-in magic link; a paid product creates an order +
 * pay-link (the existing flow). The standalone product page (/p/[slug]) calls this.
 */
export async function purchaseProductBySlug(
  slug: string,
  email: string,
  origin: string,
): Promise<PurchaseResult> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, price, is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (!product || !product.is_active) {
    return { ok: false, error: "This product isn't available." };
  }
  if (Number(product.price) === 0) {
    const r = await fulfilFreeProductBySlug(slug, email, origin);
    return r.ok ? { ok: true, url: r.loginUrl, free: true } : r;
  }
  const r = await createProductOrder(
    { productId: product.id, email, createdBy: null },
    origin,
  );
  return r.ok ? { ok: true, url: r.url, free: false } : r;
}

export type FreeFulfilResult =
  | { ok: true; loginUrl: string }
  | { ok: false; error: string };

/**
 * Free product (price 0): provision the buyer instead of charging. Creates a
 * passwordless account + a host (beta features are host-scoped) if needed, grants
 * the product's plan/features (via the subscription's product_id), records an R0
 * order for the books, and returns a magic-link URL that signs them in and lands
 * on the dashboard. Idempotent for an existing account (re-grants, re-issues link).
 */
export async function fulfilFreeProductBySlug(
  slug: string,
  email: string,
  origin: string,
): Promise<FreeFulfilResult> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, name, price, currency, is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (!product || !product.is_active) {
    return { ok: false, error: "This product isn't available." };
  }
  if (Number(product.price) !== 0) {
    return { ok: false, error: "This product isn't free." };
  }

  const cleanEmail = email.trim().toLowerCase();
  const name = cleanEmail.split("@")[0] || "Host";

  // 1) Account — passwordless lead if new (mints a Wielo identity + user_profile).
  const identity = await findOrCreateLeadIdentity(admin, {
    email: cleanEmail,
    name,
  });
  if (!identity) {
    return { ok: false, error: "Couldn't create your account. Try again." };
  }
  const userId = identity.guestId;

  // 2) Ensure a host record (features resolve through a host-scoped subscription).
  const { data: existingHost } = await admin
    .from("hosts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!existingHost) {
    const base = slugify(name) || "host";
    const { data: taken } = await admin
      .from("hosts")
      .select("handle")
      .ilike("handle", `${base}%`);
    const handles = new Set(
      (taken ?? []).map((h) => (h as { handle: string }).handle),
    );
    const { error: hErr } = await admin.from("hosts").insert({
      user_id: userId,
      handle: uniqueSlug(base, handles),
      display_name: name,
    });
    if (hErr) {
      return { ok: false, error: "Couldn't set up your host account." };
    }
    await admin
      .from("user_profiles")
      .update({ role: "host", is_lead: false })
      .eq("id", userId);
    const { data: newHost } = await admin
      .from("hosts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (newHost?.id) {
      try {
        await admin.rpc("ensure_host_default_policies", {
          p_host_id: newHost.id,
        });
      } catch {
        // best-effort — a missing preset must not block beta access
      }
    }
  }

  // 3) Grant the product's plan/features (same path as a paid activation).
  await activateMappedPlan(admin, userId, product.id, new Date());

  // 4) Record an R0 order for the books (method left null — it's not a charge).
  await admin.from("product_orders").insert({
    product_id: product.id,
    product_name: product.name,
    payer_email: cleanEmail,
    payer_user_id: userId,
    amount: 0,
    currency: product.currency,
    status: "paid",
    paid_at: new Date().toISOString(),
    pay_token: token(),
    created_by: null,
  });

  // 5) Magic link → auto sign-in → dashboard (no password needed).
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: cleanEmail,
    options: { redirectTo: `${origin}/auth/confirm?next=/dashboard` },
  });
  const hashed = link?.properties?.hashed_token;
  if (linkErr || !hashed) {
    // Account is provisioned; they just need to sign in manually.
    return { ok: false, error: "You're set up — please sign in to continue." };
  }
  const loginUrl = `${origin}/auth/confirm?token_hash=${hashed}&type=magiclink&next=/dashboard`;
  return { ok: true, loginUrl };
}

export type PaystackStartResult =
  | { ok: true; authorizationUrl: string }
  | { ok: false; error: string };

// Test vs live is derived from the active Paystack secret key prefix, so test-key
// purchases are tagged and kept out of live KPIs (see migration 20260616000020).
function envFromSecret(secret: string): "test" | "live" {
  return secret.startsWith("sk_live_") ? "live" : "test";
}

// Initialise a Paystack transaction for an order (platform key). Called from the
// public pay page. Also seeds a PENDING platform_ledger row keyed by the
// reference (idempotency anchor) — mirrors startSubscriptionCheckout — so the
// confirm-on-return path and the webhook can both flip it to completed.
export async function startProductPaystack(
  payToken: string,
  origin?: string | null,
  // When true, Paystack returns to the signup wizard (which renders its own
  // Welcome/receipt step) instead of the standalone /pay/product thank-you page.
  signupReturn?: boolean,
): Promise<PaystackStartResult> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("product_orders")
    .select(
      "id, product_id, payer_email, payer_user_id, amount, currency, status, pay_token",
    )
    .eq("pay_token", payToken)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "paid") return { ok: false, error: "Already paid." };

  const secret = await getPlatformPaystackSecret();
  if (!secret) return { ok: false, error: "Card payments aren't configured." };

  const environment = envFromSecret(secret);
  const reference = `prod_${order.id}_${Date.now()}`;
  const siteUrl = resolveSiteBase(origin);
  const callbackPath = signupReturn
    ? `/signup/host?paid_token=${payToken}`
    : `/pay/product/${payToken}`;
  try {
    const res = await initializeTransaction({
      amount: Number(order.amount),
      currency: order.currency,
      email: order.payer_email,
      callbackUrl: `${siteUrl}${callbackPath}`,
      reference,
      metadata: {
        purpose: "product",
        order_id: order.id,
        product_id: order.product_id,
      },
      secretKey: secret,
    });
    await admin
      .from("product_orders")
      .update({
        provider_reference: reference,
        method: "paystack",
        environment,
      })
      .eq("id", order.id);

    // Pending revenue row (idempotency anchor for the confirm/webhook flip).
    await admin.from("platform_ledger").insert({
      user_id: order.payer_user_id,
      product_id: order.product_id,
      type: "charge",
      status: "pending",
      amount: Number(order.amount),
      currency: order.currency,
      provider: "paystack",
      provider_reference: reference,
      environment,
      reason: "Product purchase",
    });
    return { ok: true, authorizationUrl: res.authorization_url };
  } catch (e) {
    // Roll back the pending row so a failed init doesn't leave noise.
    await admin
      .from("platform_ledger")
      .delete()
      .eq("provider_reference", reference);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't start checkout.",
    };
  }
}

export type PayPalStartResult =
  | { ok: true; approveUrl: string }
  | { ok: false; error: string };

// Start a PayPal checkout for a Wielo product order on Wielo's OWN PayPal app.
// Mirrors startProductPaystack (same pending-ledger anchor keyed by
// provider_reference = the PayPal order id), but PayPal is the international
// rail: the order is created in USD (converted from the ZAR amount), while the
// order + ledger stay in ZAR. The order is captured when the payer returns to
// /pay/product/[token]?token=<orderId> (see capturePayPalProductOrder).
export async function startProductPayPal(
  payToken: string,
  origin?: string | null,
): Promise<PayPalStartResult> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("product_orders")
    .select(
      "id, product_id, payer_user_id, amount, currency, status, pay_token",
    )
    .eq("pay_token", payToken)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "paid") return { ok: false, error: "Already paid." };

  const creds = await getPlatformPayPal();
  if (!creds) return { ok: false, error: "PayPal isn't configured." };

  const siteUrl = resolveSiteBase(origin);
  const returnPath = `/pay/product/${payToken}`;
  try {
    const usd = await convertZarToUsd(Number(order.amount));
    if (!(usd > 0)) throw new Error("Could not convert the amount to USD.");
    const paypalOrder = await createPayPalOrder({
      amount: usd,
      currency: "USD",
      description: `Wielo · ${order.id.slice(0, 8)}`,
      returnUrl: `${siteUrl}${returnPath}`,
      cancelUrl: `${siteUrl}${returnPath}?paypal=cancel`,
      creds,
    });
    if (!paypalOrder) throw new Error("PayPal order creation failed.");

    await admin
      .from("product_orders")
      .update({
        provider_reference: paypalOrder.orderId,
        method: "paypal",
        environment: creds.env,
      })
      .eq("id", order.id);

    // Pending revenue row (idempotency anchor for the capture flip). Kept in ZAR
    // for a consistent ledger; the USD amount lives on the PayPal order.
    await admin.from("platform_ledger").insert({
      user_id: order.payer_user_id,
      product_id: order.product_id,
      type: "charge",
      status: "pending",
      amount: Number(order.amount),
      currency: order.currency,
      provider: "paypal",
      provider_reference: paypalOrder.orderId,
      environment: creds.env,
      reason: "Product purchase",
    });
    return { ok: true, approveUrl: paypalOrder.approveUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't start PayPal checkout.",
    };
  }
}

function addMonths(d: Date, n: number): string {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString();
}

// Activate the buyer's subscription when the purchased product is any
// subscription product (not just the seeded plan-mapped ones). The PRODUCT is
// authoritative for gating/scopes — we record it on subscriptions.product_id so
// check_feature_permission resolves the buyer's features from product_features.
// `plan` is kept valid (FK to plans.key) for legacy reads: derived from the
// product's slug when that slug is a real plan key, otherwise the host's current
// plan is preserved (or 'free' for a brand-new subscription). Mirrors the
// webhook's processProductEvent and the admin setUserProductAction so all three
// paths behave identically. No-op for one-off products.
async function activateMappedPlan(
  admin: ReturnType<typeof createAdminClient>,
  payerUserId: string | null,
  productId: string | null,
  now: Date,
): Promise<void> {
  if (!payerUserId || !productId) return;
  const { data: product } = await admin
    .from("products")
    .select("type, slug, billing_cycle, plan_key")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.type !== "subscription") return;

  const { data: host } = await admin
    .from("hosts")
    .select("id")
    .eq("user_id", payerUserId)
    .maybeSingle();
  if (!host) return;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, plan")
    .eq("host_id", host.id)
    .maybeSingle();

  // Keep `plan` a valid plans.key: prefer the product's explicit plan_key (the
  // feature tier it grants), else fall back to its slug when that's a plan key,
  // else preserve the current plan (or default to 'free').
  let plan = sub?.plan ?? "free";
  const desiredKey = product.plan_key ?? product.slug;
  if (desiredKey) {
    const { data: planRow } = await admin
      .from("plans")
      .select("key")
      .eq("key", desiredKey)
      .maybeSingle();
    if (planRow) plan = planRow.key;
  }

  const cycle = product.billing_cycle === "annual" ? "annual" : "monthly";
  const periodEnd = addMonths(now, cycle === "annual" ? 12 : 1);
  const patch = {
    product_id: productId,
    plan,
    billing_cycle: cycle,
    status: "active" as const,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd,
  };
  if (sub) {
    await admin.from("subscriptions").update(patch).eq("id", sub.id);
  } else {
    await admin.from("subscriptions").insert({ host_id: host.id, ...patch });
  }
}

export type ConfirmProductResult =
  | { ok: true; status: "paid"; payToken: string; alreadyPaid: boolean }
  | { ok: false; error: string };

// Settle a product order from the public pay page on return from Paystack
// (?reference=…). This is the PRIMARY settle path (the webhook is an idempotent
// backstop), mirroring the booking confirmHostCardPaymentByReference: verify the
// transaction server-side with the platform key, then flip the order + the
// pending platform_ledger row to completed and activate any mapped plan.
// Idempotent: a second call (or the webhook) no-ops once the order is paid.
export async function confirmProductOrderByReference(
  reference: string,
): Promise<ConfirmProductResult> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("product_orders")
    .select(
      "id, product_id, payer_user_id, amount, currency, status, pay_token, environment",
    )
    .eq("provider_reference", reference)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "paid") {
    return {
      ok: true,
      status: "paid",
      payToken: order.pay_token,
      alreadyPaid: true,
    };
  }

  const secret = await getPlatformPaystackSecret();
  if (!secret) return { ok: false, error: "Card payments aren't configured." };

  const verified = await verifyTransaction(reference, secret);
  if (!verified || verified.status !== "success") {
    return { ok: false, error: "Payment not confirmed yet." };
  }

  const environment = order.environment ?? envFromSecret(secret);
  const now = new Date();
  const nowIso = now.toISOString();

  await admin
    .from("product_orders")
    .update({
      status: "paid",
      paid_at: nowIso,
      method: "paystack",
      environment,
    })
    .eq("id", order.id);

  // Flip the pending revenue row to completed (or insert if it's missing —
  // e.g. an EFT-seeded order that never got a pending row).
  const { data: led } = await admin
    .from("platform_ledger")
    .select("id, status")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (led) {
    if (led.status !== "completed") {
      await admin
        .from("platform_ledger")
        .update({ status: "completed", paid_at: nowIso, environment })
        .eq("id", led.id);
    }
  } else {
    await admin.from("platform_ledger").insert({
      user_id: order.payer_user_id,
      product_id: order.product_id,
      type: "charge",
      status: "completed",
      amount: Number(order.amount),
      currency: order.currency,
      provider: "paystack",
      provider_reference: reference,
      environment,
      paid_at: nowIso,
      reason: "Product purchase",
    });
  }

  // Accrue affiliate commission if the payer was referred (idempotent RPC).
  try {
    const { data: row } = await admin
      .from("platform_ledger")
      .select("id")
      .eq("provider_reference", reference)
      .maybeSingle();
    if (row?.id) {
      await admin.rpc("accrue_affiliate_commission", { p_ledger_id: row.id });
    }
  } catch {
    // Commission accrual must never break settlement.
  }

  await activateMappedPlan(admin, order.payer_user_id, order.product_id, now);

  return {
    ok: true,
    status: "paid",
    payToken: order.pay_token,
    alreadyPaid: false,
  };
}

// Settle a product order from the public pay page on return from PayPal
// (?token=<orderId>). The PayPal sibling of confirmProductOrderByReference:
// capture the approved order on Wielo's OWN PayPal app, then flip the order +
// the pending platform_ledger row to completed (invoice mints via trigger),
// accrue affiliate commission, and activate any mapped plan. Idempotent: a
// second call (order already paid) no-ops.
export async function capturePayPalProductOrder(
  orderId: string,
): Promise<ConfirmProductResult> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("product_orders")
    .select(
      "id, product_id, payer_user_id, amount, currency, status, pay_token, environment",
    )
    .eq("provider_reference", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "paid") {
    return {
      ok: true,
      status: "paid",
      payToken: order.pay_token,
      alreadyPaid: true,
    };
  }

  const creds = await getPlatformPayPal();
  if (!creds) return { ok: false, error: "PayPal isn't configured." };

  const cap = await capturePayPalOrder(orderId, creds);
  if (!cap || cap.status !== "COMPLETED") {
    return { ok: false, error: "Payment not confirmed yet." };
  }

  const environment = order.environment ?? creds.env;
  const now = new Date();
  const nowIso = now.toISOString();

  await admin
    .from("product_orders")
    .update({
      status: "paid",
      paid_at: nowIso,
      method: "paypal",
      environment,
    })
    .eq("id", order.id);

  // Flip the pending revenue row to completed (or insert if it's missing).
  const { data: led } = await admin
    .from("platform_ledger")
    .select("id, status")
    .eq("provider_reference", orderId)
    .maybeSingle();
  if (led) {
    if (led.status !== "completed") {
      await admin
        .from("platform_ledger")
        .update({ status: "completed", paid_at: nowIso, environment })
        .eq("id", led.id);
    }
  } else {
    await admin.from("platform_ledger").insert({
      user_id: order.payer_user_id,
      product_id: order.product_id,
      type: "charge",
      status: "completed",
      amount: Number(order.amount),
      currency: order.currency,
      provider: "paypal",
      provider_reference: orderId,
      environment,
      paid_at: nowIso,
      reason: "Product purchase",
    });
  }

  // Accrue affiliate commission if the payer was referred (idempotent RPC).
  try {
    const { data: row } = await admin
      .from("platform_ledger")
      .select("id")
      .eq("provider_reference", orderId)
      .maybeSingle();
    if (row?.id) {
      await admin.rpc("accrue_affiliate_commission", { p_ledger_id: row.id });
    }
  } catch {
    // Commission accrual must never break settlement.
  }

  await activateMappedPlan(admin, order.payer_user_id, order.product_id, now);

  return {
    ok: true,
    status: "paid",
    payToken: order.pay_token,
    alreadyPaid: false,
  };
}
