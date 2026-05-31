import { Sparkles } from "lucide-react";

import { getCategoryTree } from "@/lib/taxonomy/getCategories";

import { TypeChipsClient } from "./TypeChipsClient";

export async function TypeChips({ currentType }: { currentType: string }) {
  const tree = await getCategoryTree();

  const chips: Array<{ key: string; label: string; icon: string }> = [
    { key: "", label: "All", icon: "sparkles" },
  ];

  for (const root of tree.accommodation) {
    for (const leaf of root.children) {
      chips.push({ key: leaf.slug, label: leaf.label, icon: leaf.icon });
    }
  }

  return <TypeChipsClient chips={chips} currentType={currentType} />;
}

// Re-export icon name → component map for the client component.
export const FALLBACK_CHIP_ICONS = { sparkles: Sparkles };
