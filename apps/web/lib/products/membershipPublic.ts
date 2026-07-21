import "server-only";

import { isFoundingOffersOpen } from "@/lib/billing/recurring";
import { createAdminClient } from "@/lib/supabase/admin";

// WS-8 — the ONE public reader for what a host actually pays. The calculator (and
// any future public pricing surface) must never hardcode a price: the founder
// edits products in admin, and Founding pricing is only advertised while the
// `founding_offers_open` flag is on (fails closed → list price).

export type PublicMembershipPricing = {
  price: number;
  annual_price: number | null;
  per_listing_amount: number | null;
  /** True when the Founding window is open and these ARE the Founding numbers. */
  isFounding: boolean;
  currency: string;
};

const FALLBACK: PublicMembershipPricing = {
  price: 0,
  annual_price: null,
  per_listing_amount: null,
  isFounding: false,
  currency: "ZAR",
};

/**
 * The membership product a host buys, priced as it would be quoted TODAY.
 *
 * Selecting it needs care: `products` also holds the R0 `beta` membership and
 * the `quote_only` Wielo Quotes plan, so "first membership by sort_order" picks
 * the wrong row (it did, on the first run of this page). The paid HOST plan is
 * the cheapest `account_kind='host'` membership with a real price — that stays
 * right if the founder renames the slug or adds a second tier.
 *
 * Returns the zero-priced fallback if nothing matches, so a marketing page says
 * "pricing unavailable" rather than rendering a wrong number.
 */
export async function getPublicMembershipPricing(): Promise<PublicMembershipPricing> {
  const admin = createAdminClient();
  const [{ data }, foundingOpen] = await Promise.all([
    admin
      .from("products")
      .select(
        "price, annual_price, per_listing_amount, founding_price, founding_annual_price, founding_per_listing_amount, currency",
      )
      .eq("product_type", "membership")
      .eq("account_kind", "host")
      .eq("is_active", true)
      .eq("is_visible", true)
      .gt("price", 0)
      .order("price")
      .limit(1)
      .maybeSingle(),
    isFoundingOffersOpen(),
  ]);

  if (!data) return FALLBACK;

  const useFounding = foundingOpen && Number(data.founding_price ?? 0) > 0;

  return {
    price: Number(useFounding ? data.founding_price : data.price) || 0,
    annual_price:
      (useFounding ? data.founding_annual_price : data.annual_price) == null
        ? null
        : Number(useFounding ? data.founding_annual_price : data.annual_price),
    per_listing_amount:
      (useFounding
        ? data.founding_per_listing_amount
        : data.per_listing_amount) == null
        ? null
        : Number(
            useFounding
              ? data.founding_per_listing_amount
              : data.per_listing_amount,
          ),
    isFounding: useFounding,
    currency: data.currency ?? "ZAR",
  };
}
