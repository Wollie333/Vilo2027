"use client";

import {
  Accessibility,
  AlertCircle,
  Baby,
  Bath,
  CheckCircle2,
  Coffee,
  Flame,
  Home,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  TreePine,
  Trash2,
  Utensils,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { modal } from "@/components/ui/modal-host";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AmenityGroupRow } from "@/lib/taxonomy/types";

import { deleteAmenityGroup, saveAmenityGroup } from "./actions";

const ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "check-circle-2": CheckCircle2,
  "tree-pine": TreePine,
  baby: Baby,
  "shield-check": ShieldCheck,
  accessibility: Accessibility,
  home: Home,
  utensils: Utensils,
  waves: Waves,
  flame: Flame,
  bath: Bath,
  coffee: Coffee,
};
const ICON_KEYS = Object.keys(ICON_MAP);

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Sparkles;
}

type Editing = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  sort_order: number;
  is_published: boolean;
  isNew: boolean;
};

export function GroupsEditor({ rows }: { rows: AmenityGroupRow[] }) {
  const [list, setList] = useState<AmenityGroupRow[]>(rows);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openNew() {
    setEditing({
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `tmp-${Math.random()}`,
      slug: "",
      label: "",
      icon: "sparkles",
      sort_order: 100 + list.length * 10,
      is_published: true,
      isNew: true,
    });
  }

  function openEdit(row: AmenityGroupRow) {
    setEditing({
      id: row.id,
      slug: row.slug,
      label: row.label,
      icon: row.icon,
      sort_order: row.sort_order,
      is_published: row.is_published,
      isNew: false,
    });
  }

  function saveRow() {
    if (!editing) return;
    if (!editing.label.trim()) {
      setError("Label is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveAmenityGroup({
        id: editing.isNew ? undefined : editing.id,
        slug: editing.slug || undefined,
        label: editing.label,
        icon: editing.icon,
        sortOrder: editing.sort_order,
        isPublished: editing.is_published,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const updated: AmenityGroupRow = {
        id: res.id,
        slug: editing.slug || editing.label.toLowerCase().replace(/\s+/g, "-"),
        label: editing.label,
        icon: editing.icon,
        sort_order: editing.sort_order,
        is_published: editing.is_published,
        created_at: "",
        updated_at: "",
        deleted_at: null,
      };
      if (editing.isNew) {
        setList((prev) => [...prev, updated]);
      } else {
        setList((prev) => prev.map((r) => (r.id === editing.id ? updated : r)));
      }
      setEditing(null);
    });
  }

  async function removeRow(row: AmenityGroupRow) {
    const reason = await modal.prompt({
      title: `Delete group "${row.label}"?`,
      description:
        "Amenities in this group will need to be reassigned to another group.",
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you deleting this group?",
      minLength: 5,
      confirmLabel: "Delete group",
      intent: "destructive",
    });
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAmenityGroup({ id: row.id, reason });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setList((prev) => prev.filter((r) => r.id !== row.id));
    });
  }

  const sorted = [...list].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button type="button" onClick={openNew} className="gap-1.5" size="sm">
          <Plus className="h-4 w-4" /> New group
        </Button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {sorted.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-brand-mute" />
            <p className="text-[13px] text-brand-mute">
              No amenity groups yet. Add one to start organising amenities.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-brand-line">
            {sorted.map((g) => {
              const Icon = resolveIcon(g.icon);
              return (
                <li
                  key={g.id}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-light/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
                    <Icon className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[14px] font-semibold text-brand-ink">
                      {g.label}
                    </div>
                    <div className="text-[11.5px] text-brand-mute">
                      <span className="font-mono">{g.slug}</span>
                      <span className="mx-1.5">·</span>
                      <span className="num">sort {g.sort_order}</span>
                    </div>
                  </div>

                  {g.is_published ? (
                    <span className="hidden items-center gap-1 rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-status-confirmed sm:inline-flex">
                      <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
                      Published
                    </span>
                  ) : (
                    <span className="hidden items-center rounded-pill bg-brand-line/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute sm:inline-flex">
                      Hidden
                    </span>
                  )}

                  <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => openEdit(g)}
                      className="rounded-md border border-brand-line bg-white p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                      aria-label={`Edit ${g.label}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(g)}
                      disabled={pending}
                      className="rounded-md border border-red-100 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-50"
                      aria-label={`Delete ${g.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent side="right" className="w-full max-w-md sm:max-w-lg">
          {editing ? (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-xl font-bold text-brand-ink">
                  {editing.isNew ? "New amenity group" : "Edit group"}
                </SheetTitle>
                <SheetDescription>
                  Groups organise amenities into sections on the listing editor
                  and the public listing page.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <label className="block space-y-1.5">
                  <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
                    Label
                  </span>
                  <Input
                    autoFocus
                    value={editing.label}
                    onChange={(e) =>
                      setEditing({ ...editing, label: e.target.value })
                    }
                    placeholder="Essentials"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
                    Slug
                  </span>
                  <Input
                    value={editing.slug}
                    onChange={(e) =>
                      setEditing({ ...editing, slug: e.target.value })
                    }
                    placeholder="essentials (auto if blank)"
                    className="font-mono text-[12px]"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
                    Icon
                  </span>
                  <div className="rounded-md border border-brand-line bg-white p-2">
                    <div className="grid grid-cols-6 gap-1">
                      {ICON_KEYS.map((name) => {
                        const I = resolveIcon(name);
                        const active = editing.icon === name;
                        return (
                          <button
                            key={name}
                            type="button"
                            title={name}
                            onClick={() =>
                              setEditing({ ...editing, icon: name })
                            }
                            className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${
                              active
                                ? "bg-brand-primary text-white"
                                : "bg-brand-light/40 text-brand-mute hover:bg-brand-accent hover:text-brand-secondary"
                            }`}
                          >
                            <I className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block space-y-1.5">
                    <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
                      Sort order
                    </span>
                    <Input
                      type="number"
                      value={editing.sort_order}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          sort_order: Number(e.target.value) || 0,
                        })
                      }
                      className="font-mono"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
                      Visibility
                    </span>
                    <label className="flex h-10 items-center gap-2 rounded-md border border-brand-line bg-white px-3 text-sm">
                      <input
                        type="checkbox"
                        checked={editing.is_published}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            is_published: e.target.checked,
                          })
                        }
                        className="rounded border-brand-line"
                      />
                      Published
                    </label>
                  </label>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end gap-2 border-t border-brand-line pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Cancel
                </Button>
                <Button
                  type="button"
                  onClick={saveRow}
                  disabled={pending || !editing.label.trim()}
                >
                  {pending
                    ? "Saving…"
                    : editing.isNew
                      ? "Create group"
                      : "Save changes"}
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
