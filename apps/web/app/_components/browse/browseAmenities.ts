import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAmenityIndex } from "@/lib/taxonomy/getAmenities";

export type BrowseAmenityOption = { slug: string; label: string };

/** How many amenity toggles the filter sheet offers. The catalog is far longer;
 *  a filter sheet that lists all of it stops being usable on a phone. */
const MAX_AMENITY_FILTERS = 12;

const loadUsage = unstable_cache(
  async (): Promise<string[]> => {
    // Rank by how many listings actually have the amenity — a filter nobody can
    // satisfy is worse than no filter. Catalog sort_order is an admin display
    // order and puts things like "24-hour front desk" ahead of "Wi-Fi".
    const { data } = await createAdminClient()
      .from("property_amenities")
      .select("amenity_key");
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      if (!row.amenity_key) continue;
      counts.set(row.amenity_key, (counts.get(row.amenity_key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);
  },
  ["browse:amenity-usage"],
  { tags: ["taxonomy"], revalidate: 3600 },
);

/**
 * The amenity toggles shown in the /explore filter sheet — published catalog
 * rows, most-used first, capped. Labels come from the catalog so an admin
 * rename shows up here too.
 */
export async function getBrowseAmenities(): Promise<BrowseAmenityOption[]> {
  const [index, ranked] = await Promise.all([getAmenityIndex(), loadUsage()]);
  const slugs = [...ranked, ...index.keys()]; // used first, catalog order fills
  const seen = new Set<string>();
  const options: BrowseAmenityOption[] = [];
  for (const slug of slugs) {
    if (seen.has(slug) || options.length >= MAX_AMENITY_FILTERS) continue;
    seen.add(slug);
    const row = index.get(slug);
    if (row) options.push({ slug: row.slug, label: row.label });
  }
  return options;
}
