"use server";

import { startProductPaystack } from "@/lib/billing/product-checkout";

// Public (token-gated) — start Paystack checkout for a product order.
export async function startProductPaystackAction(
  token: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const r = await startProductPaystack(token);
  return r.ok
    ? { ok: true, url: r.authorizationUrl }
    : { ok: false, error: r.error };
}
