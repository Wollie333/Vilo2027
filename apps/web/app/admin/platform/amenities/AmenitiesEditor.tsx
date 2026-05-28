"use client";

import { AlertCircle, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import type { AmenityCatalogRow, AmenityGroupRow } from "@/lib/taxonomy/types";

import { deleteAmenity, saveAmenity } from "./actions";

type Row = AmenityCatalogRow & { __dirty?: boolean; __new?: boolean };

const ICON_OPTIONS = [
  "wifi",
  "utensils",
  "square-parking",
  "wind",
  "flame",
  "tv",
  "shirt",
  "laptop",
  "key-round",
  "user-check",
  "waves",
  "bath",
  "utensils-crossed",
  "users",
  "paw-print",
  "bell-ring",
  "cross",
  "accessibility",
  "tree-pine",
  "sparkles",
  "check-circle-2",
];

export function AmenitiesEditor({
  groups,
  items,
}: {
  groups: AmenityGroupRow[];
  items: AmenityCatalogRow[];
}) {
  const [list, setList] = useState<Row[]>(items);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    return groups.map((g) => ({
      group: g,
      rows: list
        .filter((r) => r.group_id === g.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));
  }, [groups, list]);

  function update(id: string, patch: Partial<Row>) {
    setList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch, __dirty: true } : r)),
    );
  }

  function addRow(groupId: string) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tmp-${Math.random()}`;
    const maxSort = list
      .filter((r) => r.group_id === groupId)
      .reduce((m, r) => Math.max(m, r.sort_order), 0);
    setList((prev) => [
      ...prev,
      {
        id,
        group_id: groupId,
        slug: "",
        label: "",
        icon: "check-circle-2",
        sort_order: maxSort + 10,
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
      const res = await saveAmenity({
        id: row.__new ? undefined : row.id,
        groupId: row.group_id,
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
      const res = await deleteAmenity({ id: row.id, reason });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setList((prev) => prev.filter((r) => r.id !== row.id));
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white/60 px-6 py-10 text-center text-sm text-brand-mute">
          No amenity groups yet. Create one first.
        </div>
      ) : null}

      {grouped.map(({ group, rows }) => (
        <section
          key={group.id}
          className="space-y-3 rounded-card border border-brand-line bg-white p-4"
        >
          <header className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-brand-ink">
              {group.label}
              {!group.is_published ? (
                <span className="ml-2 text-[11px] font-normal italic text-brand-mute">
                  (group hidden)
                </span>
              ) : null}
            </h2>
            <button
              type="button"
              onClick={() => addRow(group.id)}
              className="inline-flex items-center gap-1 rounded border border-dashed border-brand-primary px-2.5 py-1 text-[12px] font-medium text-brand-primary hover:bg-brand-accent/40"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </header>

          <table className="w-full table-fixed text-sm">
            <thead className="bg-brand-light/60 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              <tr>
                <th className="w-12 px-3 py-2 text-left">Icon</th>
                <th className="px-3 py-2 text-left">Label &amp; slug</th>
                <th className="w-20 px-3 py-2 text-left">Sort</th>
                <th className="w-32 px-3 py-2 text-left">Visibility</th>
                <th className="w-28 px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-[12px] text-brand-mute"
                  >
                    No amenities in this group yet.
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.id} className={r.__dirty ? "bg-amber-50/40" : ""}>
                  <td className="px-3 py-2">
                    <select
                      value={r.icon}
                      onChange={(e) => update(r.id, { icon: e.target.value })}
                      className="rounded border border-brand-line bg-white px-1 py-1 text-[11px]"
                    >
                      {ICON_OPTIONS.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={r.label}
                      onChange={(e) => update(r.id, { label: e.target.value })}
                      placeholder="WiFi"
                      className="block w-full rounded border border-brand-line bg-white px-2 py-1 text-sm font-medium text-brand-ink"
                    />
                    <input
                      value={r.slug}
                      onChange={(e) => update(r.id, { slug: e.target.value })}
                      placeholder="wifi (auto if blank)"
                      className="mt-1 block w-full rounded border border-brand-line bg-white px-2 py-1 font-mono text-[11px] text-brand-mute"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={r.sort_order}
                      onChange={(e) =>
                        update(r.id, { sort_order: Number(e.target.value) })
                      }
                      className="block w-full rounded border border-brand-line bg-white px-2 py-1 font-mono text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-[12px]">
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
                  <td className="px-3 py-2 text-right">
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
        </section>
      ))}
    </div>
  );
}
