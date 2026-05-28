"use client";

import { AlertCircle, ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import type { CategoryKind, ListingCategoryRow } from "@/lib/taxonomy/types";

import { deleteCategory } from "./actions";

type GroupedRow = {
  parent: ListingCategoryRow;
  children: ListingCategoryRow[];
};

function groupByParent(rows: ListingCategoryRow[]): {
  accommodation: GroupedRow[];
  experience: GroupedRow[];
} {
  const byKind: Record<CategoryKind, ListingCategoryRow[]> = {
    accommodation: [],
    experience: [],
  };
  for (const r of rows) byKind[r.kind].push(r);

  const grouped = (kind: CategoryKind): GroupedRow[] => {
    const list = byKind[kind];
    const roots = list
      .filter((r) => r.parent_id === null)
      .sort((a, b) => a.sort_order - b.sort_order);
    return roots.map((p) => ({
      parent: p,
      children: list
        .filter((r) => r.parent_id === p.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));
  };

  return {
    accommodation: grouped("accommodation"),
    experience: grouped("experience"),
  };
}

export function CategoriesTable({ rows }: { rows: ListingCategoryRow[] }) {
  const [list, setList] = useState<ListingCategoryRow[]>(rows);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => groupByParent(list), [list]);

  function removeRow(row: ListingCategoryRow) {
    const isParent = list.some((r) => r.parent_id === row.id);
    if (isParent) {
      window.alert(
        "This category has child categories. Delete or reparent the children first.",
      );
      return;
    }
    const reason = window.prompt("Reason for deleting (min 5 chars):");
    if (!reason || reason.trim().length < 5) return;
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

  return (
    <div className="space-y-8">
      {error ? (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {(["accommodation", "experience"] as const).map((kind) => (
        <section key={kind} className="space-y-3">
          <h2 className="font-display text-base font-semibold capitalize text-brand-ink">
            {kind === "accommodation" ? "Accommodation" : "Experiences"}
          </h2>

          {groups[kind].length === 0 ? (
            <div className="rounded-card border border-dashed border-brand-line bg-white/60 px-6 py-8 text-center text-sm text-brand-mute">
              No {kind} categories yet.
            </div>
          ) : null}

          {groups[kind].map(({ parent, children }) => (
            <div
              key={parent.id}
              className="overflow-hidden rounded-card border border-brand-line bg-white"
            >
              <table className="w-full table-fixed text-sm">
                <thead className="bg-brand-light/60 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  <tr>
                    <th className="w-[28%] px-4 py-2 text-left">Category</th>
                    <th className="w-[18%] px-4 py-2 text-left">Slug</th>
                    <th className="w-[24%] px-4 py-2 text-left">SEO title</th>
                    <th className="w-16 px-4 py-2 text-left">Sort</th>
                    <th className="w-24 px-4 py-2 text-left">Visibility</th>
                    <th className="w-40 px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-line">
                  <CategoryRow
                    row={parent}
                    isParent
                    pending={pending}
                    onDelete={removeRow}
                  />
                  {children.map((c) => (
                    <CategoryRow
                      key={c.id}
                      row={c}
                      isParent={false}
                      pending={pending}
                      onDelete={removeRow}
                    />
                  ))}
                  {children.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-4 text-[12px] text-brand-mute"
                      >
                        No sub-categories. Add one to break this root into
                        sub-types.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function CategoryRow({
  row,
  isParent,
  pending,
  onDelete,
}: {
  row: ListingCategoryRow;
  isParent: boolean;
  pending: boolean;
  onDelete: (row: ListingCategoryRow) => void;
}) {
  return (
    <tr className={isParent ? "bg-brand-accent/20" : ""}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {!isParent ? <span className="text-brand-mute">↳</span> : null}
          <span
            className={`text-[13.5px] ${
              isParent
                ? "font-semibold text-brand-ink"
                : "font-medium text-brand-ink"
            }`}
          >
            {row.label}
          </span>
        </div>
        {row.description ? (
          <div className="mt-0.5 line-clamp-1 text-[11.5px] text-brand-mute">
            {row.description}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 font-mono text-[11.5px] text-brand-mute">
        {row.slug}
      </td>
      <td className="px-4 py-3 text-[12.5px] text-brand-mute">
        {row.meta_title ? (
          <span className="line-clamp-1">{row.meta_title}</span>
        ) : (
          <span className="italic text-brand-mute/60">Auto from label</span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-[12px] text-brand-mute">
        {row.sort_order}
      </td>
      <td className="px-4 py-3">
        {row.is_published ? (
          <span className="inline-flex items-center rounded bg-status-confirmed/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-status-confirmed">
            Published
          </span>
        ) : (
          <span className="inline-flex items-center rounded bg-brand-line/60 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-brand-mute">
            Hidden
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          {row.is_published ? (
            <Link
              href={`/c/${row.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-2 py-1 text-[11px] font-semibold text-brand-mute hover:bg-brand-light"
            >
              <ExternalLink className="h-3 w-3" /> View
            </Link>
          ) : null}
          <Link
            href={`/admin/platform/categories/${row.id}`}
            className="inline-flex items-center gap-1 rounded bg-brand-primary px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-secondary"
          >
            <Pencil className="h-3 w-3" /> Edit
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => onDelete(row)}
            className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}
