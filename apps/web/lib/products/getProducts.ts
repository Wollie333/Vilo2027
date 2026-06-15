import "server-only";

import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

// Read model for the public product catalog (pricing page + signup). Reads the
// DB `products` table — the single source of truth the admin Products hub edits.
// Cached under the "products" tag; call revalidateTag("products") after edits.

export const PRODUCTS_CACHE_TAG = "products";

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingCycle: string | null;
  trialDays: number;
  slug: string | null;
  setupFee: number;
  setupFeeLabel: string | null;
  isRecommended: boolean;
  isFree: boolean;
  bullets: string[];
  paymentMethods: string[];
};

function toBullets(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((b): b is string => typeof b === "string")
    : [];
}

async function load(): Promise<CatalogProduct[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("products")
    .select(
      "id, name, description, type, price, currency, billing_cycle, trial_days, slug, setup_fee, setup_fee_label, is_recommended, is_active, is_visible, bullets, payment_methods",
    )
    .eq("type", "subscription")
    .eq("is_active", true)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    price: Number(p.price ?? 0),
    currency: p.currency ?? "ZAR",
    billingCycle: p.billing_cycle ?? "monthly",
    trialDays: p.trial_days ?? 0,
    slug: p.slug ?? null,
    setupFee: Number(p.setup_fee ?? 0),
    setupFeeLabel: p.setup_fee_label ?? null,
    isRecommended: p.is_recommended ?? false,
    isFree: Number(p.price ?? 0) <= 0,
    bullets: toBullets(p.bullets),
    paymentMethods: Array.isArray(p.payment_methods)
      ? (p.payment_methods as string[])
      : ["paystack"],
  }));
}

// Visible, active subscription products for the pricing page + signup.
export const getSubscriptionProducts = unstable_cache(
  load,
  ["subscription-products"],
  {
    tags: [PRODUCTS_CACHE_TAG],
  },
);
