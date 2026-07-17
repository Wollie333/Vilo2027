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
  /** Once-a-year total when annual billing is offered; null = monthly only. */
  annualPrice: number | null;
  currency: string;
  billingCycle: string | null;
  /** Which signup this plan belongs to: 'host' (default) or 'quote_only'. */
  accountKind: "host" | "quote_only";
  trialDays: number;
  slug: string | null;
  /** membership | service | product | wielo_credits. */
  productType: string;
  /** Feature tier this product grants (plans.key); falls back to slug. */
  planKey: string | null;
  setupFee: number;
  setupFeeLabel: string | null;
  isRecommended: boolean;
  isFree: boolean;
  bullets: string[];
  paymentMethods: string[];
  /** For a wielo_credits package: how many credits it grants + the wallet. */
  creditQuantity: number | null;
  creditPurpose: string | null;
  /** Optional hard cap on total units sold (NULL = unlimited). */
  maxQuantity: number | null;
  /** Units sold so far (only computed for capped products; 0 otherwise). */
  unitsSold: number;
  /** True once a capped product has hit its limit — lock the buy/signup CTA. */
  soldOut: boolean;
  /** Slots left for a capped product; null when uncapped. */
  remaining: number | null;
};

function toBullets(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((b): b is string => typeof b === "string")
    : [];
}

async function load(
  types: string[] = ["membership", "service"],
  visibleOnly = true,
  accountKind?: "host" | "quote_only",
): Promise<CatalogProduct[]> {
  const db = createAdminClient();
  let q = db
    .from("products")
    .select(
      "id, name, description, product_type, price, annual_price, currency, billing_cycle, trial_days, slug, plan_key, setup_fee, setup_fee_label, is_recommended, is_active, is_visible, bullets, payment_methods, credit_quantity, credit_purpose, max_quantity, account_kind",
    )
    .in("product_type", types)
    .eq("is_active", true);
  if (visibleOnly) q = q.eq("is_visible", true);
  // Each signup shows only its own plans (host vs quote-only).
  if (accountKind) q = q.eq("account_kind", accountKind);
  const { data } = await q.order("sort_order", { ascending: true });

  // Compute units-sold ONLY for capped products (usually 0–2) so uncapped
  // catalogs stay a single query. One authoritative counter (product_units_sold).
  const soldByProduct = new Map<string, number>();
  const capped = (data ?? []).filter((p) => p.max_quantity != null);
  await Promise.all(
    capped.map(async (p) => {
      const { data: sold } = await db.rpc("product_units_sold", {
        p_product_id: p.id,
      });
      soldByProduct.set(p.id, Number(sold ?? 0));
    }),
  );

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    price: Number(p.price ?? 0),
    annualPrice: p.annual_price != null ? Number(p.annual_price) : null,
    currency: p.currency ?? "ZAR",
    billingCycle: p.billing_cycle ?? "monthly",
    accountKind: (p.account_kind as "host" | "quote_only" | null) ?? "host",
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
    creditQuantity:
      p.credit_quantity != null ? Number(p.credit_quantity) : null,
    creditPurpose: (p.credit_purpose as string | null) ?? null,
    maxQuantity: p.max_quantity != null ? Number(p.max_quantity) : null,
    unitsSold: soldByProduct.get(p.id) ?? 0,
    soldOut:
      p.max_quantity != null &&
      (soldByProduct.get(p.id) ?? 0) >= Number(p.max_quantity),
    remaining:
      p.max_quantity != null
        ? Math.max(0, Number(p.max_quantity) - (soldByProduct.get(p.id) ?? 0))
        : null,
  }));
}

// Visible, active subscription products for the pricing page + signup. Uncached
// — always reflects the live `products` table.
export function getSubscriptionProducts(
  accountKind?: "host" | "quote_only",
): Promise<CatalogProduct[]> {
  return load(["membership", "service"], true, accountKind);
}

// The FULL internal catalog an admin can sell from a user's record: active
// products of EVERY type (membership + service + once-off product + wielo_credits
// packages), ignoring is_visible (visibility only gates the public pricing page,
// not internal selling). Uncached.
export function getInternalCatalog(): Promise<CatalogProduct[]> {
  return load(["membership", "service", "product", "wielo_credits"], false);
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
