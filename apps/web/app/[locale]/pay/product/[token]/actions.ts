"use server";

import { headers } from "next/headers";

import { startProductPaystack } from "@/lib/billing/product-checkout";

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
