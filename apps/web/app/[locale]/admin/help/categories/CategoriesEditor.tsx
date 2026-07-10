"use client";

import { AlertCircle, Plus, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { modal } from "@/components/ui/modal-host";
import { HELP_ICON_CHOICES, resolveHelpIcon } from "@/lib/help/icon-map";
import type { HelpAudience, HelpCategoryRow } from "@/lib/help/types";

import { deleteHelpCategory, saveHelpCategory } from "./actions";

type Row = Pick<
  HelpCategoryRow,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "icon"
  | "audience"
  | "sort_order"
  | "is_published"
> & { __dirty?: boolean; __new?: boolean };

export function CategoriesEditor({ rows }: { rows: Row[] }) {
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
        : `tmp-${Date.now()}`;
    setList((prev) => [
      ...prev,
      {
        id,
        slug: "",
        name: "",
        description: "",
        icon: "book-open",
        audience: "both",
        sort_order: 100 + prev.length * 10,
        is_published: true,
        __dirty: true,
        __new: true,
      },
    ]);
  }

  function saveRow(row: Row) {
    setError(null);
    startTransition(async () => {
      const res = await saveHelpCategory({
        id: row.__new ? undefined : row.id,
        slug: row.slug || undefined,
        name: row.name,
        description: row.description ?? undefined,
        icon: row.icon,
        audience: row.audience,
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

  async function removeRow(row: Row) {
    if (row.__new) {
      setList((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }
    const reason = await modal.prompt({
      title: "Delete this help category?",
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you deleting this?",
      minLength: 5,
      confirmLabel: "Delete category",
      intent: "destructive",
    });
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteHelpCategory({ id: row.id, reason });
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
          <thead className="border-b border-brand-line text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
            <tr>
              <th className="w-12 px-4 py-2 text-left">Icon</th>
              <th className="px-4 py-2 text-left">Name &amp; slug</th>
              <th className="hidden px-4 py-2 text-left lg:table-cell">
                Description
              </th>
              <th className="w-32 px-4 py-2 text-left">Audience</th>
              <th className="w-24 px-4 py-2 text-left">Sort</th>
              <th className="w-32 px-4 py-2 text-left">Visibility</th>
              <th className="w-32 px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {list.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-brand-mute"
                >
                  No categories yet. Add one to begin.
                </td>
              </tr>
            ) : null}
            {list.map((r) => {
              const Icon = resolveHelpIcon(r.icon);
              return (
                <tr key={r.id} className={r.__dirty ? "bg-amber-50/40" : ""}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-accent text-brand-secondary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <select
                        value={r.icon}
                        onChange={(e) => update(r.id, { icon: e.target.value })}
                        className="rounded border border-brand-line bg-white px-1 py-1 text-[11px]"
                      >
                        {HELP_ICON_CHOICES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={r.name}
                      onChange={(e) => update(r.id, { name: e.target.value })}
                      placeholder="Bookings & reservations"
                      className="block w-full rounded border border-brand-line bg-white px-2 py-1 text-sm font-medium text-brand-ink focus:border-brand-primary focus:outline-none"
                    />
                    <input
                      value={r.slug}
                      onChange={(e) => update(r.id, { slug: e.target.value })}
                      placeholder="bookings"
                      className="mt-1 block w-full rounded border border-brand-line bg-white px-2 py-1 font-mono text-[11px] text-brand-mute focus:border-brand-primary focus:outline-none"
                    />
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <textarea
                      value={r.description ?? ""}
                      onChange={(e) =>
                        update(r.id, { description: e.target.value })
                      }
                      placeholder="One-line tagline shown on the tile."
                      rows={2}
                      className="block w-full rounded border border-brand-line bg-white px-2 py-1 text-[12.5px] text-brand-mute focus:border-brand-primary focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r.audience}
                      onChange={(e) =>
                        update(r.id, {
                          audience: e.target.value as HelpAudience,
                        })
                      }
                      className="block w-full rounded border border-brand-line bg-white px-2 py-1 text-sm capitalize"
                    >
                      <option value="host">host</option>
                      <option value="guest">guest</option>
                      <option value="both">both</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={r.sort_order}
                      onChange={(e) =>
                        update(r.id, { sort_order: Number(e.target.value) })
                      }
                      className="num block w-full rounded border border-brand-line bg-white px-2 py-1 font-mono text-sm"
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
                        disabled={pending || !r.__dirty || !r.name.trim()}
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
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded border border-dashed border-brand-primary px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-accent/40"
      >
        <Plus className="h-4 w-4" /> Add category
      </button>
    </div>
  );
}
