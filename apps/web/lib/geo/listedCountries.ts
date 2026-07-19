import "server-only";

import { unstable_cache } from "next/cache";

import { countryByIso } from "@/lib/phone/dialCodes";
import { createAdminClient } from "@/lib/supabase/admin";

export type ListedCountry = { iso2: string; name: string };

/**
 * The distinct countries that currently have at least one published
 * accommodation listing — the only countries worth offering in the directory's
 * country picker (it grows automatically as hosts in new countries publish).
 *
 * Cached for 5 minutes (tag: 'listed-countries') so the global site header
 * doesn't re-run this on every request. Uses the admin client because
 * unstable_cache runs outside request scope (no cookies()); it only reads public
 * published rows.
 */
export const getListedCountries = unstable_cache(
  async (): Promise<ListedCountry[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("properties")
      .select("country")
      .eq("is_published", true)
      .eq("property_type", "accommodation")
      .is("deleted_at", null)
      .limit(5000);

    const seen = new Set<string>();
    const out: ListedCountry[] = [];
    for (const row of data ?? []) {
      const iso = (row.country ?? "").toUpperCase();
      if (!iso || seen.has(iso)) continue;
      seen.add(iso);
      out.push({ iso2: iso, name: countryByIso(iso)?.name ?? iso });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  },
  ["listed-countries"],
  { revalidate: 300, tags: ["listed-countries"] },
);
