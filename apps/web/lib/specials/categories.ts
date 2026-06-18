// Curated system categories for Specials. These power the cross-host /specials
// directory filter (S4) and are a fixed list so the filter UI + analytics stay
// coherent across hosts. Hosts may ALSO add their own free-form `custom_tags`
// (their own website only) — those are not constrained here.
//
// Keys are stored in `specials.categories text[]`. Labels are hardcoded for now;
// the S7 i18n pass extracts them to en.json (matches the dashboard editor's
// current hardcoded-strings convention).

export const SPECIAL_CATEGORIES = [
  { key: "romantic", label: "Romantic getaway" },
  { key: "family", label: "Family friendly" },
  { key: "last_minute", label: "Last minute" },
  { key: "festive", label: "Festive / holiday" },
  { key: "business", label: "Business travel" },
  { key: "wellness", label: "Wellness & spa" },
  { key: "adventure", label: "Adventure & outdoors" },
  { key: "seasonal", label: "Seasonal offer" },
] as const;

export type SpecialCategoryKey = (typeof SPECIAL_CATEGORIES)[number]["key"];

export const SPECIAL_CATEGORY_KEYS = SPECIAL_CATEGORIES.map(
  (c) => c.key,
) as SpecialCategoryKey[];

const LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  SPECIAL_CATEGORIES.map((c) => [c.key, c.label]),
);

/** Human label for a stored category key (falls back to the raw key). */
export function specialCategoryLabel(key: string): string {
  return LABEL_BY_KEY[key] ?? key;
}
