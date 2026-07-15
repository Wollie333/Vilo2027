import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";

// Admin-managed "accommodation requirements" taxonomy (mirrors the amenities
// taxonomy). Groups have a select mode: 'single' (radio, e.g. Property type) or
// 'multi' (checkboxes, e.g. Facilities). Guests pick from these; only admins add.

export const REQUIREMENTS_TAG = "lf-requirements";

export type RequirementGroup = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  select_mode: "single" | "multi";
  sort_order: number;
  is_published: boolean;
};

export type RequirementOption = {
  id: string;
  group_id: string;
  slug: string;
  label: string;
  icon: string;
  sort_order: number;
  is_published: boolean;
};

export type RequirementGroupWithOptions = RequirementGroup & {
  options: RequirementOption[];
};

const GROUP_COLS =
  "id, slug, label, icon, select_mode, sort_order, is_published";
const OPTION_COLS = "id, group_id, slug, label, icon, sort_order, is_published";

// Cached raw load (alive rows, published + unpublished). Invalidated by the
// admin actions via the REQUIREMENTS_TAG cache tag.
const loadAll = unstable_cache(
  async (): Promise<{
    groups: RequirementGroup[];
    options: RequirementOption[];
  }> => {
    const admin = createAdminClient();
    const [{ data: groups }, { data: options }] = await Promise.all([
      admin
        .from("looking_for_requirement_groups")
        .select(GROUP_COLS)
        .is("deleted_at", null)
        .order("sort_order"),
      admin
        .from("looking_for_requirement_options")
        .select(OPTION_COLS)
        .is("deleted_at", null)
        .order("sort_order"),
    ]);
    return {
      groups: (groups ?? []) as RequirementGroup[],
      options: (options ?? []) as RequirementOption[],
    };
  },
  ["lf:requirements:all"],
  { tags: [REQUIREMENTS_TAG], revalidate: 3600 },
);

// Public/guest-facing: published groups with their published options nested.
export const getLookingForRequirements = cache(
  async (): Promise<RequirementGroupWithOptions[]> => {
    const { groups, options } = await loadAll();
    return groups
      .filter((g) => g.is_published)
      .map((g) => ({
        ...g,
        options: options
          .filter((o) => o.is_published && o.group_id === g.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      }));
  },
);

// Admin: everything alive (incl. unpublished), uncached so edits show at once.
export async function getLookingForRequirementsForAdmin(): Promise<{
  groups: RequirementGroup[];
  options: RequirementOption[];
}> {
  const admin = createAdminClient();
  const [{ data: groups }, { data: options }] = await Promise.all([
    admin
      .from("looking_for_requirement_groups")
      .select(GROUP_COLS)
      .is("deleted_at", null)
      .order("sort_order"),
    admin
      .from("looking_for_requirement_options")
      .select(OPTION_COLS)
      .is("deleted_at", null)
      .order("sort_order"),
  ]);
  return {
    groups: (groups ?? []) as RequirementGroup[],
    options: (options ?? []) as RequirementOption[],
  };
}

export type RequirementCategory = {
  slug: string;
  label: string;
  icon: string;
  options: { slug: string; label: string; icon: string }[];
};

// Read-only display: given the full published catalog + the post's selected
// option keys, return only the groups that have ≥1 selected option (catalog
// order preserved). Keys not in the published catalog are intentionally dropped.
export function buildRequirementCategories(
  catalog: RequirementGroupWithOptions[],
  keys: string[],
): RequirementCategory[] {
  const set = new Set(keys);
  const out: RequirementCategory[] = [];
  for (const g of catalog) {
    const options = g.options
      .filter((o) => set.has(o.slug))
      .map((o) => ({ slug: o.slug, label: o.label, icon: o.icon }));
    if (options.length > 0) {
      out.push({ slug: g.slug, label: g.label, icon: g.icon, options });
    }
  }
  return out;
}
