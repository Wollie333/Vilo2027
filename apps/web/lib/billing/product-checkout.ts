import "server-only";

import { accrueAffiliateAndNotify } from "@/lib/affiliate/notify";
import { getPlatformPaystackSecret } from "@/lib/billing/platform-billing";
import {
  grantCreditsForOrder,
  grantSubscriptionCredits,
} from "@/lib/credits/wallet";
import { findOrCreateLeadIdentity } from "@/lib/enquiry/lead-identity";
import { convertZarToUsd } from "@/lib/fx";
import { slugify, uniqueSlug } from "@/lib/help/slug";
import { createPayPalOrder, capturePayPalOrder } from "@/lib/paypal";
import { getPlatformPayPal } from "@/lib/payments/platform-paypal";
import { initializeTransaction, verifyTransaction } from "@/lib/paystack";
import { notifyAdmins } from "@/lib/admin/notify";
import { setPayCardStatus } from "@/lib/inbox/platform-thread";
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
    // Optional buyer details captured at checkout — stored on the (guest) user.
    name?: string | null;
    phone?: string | null;
    // Custom-amount top-up (e.g. a pro-rated subscription UPGRADE delta): bill
    // this amount instead of the product price, label the order accordingly, and
    // set activateOnPay=false so settling does NOT re-activate the plan (the tier
    // was already activated at admin time — the link only collects the delta).
    amountOverride?: number | null;
    label?: string | null;
    activateOnPay?: boolean;
  },
  origin?: string | null,
): Promise<CreateOrderResult> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, name, price, currency, is_active, product_type, setup_fee")
    .eq("id", input.productId)
    .maybeSingle();
  if (!product || !product.is_active) {
    return { ok: false, error: "Product not found or inactive." };
  }
  const isOverride = input.amountOverride != null && input.amountOverride > 0;
  const base = isOverride
    ? Number(input.amountOverride)
    : Number(product.price);

  // Guest-first: an order ALWAYS belongs to a user — find the account by email or
  // create a guest lead — so no transaction is ever orphaned and the buyer's
  // contact is kept even if they never pay.
  const email = input.email.trim().toLowerCase();
  const lead = await findOrCreateLeadIdentity(admin, {
    email,
    name: input.name?.trim() || email.split("@")[0],
    phone: input.phone ?? null,
  });
  const payerUserId = lead?.guestId ?? null;

  // Once-off setup fee: charged with the FIRST payment of a subscription-like
  // product (membership | service) only — never on a once-off product, never on
  // a custom-amount top-up (upgrade delta), and never on a renewal/re-purchase
  // (the buyer already holds an active subscription for this product). Folded
  // into `amount` and recorded as setup_fee_amount so its commission can be
  // split off it (see accrue_affiliate_commission).
  let setupFee = 0;
  if (
    product.product_type !== "product" &&
    !isOverride &&
    Number(product.setup_fee ?? 0) > 0
  ) {
    let firstPurchase = true;
    if (payerUserId) {
      const { data: host } = await admin
        .from("hosts")
        .select("id")
        .eq("user_id", payerUserId)
        .maybeSingle();
      if (host) {
        const { count } = await admin
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("host_id", host.id)
          .eq("product_id", product.id)
          .in("status", ["trialing", "active", "past_due"]);
        firstPurchase = (count ?? 0) === 0;
      }
    }
    if (firstPurchase) setupFee = Number(product.setup_fee);
  }
  const amount = base + setupFee;

  const payToken = token();
  const { error } = await admin.from("product_orders").insert({
    product_id: product.id,
    product_name: input.label?.trim() || product.name,
    payer_email: email,
    payer_user_id: payerUserId,
    amount,
    setup_fee_amount: setupFee,
    currency: product.currency,
    status: "pending",
    pay_token: payToken,
    created_by: input.createdBy,
    activate_on_pay: input.activateOnPay ?? true,
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
  buyer?: { name?: string | null; phone?: string | null },
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
    {
      productId: product.id,
      email,
      createdBy: null,
      name: buyer?.name ?? null,
      phone: buyer?.phone ?? null,
    },
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
  | {
      ok: true;
      authorizationUrl: string;
      // For the inline popup (resumeTransaction) so the payer stays on the pay
      // page instead of a full redirect to checkout.paystack.com. The client
      // falls back to authorizationUrl if the inline script can't load.
      accessCode?: string;
      reference?: string;
    }
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
      "id, product_id, product_name, payer_email, payer_user_id, amount, setup_fee_amount, currency, status, pay_token",
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
      setup_fee_amount: Number(order.setup_fee_amount ?? 0),
      currency: order.currency,
      provider: "paystack",
      provider_reference: reference,
      environment,
      reason: "Product purchase",
    });
    // Alert staff a card payment is being taken (so nothing is missed).
    await notifyAdmins(admin, {
      category: "finance",
      kind: "payment_initiated",
      title: "Card payment initiated",
      body: `${order.product_name ?? "Product"} · ${order.currency} ${Number(
        order.amount,
      ).toFixed(2)} · ${order.payer_email ?? "guest"}`,
      userId: order.payer_user_id,
      orderId: order.id,
      href: order.payer_user_id
        ? `/admin/users/${order.payer_user_id}?tab=finance`
        : "/admin/payments",
    });
    return {
      ok: true,
      authorizationUrl: res.authorization_url,
      accessCode: res.access_code,
      reference,
    };
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
  | { ok: true; approveUrl: string; orderId: string }
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
      "id, product_id, payer_user_id, amount, setup_fee_amount, currency, status, pay_token",
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
      setup_fee_amount: Number(order.setup_fee_amount ?? 0),
      currency: order.currency,
      provider: "paypal",
      provider_reference: paypalOrder.orderId,
      environment: creds.env,
      reason: "Product purchase",
    });
    return {
      ok: true,
      approveUrl: paypalOrder.approveUrl,
      orderId: paypalOrder.orderId,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't start PayPal checkout.",
    };
  }
}

