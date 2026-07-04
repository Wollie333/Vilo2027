import type { AmenityGroupWithItems } from "./types";

/** A category of amenities ready to render (header icon + dot-bulleted items). */
export type AmenityCategory = {
  id: string;
  label: string;
  /** Bare Lucide icon key (e.g. "wifi", "square-parking"). */
  icon: string;
  items: { key: string; label: string }[];
};

/**
 * Group a listing's selected amenity KEYS by the ADMIN-managed category catalog,
 * preserving catalog order. Categories with no selected item are dropped.
 *
 * Categories + amenities are defined ONLY by the admin (in /admin/platform/
 * amenities); a host merely SELECTS which apply to their property. So a key not in
 * the published catalog (e.g. a legacy/deactivated amenity) is intentionally NOT
 * shown — the listing only ever renders admin-managed categories.
 *
 * Pure + shared by the marketplace listing and a host's themed site, so the
 * grouping is identical everywhere.
 */
export function buildAmenityCategories(
  catalog: AmenityGroupWithItems[],
  keys: string[],
): AmenityCategory[] {
  const keySet = new Set(keys);
  return catalog
    .map((g) => ({
      id: g.id,
      label: g.label,
      icon: g.icon,
      items: g.items
        .filter((i) => keySet.has(i.slug))
        .map((i) => ({ key: i.slug, label: i.label })),
    }))
    .filter((c) => c.items.length > 0);
}
