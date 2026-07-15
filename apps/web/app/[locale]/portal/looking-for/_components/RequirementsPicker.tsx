"use client";

import { Check } from "lucide-react";

import type { RequirementGroupWithOptions } from "@/lib/looking-for/requirements";

interface RequirementsPickerProps {
  groups: RequirementGroupWithOptions[];
  value: string[];
  onChange: (keys: string[]) => void;
}

// Guest-facing picker over the admin-managed requirement taxonomy. 'single'
// groups behave like radios (one pick, re-click to clear); 'multi' groups are
// checkboxes. Guests can only pick from what admins have published.
export function RequirementsPicker({
  groups,
  value,
  onChange,
}: RequirementsPickerProps) {
  const selected = new Set(value);

  function toggleMulti(slug: string) {
    const next = new Set(value);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onChange([...next]);
  }

  function selectSingle(group: RequirementGroupWithOptions, slug: string) {
    const groupSlugs = new Set(group.options.map((o) => o.slug));
    // Drop any current pick from this group, then add unless it was the pick.
    const next = value.filter((k) => !groupSlugs.has(k));
    if (!selected.has(slug)) next.push(slug);
    onChange(next);
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-6 text-center text-sm text-brand-mute">
        No requirement options are available yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-brand-ink">
              {group.label}
            </h3>
            <span className="text-[11px] text-brand-mute">
              {group.select_mode === "single"
                ? "choose one"
                : "choose any that apply"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.options.map((o) => {
              const active = selected.has(o.slug);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    group.select_mode === "single"
                      ? selectSingle(group, o.slug)
                      : toggleMulti(o.slug)
                  }
                  className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium transition ${
                    active
                      ? "border-brand-primary bg-brand-accent text-brand-primary"
                      : "border-brand-line bg-white text-brand-ink hover:border-brand-primary/40"
                  }`}
                >
                  {active ? <Check className="h-3.5 w-3.5" /> : null}
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
