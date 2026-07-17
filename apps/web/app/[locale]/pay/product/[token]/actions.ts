"use server";

import { headers } from "next/headers";

import { revalidatePath } from "next/cache";

import {
  applyPromoToOrder,
  capturePayPalProductOrder,
  claimProductAccount,
  recordProductEftIntent,
  removePromoFromOrder,
  startProductPaystack,
  startProductPayPal,
} from "@/lib/billing/product-checkout";

// Public (token-gated) — start Paystack checkout for a product order. Returns
// the hosted URL (fallback) plus the inline access code + reference so the client
// can open the Paystack popup instead of a full redirect to checkout.paystack.com.
export async function startProductPaystackAction(
  token: string,
): Promise<
  | { ok: true; url: string; accessCode?: string; reference?: string }
  | { ok: false; error: string }
> {
  // Request origin → absolute Paystack callback_url (see product-checkout.ts).
  const origin = headers().get("origin");
  const r = await startProductPaystack(token, origin);
  return r.ok
    ? {
        ok: true,
        url: r.authorizationUrl,
        accessCode: r.accessCode,
        reference: r.reference,
      }
    : { ok: false, error: r.error };
}

// Public (token-gated) — CREATE a PayPal order (Wielo's platform PayPal). Used as
// the JS SDK Smart Buttons `createOrder` callback (returns the PayPal order id so
// approval opens in a popup, not a top-level redirect to www.paypal.com), and it
// also returns the approval URL as a redirect fallback.
export async function startProductPayPalAction(
  token: string,
): Promise<
  { ok: true; url: string; orderId: string } | { ok: false; error: string }
> {
  const origin = headers().get("origin");
  const r = await startProductPayPal(token, origin);
  return r.ok
    ? { ok: true, url: r.approveUrl, orderId: r.orderId }
    : { ok: false, error: r.error };
}

// Public — CAPTURE an approved PayPal order (the SDK `onApprove` callback). On
// success the client reloads the pay page into its paid/receipt state.
export async function capturePayPalProductAction(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await capturePayPalProductOrder(orderId);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// Public — the buyer clicked "Pay with EFT": assign/create the user, post a
// pending ledger charge, then the client reveals the bank details.
export async function recordProductEftAction(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return recordProductEftIntent(token);
}

// Public (token-gated) — apply a Wielo promo code to this pending order. The
// discount is computed and stored server-side (the client never sends a price),
// so every rail that follows — Paystack, PayPal, EFT — bills the reduced amount
// straight off the order row without knowing a code was involved.
export async function applyPromoCodeAction(
  token: string,
  code: string,
): Promise<
  | { ok: true; code: string; label: string; discount: number; total: number }
  | { ok: false; error: string }
> {
  const r = await applyPromoToOrder(token, code);
  if (r.ok) revalidatePath(`/pay/product/${token}`);
  return r;
}

// Public (token-gated) — drop the code and restore the full price.
export async function removePromoCodeAction(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await removePromoFromOrder(token);
  if (r.ok) revalidatePath(`/pay/product/${token}`);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// Public (token-gated) — a new buyer sets a password on the thank-you page. We
// claim their passwordless account, provision their host, grant the order's
// credits / activate its plan, and return a magic-link the client follows into
// the dashboard.
export async function claimProductAccountAction(
  token: string,
  password: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const origin = headers().get("origin") ?? "";
  const r = await claimProductAccount(token, password, origin);
  return r.ok ? { ok: true, url: r.loginUrl } : { ok: false, error: r.error };
}
