import type { SupabaseClient } from "@supabase/supabase-js";

import type { CouponAddon, CouponListing } from "./CouponsManager";

/** Listings (+ active rooms) and active add-ons a coupon can target. Shared by
 * the list page and the create/edit editor pages. */
export async function loadCouponFormData(
  supabase: SupabaseClient,
  hostId: string,
): Promise<{ listings: CouponListing[]; addons: CouponAddon[] }> {
  const [{ data: listingsRaw }, { data: addonsRaw }] = await Promise.all([
    supabase
      .from("properties")
      .select(
        "id, name, currency, rooms:property_rooms ( id, name, is_active, deleted_at, sort_order )",
      )
      .eq("host_id", hostId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("addons")
      .select("id, name, is_active")
      .eq("host_id", hostId)
      .order("sort_order", { ascending: true }),
  ]);

  const addons: CouponAddon[] = (addonsRaw ?? [])
    .filter((a) => a.is_active)
    .map((a) => ({ id: a.id, name: a.name }));

  const listings: CouponListing[] = (listingsRaw ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    currency: l.currency,
    rooms: (
      (l.rooms as Array<{
        id: string;
        name: string;
        is_active: boolean;
        deleted_at: string | null;
        sort_order: number;
      }> | null) ?? []
    )
      .filter((r) => r.deleted_at === null && r.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({ id: r.id, name: r.name })),
  }));

  return { listings, addons };
}
