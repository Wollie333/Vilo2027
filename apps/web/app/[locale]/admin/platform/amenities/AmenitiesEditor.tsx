"use client";

import {
  Accessibility,
  AlertCircle,
  Baby,
  Bath,
  BellRing,
  Car,
  CheckCircle2,
  Coffee,
  Cross,
  Dog,
  Flame,
  KeyRound,
  Laptop,
  Pencil,
  Plus,
  Search,
  Shirt,
  ShieldCheck,
  Sparkles,
  SquareParking,
  Trash2,
  TreePine,
  Tv,
  UserCheck,
  Users,
  Utensils,
  UtensilsCrossed,
  Waves,
  Wifi,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

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
import type { AmenityCatalogRow, AmenityGroupRow } from "@/lib/taxonomy/types";

import { deleteAmenity, saveAmenity } from "./actions";

const ICON_MAP: Record<string, LucideIcon> = {
  wifi: Wifi,
  utensils: Utensils,
  "square-parking": SquareParking,
  wind: Wind,
  flame: Flame,
  tv: Tv,
  shirt: Shirt,
  laptop: Laptop,
  "key-round": KeyRound,
  "user-check": UserCheck,
  waves: Waves,
  bath: Bath,
  "utensils-crossed": UtensilsCrossed,
  users: Users,
  "paw-print": Dog,
  "bell-ring": BellRing,
  cross: Cross,
  accessibility: Accessibility,
  "tree-pine": TreePine,
  sparkles: Sparkles,
  "check-circle-2": CheckCircle2,
  baby: Baby,
  "shield-check": ShieldCheck,
  car: Car,
  coffee: Coffee,
};
const ICON_KEYS = Object.keys(ICON_MAP).sort();

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? CheckCircle2;
}

type Editing = {
  id: string;
  group_id: string;
  slug: string;
  label: string;
  icon: string;
  sort_order: number;
  is_published: boolean;
  isNew: boolean;
};

