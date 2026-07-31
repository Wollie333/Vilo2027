import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CANONICAL_PRODUCT_FEATURES, FEATURE_BY_KEY } from "./features";

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
  /** Marketing bullet list (hand-entered on the product). */
  bullets: string[];
  /**
   * The product's REAL capabilities, derived from its `product_features` (the
   * admin's feature config) via the canonical catalog — so what a plan advertises
   * always matches what it actually unlocks. Ordered by the canonical catalog.
   */
  capabilities: string[];
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

/**
 * Turn one enabled product_feature into a human capability line, using the
 * canonical label + its allowance. Toggles read as the label; quantity features
 * carry their limit (`Unlimited`/`0`/`N`). Returns null for a feature not in the
 * canonical catalog (unknown key) so we never surface a raw feature_key.
 */
function capabilityLine(
  featureKey: string,
  limitValue: number | null,
): string | null {
  const def = FEATURE_BY_KEY[featureKey];
  if (!def) return null;
  if (def.scope === "toggle") return def.label;
  // total | per_business — show the allowance.
  if (limitValue === null) return `Unlimited ${def.label.toLowerCase()}`;
  if (limitValue <= 0) return null; // an allowance of zero grants nothing
  return `${limitValue} ${def.label}`;
}

/**
 * Build each product's capability list from its enabled `product_features`, in
 * the canonical catalog order so every plan reads consistently. This is the SoT
 * for "what a plan unlocks" on the pricing page + signup — never a hand-kept list.
 */
function buildCapabilities(
  rows: {
    product_id: string;
    feature_key: string;
    is_enabled: boolean | null;
    limit_value: number | null;
  }[],
): Map<string, string[]> {
  const byProduct = new Map<string, Map<string, number | null>>();
  for (const r of rows) {
    if (r.is_enabled !== true) continue;
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, new Map());
    byProduct.get(r.product_id)!.set(r.feature_key, r.limit_value);
  }
  const out = new Map<string, string[]>();
  for (const [productId, feats] of byProduct) {
    const lines: string[] = [];
    for (const def of CANONICAL_PRODUCT_FEATURES) {
      if (!feats.has(def.key)) continue;
      const line = capabilityLine(def.key, feats.get(def.key) ?? null);
      if (line) lines.push(line);
    }
    out.set(productId, lines);
  }
  return out;
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

  // Real capabilities per product, from its admin-configured product_features
  // (the same table check_feature_permission resolves through), so the pricing
  // page + signup advertise exactly what each plan unlocks.
  const productIds = (data ?? []).map((p) => p.id);
  const { data: featureRows } = productIds.length
    ? await db
        .from("product_features")
        .select("product_id, feature_key, is_enabled, limit_value")
        .in("product_id", productIds)
    : { data: [] as never[] };
  const capabilitiesByProduct = buildCapabilities(
    (featureRows ?? []) as {
      product_id: string;
      feature_key: string;
      is_enabled: boolean | null;
      limit_value: number | null;
    }[],
  );

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
    capabilities: capabilitiesByProduct.get(p.id) ?? [],
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
