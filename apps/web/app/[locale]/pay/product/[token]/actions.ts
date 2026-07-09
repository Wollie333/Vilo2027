"use server";

import { headers } from "next/headers";

import {
  startProductPaystack,
  startProductPayPal,
} from "@/lib/billing/product-checkout";

// Public (token-gated) — start Paystack checkout for a product order.
export async function startProductPaystackAction(
  token: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  // Request origin → absolute Paystack callback_url (see product-checkout.ts).
  const origin = headers().get("origin");
  const r = await startProductPaystack(token, origin);
  return r.ok
    ? { ok: true, url: r.authorizationUrl }
    : { ok: false, error: r.error };
}

// Public (token-gated) — start PayPal checkout (Wielo's platform PayPal). Returns
// the approval URL to hand the payer off to; capture happens on their return to
// /pay/product/[token]?token=<orderId>.
export async function startProductPayPalAction(
  token: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const origin = headers().get("origin");
  const r = await startProductPayPal(token, origin);
  return r.ok ? { ok: true, url: r.approveUrl } : { ok: false, error: r.error };
}
