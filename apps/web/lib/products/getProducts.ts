import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Read model for the public product catalog (pricing page + signup). Reads the
// DB `products` table — the single source of truth the admin Products hub edits.
// Read FRESH on every call (no cache) so every surface always mirrors exactly
// what's active + visible in admin, even when the catalog is changed directly
// in the DB (a cached read went stale in that case and showed retired tiers).

// Retained so admin mutations can keep calling revalidateTag() harmlessly; no
// cache is attached to it anymore.
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
  /** membership | service (both subscription-like). */
  productType: string;
  /** Feature tier this product grants (plans.key); falls back to slug. */
  planKey: string | null;
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
      "id, name, description, product_type, price, currency, billing_cycle, trial_days, slug, plan_key, setup_fee, setup_fee_label, is_recommended, is_active, is_visible, bullets, payment_methods",
    )
    .in("product_type", ["membership", "service"])
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
    productType: p.product_type ?? "membership",
    planKey: p.plan_key ?? p.slug ?? null,
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

// Visible, active subscription products for the pricing page + signup. Uncached
// — always reflects the live `products` table.
export function getSubscriptionProducts(): Promise<CatalogProduct[]> {
  return load();
}

export type SellableProduct = {
  id: string;
  name: string;
  price: number;
  currency: string;
  /** membership | service | product. */
  productType: string;
  /** Feature tier this product grants (plans.key), for matching legacy plan-keyed
   * ledger rows to their product. Null for once-off products. */
  planKey: string | null;
};

// Every product that admin can SELL internally (e.g. send as a pay link on the
// Wielo ledger): active, ANY product_type (membership + service + product), and
// IGNORING is_visible — visibility only gates the PUBLIC pricing page, not
// internal selling. Uncached, mirrors the live catalog.
export async function getSellableProducts(): Promise<SellableProduct[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("products")
    .select(
      "id, name, price, currency, product_type, plan_key, slug, sort_order",
    )
    .eq("is_active", true)
    .order("product_type", { ascending: true })
    .order("sort_order", { ascending: true });

  return (data ?? []).map((p) => {
    const productType = p.product_type ?? "membership";
    return {
      id: p.id,
      name: p.name,
      price: Number(p.price ?? 0),
      currency: p.currency ?? "ZAR",
      productType,
      planKey:
        productType !== "product" ? (p.plan_key ?? p.slug ?? null) : null,
    };
  });
}
