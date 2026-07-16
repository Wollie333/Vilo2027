import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Shared cap check for the checkout-start guards. A product with a `max_quantity`
// locks once units-sold (product_units_sold RPC — the one authoritative counter)
// reaches the cap. Uncapped products (max_quantity NULL) are always available.
// Best-effort: on any read error we FAIL OPEN (allow the sale) so a transient DB
// blip never blocks legitimate revenue.
export async function isProductSoldOut(
  db: SupabaseClient,
  productId: string,
): Promise<boolean> {
  const { data: product } = await db
    .from("products")
    .select("max_quantity")
    .eq("id", productId)
    .maybeSingle();
  const cap = product?.max_quantity;
  if (cap == null) return false;

  const { data: sold, error } = await db.rpc("product_units_sold", {
    p_product_id: productId,
  });
  if (error) return false;
  return Number(sold ?? 0) >= Number(cap);
}
