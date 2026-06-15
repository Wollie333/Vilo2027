"use server";

import { startProductPurchaseBySlug } from "@/lib/billing/product-checkout";

// Public self-serve purchase from a product's standalone page.
export async function buyProductAction(
  slug: string,
  email: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  const r = await startProductPurchaseBySlug(slug, email.trim().toLowerCase());
  return r.ok ? { ok: true, url: r.url } : { ok: false, error: r.error };
}
