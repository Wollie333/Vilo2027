import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  computeListingStrength,
  type ListingStrength,
} from "./listingStrength";

export type ListingStrengthResult = {
  strength: ListingStrength;
  listingName: string;
};

/**
 * Loads the transparent Listing Strength for one property, own-only.
 *
 * Ownership is proven through the RLS client (host_manage_own_listings returns
 * the row only to its host); the ranking row + counts are then read with the
 * admin client so it also works for DRAFT listings (public_read_rankings only
 * covers published ones). Returns null when the listing isn't the caller's.
 */
export async function loadListingStrength(
  listingId: string,
): Promise<ListingStrengthResult | null> {
  const rls = createServerClient();

  const { data: owned } = await rls
    .from("properties")
    .select("id, name, city, description, check_in_time")
    .eq("id", listingId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!owned) return null; // not found, or not the caller's listing

  const admin = createAdminClient();
  const [{ data: ranking }, { count: photoCount }, { count: amenityCount }] =
    await Promise.all([
      admin
        .from("property_rankings")
        .select(
          "ranking_score, component_rating, component_reviews, component_profile, component_response_rate, last_calculated",
        )
        .eq("property_id", listingId)
        .maybeSingle(),
      admin
        .from("property_photos")
        .select("id", { count: "exact", head: true })
        .eq("property_id", listingId),
      admin
        .from("property_amenities")
        .select("id", { count: "exact", head: true })
        .eq("property_id", listingId),
    ]);

  const strength = computeListingStrength({
    rankingScore: ranking?.ranking_score ?? null,
    componentRating: ranking?.component_rating ?? null,
    componentReviews: ranking?.component_reviews ?? null,
    componentProfile: ranking?.component_profile ?? null,
    componentResponse: ranking?.component_response_rate ?? null,
    lastCalculated: ranking?.last_calculated ?? null,
    name: owned.name,
    city: owned.city,
    hasDescription: Boolean(owned.description?.trim()),
    hasCheckInTime: Boolean(owned.check_in_time),
    photoCount: photoCount ?? 0,
    amenityCount: amenityCount ?? 0,
  });

  return { strength, listingName: owned.name };
}