export function AmenitiesEditor({
  groups,
  items,
}: {
  groups: AmenityGroupRow[];
  items: AmenityCatalogRow[];
}) {
  const [list, setList] = useState<AmenityCatalogRow[]>(items);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (r) =>
            r.label.toLowerCase().includes(q) ||
            r.slug.toLowerCase().includes(q),
        )
      : list;
    return groups
      .filter((g) => !g.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        group: g,
        rows: filtered
          .filter((r) => r.group_id === g.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      }));
  }, [groups, list, query]);

  function openNew(groupId: string) {
    const maxSort = list
      .filter((r) => r.group_id === groupId)
      .reduce((m, r) => Math.max(m, r.sort_order), 0);
    setEditing({
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `tmp-${Math.random()}`,
      group_id: groupId,
      slug: "",
      label: "",
      icon: "check-circle-2",
      sort_order: maxSort + 10,
      is_published: true,
      isNew: true,
    });
  }

  function openEdit(row: AmenityCatalogRow) {
    setEditing({
      id: row.id,
      group_id: row.group_id,
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
      const res = await saveAmenity({
        id: editing.isNew ? undefined : editing.id,
        groupId: editing.group_id,
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
      const updated: AmenityCatalogRow = {
        id: res.id,
        group_id: editing.group_id,
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

  async function removeRow(row: AmenityCatalogRow) {
    const reason = await modal.prompt({
      title: `Delete "${row.label}"?`,
      description:
        "Hosts will no longer be able to select this amenity on their listings.",
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you deleting this?",
      minLength: 5,
      confirmLabel: "Delete amenity",
      intent: "destructive",
    });
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAmenity({ id: row.id, reason });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setList((prev) => prev.filter((r) => r.id !== row.id));
    });
  }

  const totalAmenities = list.length;
  const visibleAmenities = grouped.reduce((acc, g) => acc + g.rows.length, 0);
  const firstGroupId = groups[0]?.id ?? null;

  return (
    <div className="space-y-5">
      {/* ─── Toolbar ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search amenities by name or slug…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[12px] text-brand-mute">
            <span className="num font-semibold text-brand-ink">
              {query ? visibleAmenities : totalAmenities}
            </span>
            {query ? ` of ${totalAmenities}` : ""} amenit
            {totalAmenities === 1 ? "y" : "ies"}
          </div>
          {firstGroupId ? (
            <Button
              type="button"
              onClick={() => openNew(firstGroupId)}
              className="gap-1.5"
              size="sm"
            >
              <Plus className="h-4 w-4" /> Add amenity
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* ─── Groups ─── */}
      {groups.length === 0 ? (
        <EmptyState
          title="No amenity groups yet"
          body="Create a group first — every amenity belongs to a group like Essentials or Outdoor."
          actionHref="/admin/platform/amenities/groups"
          actionLabel="Manage groups"
        />
      ) : null}

      <div className="space-y-5">
        {grouped.map(({ group, rows }) => {
          const GroupIcon = resolveIcon(group.icon);
          return (
            <section
              key={group.id}
              className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card"
            >
              {/* Group header */}
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line bg-brand-light/40 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
                    <GroupIcon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <div className="font-display text-[15px] font-semibold text-brand-ink">
                      {group.label}
                      {!group.is_published ? (
                        <span className="ml-2 rounded-pill bg-brand-line/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11.5px] text-brand-mute">
                      {rows.length}{" "}
                      {rows.length === 1 ? "amenity" : "amenities"}
                      <span className="mx-1.5">·</span>
                      <span className="font-mono">{group.slug}</span>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openNew(group.id)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Add to {group.label}
                </Button>
              </header>

              {/* Rows */}
              {rows.length === 0 ? (
                <div className="px-5 py-10 text-center text-[13px] text-brand-mute">
                  {query
                    ? "No matches in this group."
                    : "No amenities here yet."}
                </div>
              ) : (
                <ul className="divide-y divide-brand-line">
                  {rows.map((r) => {
                    const Icon = resolveIcon(r.icon);
                    return (
                      <li
                        key={r.id}
                        className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-brand-light/40"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent/60 text-brand-secondary">
                          <Icon className="h-4 w-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-brand-ink">
                            {r.label}
                          </div>
                          <div className="truncate font-mono text-[11px] text-brand-mute">
                            {r.slug}
                          </div>
                        </div>

                        <div className="hidden items-center gap-3 text-[11px] text-brand-mute md:flex">
                          <span className="num">sort {r.sort_order}</span>
                          {r.is_published ? (
                            <span className="inline-flex items-center gap-1 rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-status-confirmed">
                              <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
                              Published
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-pill bg-brand-line/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                              Hidden
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="rounded-md border border-brand-line bg-white p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                            aria-label={`Edit ${r.label}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(r)}
                            disabled={pending}
                            className="rounded-md border border-red-100 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-50"
                            aria-label={`Delete ${r.label}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* ─── Edit / add sheet ─── */}
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
                  {editing.isNew ? "New amenity" : "Edit amenity"}
                </SheetTitle>
                <SheetDescription>
                  Shown to hosts in the listing editor and to guests on the
                  public listing detail page.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <FieldLabel label="Label">
                  <Input
                    autoFocus
                    value={editing.label}
                    onChange={(e) =>
                      setEditing({ ...editing, label: e.target.value })
                    }
                    placeholder="WiFi"
                  />
                </FieldLabel>

                <FieldLabel
                  label="Slug"
                  hint="Stable key — matches property_amenities.amenity_key. Auto-generated from the label if blank."
                >
                  <Input
                    value={editing.slug}
                    onChange={(e) =>
                      setEditing({ ...editing, slug: e.target.value })
                    }
                    placeholder="wifi"
                    className="font-mono text-[12px]"
                  />
                </FieldLabel>

                <FieldLabel label="Group">
                  <select
                    value={editing.group_id}
                    onChange={(e) =>
                      setEditing({ ...editing, group_id: e.target.value })
                    }
                    className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>

                <FieldLabel label="Icon">
                  <IconPicker
                    value={editing.icon}
                    onChange={(icon) => setEditing({ ...editing, icon })}
                  />
                </FieldLabel>

                <div className="grid grid-cols-2 gap-4">
                  <FieldLabel label="Sort order">
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
                  </FieldLabel>

                  <FieldLabel label="Visibility">
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
                  </FieldLabel>
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
                      ? "Create amenity"
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

function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="block text-[11px] leading-relaxed text-brand-mute">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <div className="rounded-md border border-brand-line bg-white p-2">
      <div className="grid max-h-44 grid-cols-7 gap-1 overflow-y-auto">
        {ICON_KEYS.map((name) => {
          const Icon = resolveIcon(name);
          const active = value === name;
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => onChange(name)}
              className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                active
                  ? "bg-brand-primary text-white"
                  : "bg-brand-light/40 text-brand-mute hover:bg-brand-accent hover:text-brand-secondary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-brand-mute">
        <span>Selected:</span>
        <code className="rounded bg-brand-light px-1.5 py-0.5 font-mono">
          {value}
        </code>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white/60 px-6 py-12 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="font-display text-lg font-semibold text-brand-ink">
        {title}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-brand-mute">
        {body}
      </p>
      <a
        href={actionHref}
        className="mt-4 inline-flex h-9 items-center rounded-md bg-brand-primary px-4 text-[13px] font-semibold text-white hover:bg-brand-secondary"
      >
        {actionLabel}
      </a>
    </div>
  );
}
