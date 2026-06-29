"use server";

import { headers } from "next/headers";

import { purchaseProductBySlug } from "@/lib/billing/product-checkout";

// Public self-serve purchase from a product's standalone page. Free products
// provision the buyer + return an auto-sign-in link; paid products return a
// pay-link. `free` lets the UI show the right progress copy.
export async function buyProductAction(
  slug: string,
  email: string,
): Promise<
  { ok: true; url: string; free: boolean } | { ok: false; error: string }
> {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  const origin = headers().get("origin") ?? "";
  const r = await purchaseProductBySlug(
    slug,
    email.trim().toLowerCase(),
    origin,
  );
  return r.ok
    ? { ok: true, url: r.url, free: r.free }
    : { ok: false, error: r.error };
}
