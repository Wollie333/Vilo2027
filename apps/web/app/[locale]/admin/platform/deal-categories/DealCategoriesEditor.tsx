"use client";

import {
  AlertCircle,
  Briefcase,
  Clock,
  Heart,
  Mountain,
  PartyPopper,
  Plus,
  Save,
  Sparkles,
  Sun,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, useTransition } from "react";

import { deleteDealCategory, saveDealCategory } from "./actions";

// Icon choices for deal categories
const ICON_CHOICES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "Heart", label: "Heart", icon: Heart },
  { value: "Users", label: "Users", icon: Users },
  { value: "Clock", label: "Clock", icon: Clock },
  { value: "PartyPopper", label: "Party", icon: PartyPopper },
  { value: "Briefcase", label: "Briefcase", icon: Briefcase },
  { value: "Sparkles", label: "Sparkles", icon: Sparkles },
  { value: "Mountain", label: "Mountain", icon: Mountain },
  { value: "Sun", label: "Sun", icon: Sun },
];

function resolveIcon(name: string | null): LucideIcon {
  const found = ICON_CHOICES.find((c) => c.value === name);
  return found?.icon ?? Sparkles;
}

export type DealCategoryRow = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  meta_title: string | null;
  meta_description: string | null;
};

type Row = DealCategoryRow & { __dirty?: boolean; __new?: boolean };

export function DealCategoriesEditor({ rows }: { rows: DealCategoryRow[] }) {
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
        key: "",
        label: "",
        description: null,
        icon: "Sparkles",
        sort_order: 100 + prev.length * 10,
        is_active: true,
        meta_title: null,
        meta_description: null,
        __dirty: true,
        __new: true,
      },
    ]);
  }

  function saveRow(row: Row) {
    setError(null);
    startTransition(async () => {
      const res = await saveDealCategory({
        id: row.__new ? undefined : row.id,
        key: row.key || undefined,
        label: row.label,
        description: row.description,
        icon: row.icon,
        sortOrder: row.sort_order,
        isActive: row.is_active,
        metaTitle: row.meta_title,
        metaDescription: row.meta_description,
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
      const res = await deleteDealCategory({ id: row.id, reason });
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
              <th className="w-16 px-4 py-2 text-left">Icon</th>
              <th className="px-4 py-2 text-left">Label &amp; key</th>
              <th className="hidden px-4 py-2 text-left lg:table-cell">
                Description
              </th>
              <th className="w-24 px-4 py-2 text-left">Sort</th>
              <th className="w-32 px-4 py-2 text-left">Status</th>
              <th className="w-32 px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {list.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-brand-mute"
                >
                  No deal categories yet. Add one to begin.
                </td>
              </tr>
            ) : null}
            {list.map((r) => {
              const Icon = resolveIcon(r.icon);
              return (
                <tr key={r.id} className={r.__dirty ? "bg-amber-50/40" : ""}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-accent text-brand-secondary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <select
                        value={r.icon ?? "Sparkles"}
                        onChange={(e) => update(r.id, { icon: e.target.value })}
                        className="rounded border border-brand-line bg-white px-1 py-1 text-[11px]"
                      >
                        {ICON_CHOICES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={r.label}
                      onChange={(e) => update(r.id, { label: e.target.value })}
                      placeholder="Romantic getaway"
                      className="block w-full rounded border border-brand-line bg-white px-2 py-1 text-sm font-medium text-brand-ink focus:border-brand-primary focus:outline-none"
                    />
                    <input
                      value={r.key}
                      onChange={(e) => update(r.id, { key: e.target.value })}
                      placeholder="romantic"
                      className="mt-1 block w-full rounded border border-brand-line bg-white px-2 py-1 font-mono text-[11px] text-brand-mute focus:border-brand-primary focus:outline-none"
                    />
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <textarea
                      value={r.description ?? ""}
                      onChange={(e) =>
                        update(r.id, { description: e.target.value || null })
                      }
                      placeholder="Short description for hosts and SEO."
                      rows={2}
                      className="block w-full rounded border border-brand-line bg-white px-2 py-1 text-[12.5px] text-brand-mute focus:border-brand-primary focus:outline-none"
                    />
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
                        checked={r.is_active}
                        onChange={(e) =>
                          update(r.id, { is_active: e.target.checked })
                        }
                        className="rounded border-brand-line"
                      />
                      Active
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
