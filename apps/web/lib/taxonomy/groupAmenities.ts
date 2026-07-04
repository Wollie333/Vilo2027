import type { AmenityGroupWithItems } from "./types";

/** A category of amenities ready to render (header icon + dot-bulleted items). */
export type AmenityCategory = {
  id: string;
  label: string;
  /** Bare Lucide icon key (e.g. "wifi", "square-parking"). */
  icon: string;
  items: { key: string; label: string }[];
};

/** "free_wifi" → "Free Wifi" (fallback label for keys not in the catalog). */
export function humanizeAmenityKey(key: string): string {
  return key
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

/**
 * Group a listing's selected amenity KEYS by the admin-managed category catalog,
 * preserving catalog order. Categories with no selected item are dropped; any key
 * the catalog doesn't know (legacy/custom) is collected into a trailing "Other"
 * category so nothing a host selected is ever hidden.
 *
 * Pure + shared by the marketplace listing and a host's themed site, so the
 * grouping is identical everywhere.
 */
export function buildAmenityCategories(
  catalog: AmenityGroupWithItems[],
  keys: string[],
): AmenityCategory[] {
  const keySet = new Set(keys);
  const categories: AmenityCategory[] = catalog
    .map((g) => ({
      id: g.id,
      label: g.label,
      icon: g.icon,
      items: g.items
        .filter((i) => keySet.has(i.slug))
        .map((i) => ({ key: i.slug, label: i.label })),
    }))
    .filter((c) => c.items.length > 0);

  const known = new Set(catalog.flatMap((g) => g.items.map((i) => i.slug)));
  const extras = keys.filter((k) => !known.has(k));
  if (extras.length > 0) {
    categories.push({
      id: "other",
      label: "Other",
      icon: "circle-check",
      items: extras.map((k) => ({ key: k, label: humanizeAmenityKey(k) })),
    });
  }

  return categories;
}
