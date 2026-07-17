import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

import type { PromoProduct } from "./PromoEditor";

// Products a promo code can target. Active only — offering a code against a
// retired product would create one that can never be redeemed.
export async function loadPromoProducts(
  service: ReturnType<typeof createAdminClient>,
): Promise<PromoProduct[]> {
  const { data } = await service
    .from("products")
    .select("id, name, product_type, price, currency")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    productType: p.product_type,
    price: Number(p.price),
    currency: p.currency,
  }));
}
