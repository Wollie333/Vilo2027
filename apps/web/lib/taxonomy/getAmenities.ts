import { cache } from "react";
import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

import type {
  AmenityCatalogRow,
  AmenityGroupRow,
  AmenityGroupWithItems,
} from "./types";

const loadAll = unstable_cache(
  async (): Promise<{
    groups: AmenityGroupRow[];
    items: AmenityCatalogRow[];
  }> => {
    const service = createAdminClient();
    const [{ data: groups, error: gErr }, { data: items, error: iErr }] =
      await Promise.all([
        service
          .from("amenity_groups")
          .select("*")
          .is("deleted_at", null)
          .order("sort_order"),
        service
          .from("amenity_catalog")
          .select("*")
          .is("deleted_at", null)
          .order("sort_order"),
      ]);
    if (gErr) console.error("[taxonomy] amenity_groups load failed", gErr);
    if (iErr) console.error("[taxonomy] amenity_catalog load failed", iErr);
    return {
      groups: (groups ?? []) as AmenityGroupRow[],
      items: (items ?? []) as AmenityCatalogRow[],
    };
  },
  ["taxonomy:amenities:all"],
  { tags: ["taxonomy"], revalidate: 3600 },
);

/**
 * Returns the published amenity catalog grouped by amenity_group.
 * Used by the listing edit AmenitiesTab and the public listing detail page.
 */
export const getAmenityCatalog = cache(
  async (): Promise<AmenityGroupWithItems[]> => {
    const { groups, items } = await loadAll();
    const publishedGroups = groups.filter((g) => g.is_published);
    const publishedItems = items.filter((i) => i.is_published);
    return publishedGroups
      .map((g) => ({
        ...g,
        items: publishedItems
          .filter((i) => i.group_id === g.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
  },
);

/**
 * Admin loader — returns ALL groups and items (including unpublished, but
 * not soft-deleted). Used by the admin editors. Not memoised so edits show
 * up immediately.
 */
export async function getAmenitiesForAdmin(): Promise<{
  groups: AmenityGroupRow[];
  items: AmenityCatalogRow[];
}> {
  return loadAll();
}

/** Flat slug → row map for quick lookups (icon, label) on the public side. */
export const getAmenityIndex = cache(
  async (): Promise<Map<string, AmenityCatalogRow>> => {
    const { items } = await loadAll();
    const index = new Map<string, AmenityCatalogRow>();
    for (const item of items) {
      if (item.is_published) index.set(item.slug, item);
    }
    return index;
  },
);
