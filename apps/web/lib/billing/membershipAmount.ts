import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Re-export the PURE price math (unit-tested in membershipPricing.ts) so existing
// server imports of "@/lib/billing/membershipAmount" keep working.
export {
  resolveMembershipAmount,
  round2,
  type MembershipPricing,
  type SubscriptionLock,
} from "./membershipPricing";

// WS-5 server-side helpers (DB I/O). The Founding lock makes the subscription row
// the source of truth for price — see membershipPricing.resolveMembershipAmount.

/** Count a host's live (non-deleted) listings for the per-listing calc. */
export async function countHostListings(
  admin: SupabaseClient,
  hostId: string,
): Promise<number> {
  const { count } = await admin
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("host_id", hostId)
    .is("deleted_at", null);
  return count ?? 0;
}

/**
 * Snapshot the Founding price onto a subscription (the lock, strategy §5c). Reads
 * the plan product's founding_* config and freezes it onto the sub for its cycle,
 * so future list-price edits never touch this host. Re-running re-snapshots the
 * CURRENT founding config. Returns the locked base, or an error if the product
 * has no Founding pricing configured.
 */
export async function applyFoundingLock(
  admin: SupabaseClient,
  subId: string,
): Promise<{ ok: true; lockedBase: number } | { ok: false; error: string }> {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, billing_cycle, product_id")
    .eq("id", subId)
    .maybeSingle();
  if (!sub || !sub.product_id) {
    return { ok: false, error: "Subscription has no product to price from." };
  }
  const { data: product } = await admin
    .from("products")
    .select(
      "founding_price, founding_annual_price, founding_per_listing_amount",
    )
    .eq("id", sub.product_id)
    .maybeSingle();
  if (!product || product.founding_price == null) {
    return { ok: false, error: "This plan has no Founding price configured." };
  }
  const cycle = sub.billing_cycle === "annual" ? "annual" : "monthly";
  const lockedBase =
    cycle === "annual"
      ? Number(product.founding_annual_price ?? product.founding_price)
      : Number(product.founding_price);
  if (!(lockedBase > 0)) {
    return { ok: false, error: "Founding price is not set for this cycle." };
  }

  const { error } = await admin
    .from("subscriptions")
    .update({
      is_founding: true,
      locked_base_amount: lockedBase,
      locked_per_listing_amount: Number(
        product.founding_per_listing_amount ?? 0,
      ),
      locked_currency: "ZAR",
      price_locked_at: new Date().toISOString(),
    })
    .eq("id", subId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, lockedBase };
}

/** Remove a Founding lock (host reverts to live list pricing at next charge). */
export async function clearFoundingLock(
  admin: SupabaseClient,
  subId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin
    .from("subscriptions")
    .update({
      is_founding: false,
      locked_base_amount: null,
      locked_per_listing_amount: null,
      locked_currency: null,
      price_locked_at: null,
    })
    .eq("id", subId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
