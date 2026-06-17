"use client";

import type { ListingCategoryRow } from "./types";

type Leaf = Pick<
  ListingCategoryRow,
  "id" | "label" | "description" | "slug" | "kind"
>;

/**
 * Chip-grid picker for a listing category. Pass a flat list of
 * accommodation leaves and the picker renders one chip per leaf.
 *
 * Replaces the hardcoded ACCOMMODATION_TYPES button grid that used to live
 * in three different forms. The leaves come from the admin-managed
 * property_categories taxonomy.
 */
export function CategoryPicker({
  leaves,
  value,
  onChange,
  disabled,
}: {
  leaves: Leaf[];
  value: string | null;
  onChange: (leaf: Leaf) => void;
  disabled?: boolean;
}) {
  if (leaves.length === 0) {
    return (
      <p className="rounded border border-dashed border-brand-line bg-brand-light/40 px-3 py-3 text-[12.5px] text-brand-mute">
        No categories available. Ask an admin to add one in{" "}
        <span className="font-mono">/admin/platform/categories</span>.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {leaves.map((leaf) => {
        const active = value === leaf.id;
        return (
          <button
            key={leaf.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(leaf)}
            title={leaf.description ?? undefined}
            className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
              active
                ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
                : "border-brand-line bg-white text-brand-mute hover:bg-brand-light/60"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {leaf.label}
          </button>
        );
      })}
    </div>
  );
}

export type CategoryPickerLeaf = Leaf;
