import { cache } from "react";
import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

import type {
  CategoryKind,
  CategoryNode,
  CategoryTreeByKind,
  ListingCategoryRow,
} from "./types";

const loadAllCategories = unstable_cache(
  async (): Promise<ListingCategoryRow[]> => {
    const service = createAdminClient();
    const { data, error } = await service
      .from("property_categories")
      .select("*")
      .is("deleted_at", null)
      .order("sort_order");
    if (error) {
      console.error("[taxonomy] loadAllCategories failed", error);
      return [];
    }
    return (data ?? []) as ListingCategoryRow[];
  },
  ["taxonomy:categories:all"],
  { tags: ["taxonomy"], revalidate: 3600 },
);

/**
 * Returns the published category tree, grouped by kind, with children
 * nested under their parent. Cached per-request via React.cache and shared
 * across requests via unstable_cache (tag: 'taxonomy').
 */
export const getCategoryTree = cache(async (): Promise<CategoryTreeByKind> => {
  const all = await loadAllCategories();
  // MVP: only accommodation is surfaced. Experience taxonomy rows remain in
  // the DB but are filtered out everywhere until tour guides ship.
  const published = all.filter(
    (c) => c.is_published && c.kind === "accommodation",
  );
  return buildTree(published);
});

/**
 * Returns ALL categories (including unpublished) — admin-only loader.
 * Not cached because admin edits should reflect immediately.
 */
export async function getAllCategoriesForAdmin(): Promise<
  ListingCategoryRow[]
> {
  const service = createAdminClient();
  const { data, error } = await service
    .from("property_categories")
    .select("*")
    .is("deleted_at", null)
    // MVP: hide experience taxonomy rows from the admin UI too.
    .eq("kind", "accommodation")
    .order("sort_order");
  if (error) {
    console.error("[taxonomy] getAllCategoriesForAdmin failed", error);
    return [];
  }
  return (data ?? []) as ListingCategoryRow[];
}

/** Look up a single published category by slug (used by /c/[slug]). */
export const getCategoryBySlug = cache(
  async (slug: string): Promise<ListingCategoryRow | null> => {
    const all = await loadAllCategories();
    // MVP: only accommodation categories resolve — experience slugs 404.
    return (
      all.find(
        (c) => c.is_published && c.kind === "accommodation" && c.slug === slug,
      ) ?? null
    );
  },
);

/** Return category id + every descendant id. Used to aggregate listings. */
export async function getDescendantIds(categoryId: string): Promise<string[]> {
  const all = await loadAllCategories();
  const result = new Set<string>([categoryId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of all) {
      if (c.parent_id && result.has(c.parent_id) && !result.has(c.id)) {
        result.add(c.id);
        added = true;
      }
    }
  }
  return Array.from(result);
}

/** Flat list of every published category for a given kind. */
export async function getCategoriesForKind(
  kind: CategoryKind,
): Promise<ListingCategoryRow[]> {
  const all = await loadAllCategories();
  return all
    .filter((c) => c.is_published && c.kind === kind)
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
    );
}

function buildTree(rows: ListingCategoryRow[]): CategoryTreeByKind {
  const nodes = new Map<string, CategoryNode>();
  for (const r of rows) {
    nodes.set(r.id, { ...r, children: [] });
  }
  const accommodation: CategoryNode[] = [];
  for (const node of nodes.values()) {
    if (node.parent_id) {
      const parent = nodes.get(node.parent_id);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }
    if (node.kind === "accommodation") accommodation.push(node);
  }
  const sortNodes = (list: CategoryNode[]) => {
    list.sort(
      (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
    );
    for (const n of list) sortNodes(n.children);
  };
  sortNodes(accommodation);
  return { accommodation };
}