// Record an EFT payment intent for a product order: the buyer clicked "Pay with
// EFT", so we (1) ensure a user is assigned to the order — creating a guest lead
// from their email if none exists, so NO transaction is ever orphaned — and (2)
// post a PENDING charge to the Wielo ledger keyed by the order (idempotent), so
// the admin can see + manage the awaited EFT. The bank details are then revealed
// client-side. Settling happens when the admin marks it received.
export async function recordProductEftIntent(
  payToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("product_orders")
    .select(
      "id, product_id, product_name, amount, setup_fee_amount, currency, status, environment, payer_email, payer_user_id",
    )
    .eq("pay_token", payToken)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "paid") return { ok: true };

  // Assign a user — every transaction must belong to someone. Create a guest
  // lead from the payer email when the order has no user yet.
  let userId = order.payer_user_id as string | null;
  if (!userId && order.payer_email) {
    const lead = await findOrCreateLeadIdentity(admin, {
      email: order.payer_email,
      name: order.payer_email.split("@")[0],
    });
    userId = lead?.guestId ?? null;
    if (userId) {
      await admin
        .from("product_orders")
        .update({ payer_user_id: userId })
        .eq("id", order.id);
    }
  }

  const environment = order.environment ?? "test";
  const ref = `eft_${order.id}`;
  const { data: existing } = await admin
    .from("platform_ledger")
    .select("id")
    .eq("provider_reference", ref)
    .maybeSingle();
  if (!existing) {
    await admin.from("platform_ledger").insert({
      user_id: userId,
      product_id: order.product_id,
      type: "charge",
      status: "pending",
      amount: Number(order.amount),
      setup_fee_amount: Number(order.setup_fee_amount ?? 0),
      currency: order.currency,
      provider: "eft",
      provider_reference: ref,
      environment,
      reason: "Product purchase (EFT)",
    });
    // Alert staff: an EFT is now awaited and must be settled manually. Only on
    // first creation so repeated "show bank details" clicks don't spam the feed.
    await notifyAdmins(admin, {
      category: "finance",
      kind: "eft_pending",
      title: "Pending EFT payment",
      body: `${order.product_name ?? "Product"} · ${order.currency} ${Number(
        order.amount,
      ).toFixed(2)} · ${order.payer_email ?? "guest"}`,
      userId,
      orderId: order.id,
      href: userId ? `/admin/users/${userId}?tab=finance` : "/admin/payments",
    });
    // Reflect it back to the buyer: their inbox pay card → "pending payment".
    await setPayCardStatus(admin, {
      userId,
      payToken,
      status: "pending",
    });
  }
  await admin
    .from("product_orders")
    .update({ method: "eft", environment })
    .eq("id", order.id);
  return { ok: true };
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
    .select("product_type, slug, billing_cycle, plan_key")
    .eq("id", productId)
    .maybeSingle();
  // Only subscription-like products (membership | service) become subscriptions;
  // once-off products + credit packages live in product_orders only (credits are
  // granted separately by grantCreditsForOrder).
  if (
    !product ||
    product.product_type === "product" ||
    product.product_type === "wielo_credits"
  ) {
    return;
  }
  const isMembership = product.product_type === "membership";

  const { data: host } = await admin
    .from("hosts")
    .select("id")
    .eq("user_id", payerUserId)
    .maybeSingle();
  if (!host) return;

  // Multi-subscription: find THIS product's subscription (renew it) rather than
  // the host's single sub. A host can hold one membership + many services.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, plan")
    .eq("host_id", host.id)
    .eq("product_id", productId)
    .maybeSingle();

  // Keep `plan` a valid plans.key: prefer the product's explicit plan_key (the
  // feature tier it grants), else its slug when that's a plan key, else preserve.
  let plan = existing?.plan ?? "free";
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

  // A host may hold only one active membership — retire any OTHER active
  // membership before activating this one, whether we're reactivating an
  // existing (possibly cancelled) row or inserting a new one (else the DB
  // trigger rejects the write). The ledger credit/refund on a paid downgrade is
  // handled by the admin manage flow, not the settle path.
  if (isMembership) {
    const { data: active } = await admin
      .from("subscriptions")
      .select("id, product_id")
      .eq("host_id", host.id)
      .in("status", ["trialing", "active", "past_due"]);
    const others = (active ?? []).filter(
      (s) => s.product_id && s.product_id !== productId,
    );
    const pids = others
      .map((s) => s.product_id)
      .filter((x): x is string => !!x);
    if (pids.length) {
      const { data: memProds } = await admin
        .from("products")
        .select("id")
        .in("id", pids)
        .eq("product_type", "membership");
      const memIds = new Set((memProds ?? []).map((p) => p.id));
      const retire = others
        .filter((s) => s.product_id && memIds.has(s.product_id))
        .map((s) => s.id);
      if (retire.length) {
        await admin
          .from("subscriptions")
          .update({ status: "cancelled", updated_at: now.toISOString() })
          .in("id", retire);
      }
    }
  }

  if (existing) {
    await admin.from("subscriptions").update(patch).eq("id", existing.id);
  } else {
    await admin.from("subscriptions").insert({ host_id: host.id, ...patch });
  }

  // Grant this plan's recurring credit allotment for the new period (idempotent
  // per product+period, so activation + each renewal tops up exactly once).
  await grantSubscriptionCredits(admin, {
    hostId: host.id,
    productId,
    periodStart: patch.current_period_start,
  });
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
      "id, product_id, payer_user_id, amount, setup_fee_amount, currency, status, pay_token, environment, activate_on_pay",
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
      setup_fee_amount: Number(order.setup_fee_amount ?? 0),
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
      await accrueAffiliateAndNotify(admin, row.id);
    }
  } catch {
    // Commission accrual must never break settlement.
  }

  // A custom-amount top-up order (e.g. a pro-rated upgrade delta) only collects
  // money — the plan was activated at admin time, so don't re-activate it here.
  if (order.activate_on_pay !== false) {
    await activateMappedPlan(admin, order.payer_user_id, order.product_id, now);
  }

  // Credit-package order → top up the buyer's Wielo Credits wallet (idempotent).
  await grantCreditsForOrder(admin, order);

  // Reflect it back to the buyer: their inbox pay card → "payment received".
  await setPayCardStatus(admin, {
    userId: order.payer_user_id,
    payToken: order.pay_token,
    status: "received",
  });

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
      "id, product_id, payer_user_id, amount, setup_fee_amount, currency, status, pay_token, environment, activate_on_pay",
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
      setup_fee_amount: Number(order.setup_fee_amount ?? 0),
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
      await accrueAffiliateAndNotify(admin, row.id);
    }
  } catch {
    // Commission accrual must never break settlement.
  }

  // Custom-amount top-up (upgrade delta) → collect only; don't re-activate.
  if (order.activate_on_pay !== false) {
    await activateMappedPlan(admin, order.payer_user_id, order.product_id, now);
  }

  // Credit-package order → top up the buyer's Wielo Credits wallet (idempotent).
  await grantCreditsForOrder(admin, order);

  // Reflect it back to the buyer: their inbox pay card → "payment received".
  await setPayCardStatus(admin, {
    userId: order.payer_user_id,
    payToken: order.pay_token,
    status: "received",
  });

  return {
    ok: true,
    status: "paid",
    payToken: order.pay_token,
    alreadyPaid: false,
  };
}
