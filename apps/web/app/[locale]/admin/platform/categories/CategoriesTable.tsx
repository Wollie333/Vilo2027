"use client";

import {
  AlertCircle,
  Building2,
  Car,
  CheckCircle2,
  Coffee,
  DoorOpen,
  ExternalLink,
  Home,
  Hotel,
  House,
  Map,
  MoreHorizontal,
  Mountain,
  Palette,
  Pencil,
  Search,
  Sparkles,
  Tent,
  Trash2,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useMemo, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { modal } from "@/components/ui/modal-host";
import type { ListingCategoryRow } from "@/lib/taxonomy/types";

import { deleteCategory } from "./actions";

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  house: House,
  "building-2": Building2,
  hotel: Hotel,
  tent: Tent,
  coffee: Coffee,
  "door-open": DoorOpen,
  utensils: Utensils,
  sparkles: Sparkles,
  map: Map,
  mountain: Mountain,
  palette: Palette,
  car: Car,
  "more-horizontal": MoreHorizontal,
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? CheckCircle2;
}

type GroupedRow = {
  parent: ListingCategoryRow;
  children: ListingCategoryRow[];
};

function groupByParent(rows: ListingCategoryRow[]): GroupedRow[] {
  const roots = rows
    .filter((r) => r.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order);
  return roots.map((p) => ({
    parent: p,
    children: rows
      .filter((r) => r.parent_id === p.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export function CategoriesTable({ rows }: { rows: ListingCategoryRow[] }) {
  const [list, setList] = useState<ListingCategoryRow[]>(rows);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    // Keep parents whose label/slug matches AND their children; OR keep
    // children that match and include their parent for context.
    const matchedIds = new Set(
      list
        .filter(
          (r) =>
            r.label.toLowerCase().includes(q) ||
            r.slug.toLowerCase().includes(q),
        )
        .map((r) => r.id),
    );
    return list.filter((r) => {
      if (matchedIds.has(r.id)) return true;
      if (r.parent_id && matchedIds.has(r.parent_id)) return true;
      // Include parent of any matched child.
      const hasMatchedChild = list.some(
        (other) => other.parent_id === r.id && matchedIds.has(other.id),
      );
      return hasMatchedChild;
    });
  }, [list, query]);

  const groups = useMemo(() => groupByParent(filteredList), [filteredList]);
  const totalCategories = groups.reduce((acc, g) => acc + g.children.length, 0);

  async function removeRow(row: ListingCategoryRow) {
    const isParent = list.some((r) => r.parent_id === row.id);
    if (isParent) {
      await modal.warning({
        title: "Can't delete this category",
        description:
          "This category has child categories. Delete or reparent the children first.",
      });
      return;
    }
    const reason = await modal.prompt({
      title: `Delete "${row.label}"?`,
      description:
        "This removes the category from the host wizard, the browse filter and its landing page.",
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you deleting this?",
      minLength: 5,
      confirmLabel: "Delete category",
      intent: "destructive",
    });
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCategory({ id: row.id, reason });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setList((prev) => prev.filter((r) => r.id !== row.id));
    });
  }

  const totalLeaves = list.filter((r) => r.parent_id !== null).length;
  const visibleLeaves = filteredList.filter((r) => r.parent_id !== null).length;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories by label or slug…"
            className="pl-9"
          />
        </div>
        <div className="text-[12px] text-brand-mute">
          <span className="num font-semibold text-brand-ink">
            {query ? visibleLeaves : totalLeaves}
          </span>
          {query ? ` of ${totalLeaves}` : ""} categor
          {totalLeaves === 1 ? "y" : "ies"}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line bg-brand-light/40 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
              <Building2 className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="font-display text-[15px] font-semibold text-brand-ink">
                Accommodation
              </div>
              <div className="text-[11.5px] text-brand-mute">
                {totalCategories} categories across {groups.length} root
                {groups.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </header>

        {groups.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-brand-mute">
            {query ? "No matches in this section." : "No categories yet."}
          </div>
        ) : null}

        {groups.map(({ parent, children }) => {
          const ParentIcon = resolveIcon(parent.icon);
          return (
            <div
              key={parent.id}
              className="border-t border-brand-line first:border-t-0"
            >
              {/* Parent row */}
              <Row
                row={parent}
                isParent
                icon={ParentIcon}
                pending={pending}
                onDelete={removeRow}
              />

              {/* Children */}
              {children.length === 0 ? (
                <div className="px-5 py-3 pl-16 text-[12px] italic text-brand-mute">
                  No sub-categories under {parent.label}.
                </div>
              ) : (
                <div className="divide-y divide-brand-line">
                  {children.map((c) => {
                    const Icon = resolveIcon(c.icon);
                    return (
                      <Row
                        key={c.id}
                        row={c}
                        isParent={false}
                        icon={Icon}
                        pending={pending}
                        onDelete={removeRow}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Row({
  row,
  isParent,
  icon: Icon,
  pending,
  onDelete,
}: {
  row: ListingCategoryRow;
  isParent: boolean;
  icon: LucideIcon;
  pending: boolean;
  onDelete: (row: ListingCategoryRow) => void;
}) {
  return (
    <div
      className={`group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-brand-light/40 ${
        isParent ? "bg-brand-accent/15" : "pl-14"
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full ${
          isParent
            ? "h-9 w-9 bg-brand-secondary/15 text-brand-secondary"
            : "h-8 w-8 bg-brand-accent/60 text-brand-secondary"
        }`}
      >
        <Icon className={isParent ? "h-4.5 w-4.5" : "h-4 w-4"} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`truncate text-[13.5px] ${
              isParent
                ? "font-semibold text-brand-ink"
                : "font-medium text-brand-ink"
            }`}
          >
            {row.label}
          </span>
          {isParent ? (
            <span className="rounded-pill bg-brand-line/60 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-brand-mute">
              Root
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-brand-mute">
          <span className="font-mono">/{row.slug}</span>
          <span className="num">sort {row.sort_order}</span>
          {row.meta_title ? (
            <span className="hidden truncate sm:inline-block sm:max-w-[18ch]">
              SEO: {row.meta_title}
            </span>
          ) : (
            <span className="hidden italic sm:inline">SEO auto from label</span>
          )}
        </div>
        {row.description ? (
          <div className="mt-0.5 line-clamp-1 text-[11.5px] text-brand-mute">
            {row.description}
          </div>
        ) : null}
      </div>

      {row.is_published ? (
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
        {row.is_published ? (
          <Link
            href={`/c/${row.slug}`}
            target="_blank"
            className="rounded-md border border-brand-line bg-white p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink"
            aria-label={`Preview /c/${row.slug}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
        <Link
          href={`/admin/platform/categories/${row.id}`}
          className="rounded-md bg-brand-primary px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-secondary"
        >
          <Pencil className="inline h-3.5 w-3.5" />
          <span className="ml-1 hidden sm:inline">Edit</span>
        </Link>
        <button
          type="button"
          onClick={() => onDelete(row)}
          disabled={pending}
          className="rounded-md border border-red-100 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-50"
          aria-label={`Delete ${row.label}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
