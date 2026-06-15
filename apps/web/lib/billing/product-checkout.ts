import "server-only";

import { getPlatformPaystackSecret } from "@/lib/billing/platform-billing";
import { initializeTransaction } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";

// Vilo product checkout — mirrors the host booking pay-link, but for Vilo's own
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

export type CreateOrderResult =
  | { ok: true; token: string; url: string }
  | { ok: false; error: string };

// Create a pending order for a product + a pay-link to send the user.
export async function createProductOrder(input: {
  productId: string;
  email: string;
  createdBy: string;
}): Promise<CreateOrderResult> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, name, price, currency, is_active")
    .eq("id", input.productId)
    .maybeSingle();
  if (!product || !product.is_active) {
    return { ok: false, error: "Product not found or inactive." };
  }

  // Link to an existing Vilo account if the email matches one.
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return {
    ok: true,
    token: payToken,
    url: `${siteUrl}/pay/product/${payToken}`,
  };
}

export type PaystackStartResult =
  | { ok: true; authorizationUrl: string }
  | { ok: false; error: string };

// Initialise a Paystack transaction for an order (platform key). Called from the
// public pay page.
export async function startProductPaystack(
  payToken: string,
): Promise<PaystackStartResult> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("product_orders")
    .select("id, product_id, payer_email, amount, currency, status, pay_token")
    .eq("pay_token", payToken)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "paid") return { ok: false, error: "Already paid." };

  const secret = await getPlatformPaystackSecret();
  if (!secret) return { ok: false, error: "Card payments aren't configured." };

  const reference = `prod_${order.id}_${Date.now()}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  try {
    const res = await initializeTransaction({
      amount: Number(order.amount),
      currency: order.currency,
      email: order.payer_email,
      callbackUrl: `${siteUrl}/pay/product/${payToken}`,
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
      .update({ provider_reference: reference, method: "paystack" })
      .eq("id", order.id);
    return { ok: true, authorizationUrl: res.authorization_url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't start checkout.",
    };
  }
}
