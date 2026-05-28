"use client";

import { AlertCircle, Plus, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import type { AmenityGroupRow } from "@/lib/taxonomy/types";

import { deleteAmenityGroup, saveAmenityGroup } from "./actions";

type Row = AmenityGroupRow & { __dirty?: boolean; __new?: boolean };

const GROUP_ICONS = [
  "sparkles",
  "check-circle-2",
  "tree-pine",
  "baby",
  "shield-check",
  "accessibility",
  "home",
  "utensils",
  "waves",
  "flame",
];

export function GroupsEditor({ rows }: { rows: AmenityGroupRow[] }) {
  const [list, setList] = useState<Row[]>(rows);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(id: string, patch: Partial<Row>) {
    setList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch, __dirty: true } : r)),
    );
  }

  function addRow() {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tmp-${Math.random()}`;
    setList((prev) => [
      ...prev,
      {
        id,
        slug: "",
        label: "",
        icon: "sparkles",
        sort_order: 100 + prev.length * 10,
        is_published: true,
        created_at: "",
        updated_at: "",
        deleted_at: null,
        __dirty: true,
        __new: true,
      },
    ]);
  }

  function saveRow(row: Row) {
    setError(null);
    startTransition(async () => {
      const res = await saveAmenityGroup({
        id: row.__new ? undefined : row.id,
        slug: row.slug || undefined,
        label: row.label,
        icon: row.icon,
        sortOrder: row.sort_order,
        isPublished: row.is_published,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setList((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, id: res.id, __dirty: false, __new: false }
            : r,
        ),
      );
    });
  }

  function removeRow(row: Row) {
    if (row.__new) {
      setList((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }
    const reason = window.prompt("Reason for deleting (min 5 chars):");
    if (!reason || reason.trim().length < 5) return;
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

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-card border border-brand-line bg-white">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-brand-light/60 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            <tr>
              <th className="w-16 px-4 py-2 text-left">Icon</th>
              <th className="px-4 py-2 text-left">Label &amp; slug</th>
              <th className="w-20 px-4 py-2 text-left">Sort</th>
              <th className="w-32 px-4 py-2 text-left">Visibility</th>
              <th className="w-28 px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {list.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-brand-mute"
                >
                  No amenity groups yet. Add one to begin.
                </td>
              </tr>
            ) : null}
            {list.map((r) => (
              <tr key={r.id} className={r.__dirty ? "bg-amber-50/40" : ""}>
                <td className="px-4 py-3">
                  <select
                    value={r.icon}
                    onChange={(e) => update(r.id, { icon: e.target.value })}
                    className="rounded border border-brand-line bg-white px-1 py-1 text-[11px]"
                  >
                    {GROUP_ICONS.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    value={r.label}
                    onChange={(e) => update(r.id, { label: e.target.value })}
                    placeholder="Essentials"
                    className="block w-full rounded border border-brand-line bg-white px-2 py-1 text-sm font-medium text-brand-ink"
                  />
                  <input
                    value={r.slug}
                    onChange={(e) => update(r.id, { slug: e.target.value })}
                    placeholder="essentials (auto if blank)"
                    className="mt-1 block w-full rounded border border-brand-line bg-white px-2 py-1 font-mono text-[11px] text-brand-mute"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={r.sort_order}
                    onChange={(e) =>
                      update(r.id, { sort_order: Number(e.target.value) })
                    }
                    className="block w-full rounded border border-brand-line bg-white px-2 py-1 font-mono text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={r.is_published}
                      onChange={(e) =>
                        update(r.id, { is_published: e.target.checked })
                      }
                      className="rounded border-brand-line"
                    />
                    Published
                  </label>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={pending || !r.__dirty || !r.label.trim()}
                      onClick={() => saveRow(r)}
                      className="inline-flex items-center gap-1 rounded bg-brand-primary px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" /> Save
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => removeRow(r)}
                      className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded border border-dashed border-brand-primary px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-accent/40"
      >
        <Plus className="h-4 w-4" /> Add group
      </button>
    </div>
  );
}
