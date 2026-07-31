"use client";

import {
  AlertCircle,
  LifeBuoy,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
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
> & { __new?: boolean };

const AUDIENCE_LABEL: Record<HelpAudience, string> = {
  host: "Hosts",
  guest: "Guests",
  both: "Everyone",
};

export function CategoriesEditor({ rows }: { rows: Row[] }) {
  const [list, setList] = useState<Row[]>(rows);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q),
    );
  }, [list, query]);

  const total = list.length;
  const published = list.filter((r) => r.is_published).length;

  function beginEdit(row: Row) {
    setError(null);
    setDraft({ ...row });
    setEditingId(row.id);
  }

  function cancelEdit() {
    if (draft?.__new) {
      setList((prev) => prev.filter((r) => r.id !== draft.id));
    }
    setEditingId(null);
    setDraft(null);
    setError(null);
  }

  function addRow() {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tmp-${list.length}`;
    const row: Row = {
      id,
      slug: "",
      name: "",
      description: "",
      icon: "book-open",
      audience: "both",
      sort_order: 100 + list.length * 10,
      is_published: true,
      __new: true,
    };
    setList((prev) => [...prev, row]);
    beginEdit(row);
  }

  function patchDraft(patch: Partial<Row>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError("Enter a name for the category.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveHelpCategory({
        id: draft.__new ? undefined : draft.id,
        slug: draft.slug || undefined,
        name: draft.name,
        description: draft.description ?? undefined,
        icon: draft.icon,
        audience: draft.audience,
        sortOrder: draft.sort_order,
        isPublished: draft.is_published,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const saved: Row = { ...draft, id: res.id, __new: false };
      setList((prev) => prev.map((r) => (r.id === draft.id ? saved : r)));
      setEditingId(null);
      setDraft(null);
    });
  }

  async function removeRow(row: Row) {
    if (row.__new) {
      setList((prev) => prev.filter((r) => r.id !== row.id));
      if (editingId === row.id) cancelEdit();
      return;
    }
    const reason = await modal.prompt({
      title: `Delete "${row.name}"?`,
      description:
        "This removes the category from the help centre. Articles in it are not deleted, but lose their category.",
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
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories by name or slug…"
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-brand-primary px-3.5 text-[13px] font-semibold text-white hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" />
          Add category
        </button>
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
              <LifeBuoy className="h-[18px] w-[18px]" />
            </span>
            <div>
              <div className="font-display text-[15px] font-semibold text-brand-ink">
                Help centre
              </div>
              <div className="text-[11.5px] text-brand-mute">
                {total} categor{total === 1 ? "y" : "ies"} · {published}{" "}
                published
              </div>
            </div>
          </div>
        </header>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-brand-mute">
            {query ? "No matches." : "No categories yet. Add one to begin."}
          </div>
        ) : (
          <div className="divide-y divide-brand-line">
            {filtered.map((row) =>
              editingId === row.id && draft ? (
                <EditPanel
                  key={row.id}
                  draft={draft}
                  pending={pending}
                  onPatch={patchDraft}
                  onSave={saveDraft}
                  onCancel={cancelEdit}
                />
              ) : (
                <DisplayRow
                  key={row.id}
                  row={row}
                  pending={pending}
                  onEdit={() => beginEdit(row)}
                  onDelete={() => removeRow(row)}
                />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function DisplayRow({
  row,
  pending,
  onEdit,
  onDelete,
}: {
  row: Row;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = resolveHelpIcon(row.icon);
  return (
    <div className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-brand-light/40">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-secondary/15 text-brand-secondary">
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-brand-ink">
          {row.name || (
            <span className="italic text-brand-mute">Untitled category</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-brand-mute">
          <span className="font-mono">/{row.slug || "…"}</span>
          <span className="num">sort {row.sort_order}</span>
          <span>{AUDIENCE_LABEL[row.audience]}</span>
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
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md bg-brand-primary px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-secondary"
        >
          <Pencil className="inline h-3.5 w-3.5" />
          <span className="ml-1 hidden sm:inline">Edit</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="rounded-md border border-red-100 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-50"
          aria-label={`Delete ${row.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function EditPanel({
  draft,
  pending,
  onPatch,
  onSave,
  onCancel,
}: {
  draft: Row;
  pending: boolean;
  onPatch: (patch: Partial<Row>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const Icon = resolveHelpIcon(draft.icon);
  const fieldCls =
    "w-full rounded-md border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary";
  const labelCls =
    "text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute";
  return (
    <div className="bg-brand-accent/10 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input
            value={draft.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="Bookings & reservations"
            className={`mt-1 ${fieldCls} font-medium`}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Slug</span>
          <input
            value={draft.slug}
            onChange={(e) => onPatch({ slug: e.target.value })}
            placeholder="bookings"
            className={`mt-1 ${fieldCls} font-mono text-[12px]`}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelCls}>Description</span>
          <textarea
            value={draft.description ?? ""}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="One-line tagline shown on the tile."
            rows={2}
            className={`mt-1 ${fieldCls}`}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Icon</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <select
              value={draft.icon}
              onChange={(e) => onPatch({ icon: e.target.value })}
              className={fieldCls}
            >
              {HELP_ICON_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="block">
          <span className={labelCls}>Audience</span>
          <select
            value={draft.audience}
            onChange={(e) =>
              onPatch({ audience: e.target.value as HelpAudience })
            }
            className={`mt-1 ${fieldCls}`}
          >
            <option value="host">Hosts</option>
            <option value="guest">Guests</option>
            <option value="both">Everyone</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Sort order</span>
          <input
            type="number"
            value={draft.sort_order}
            onChange={(e) => onPatch({ sort_order: Number(e.target.value) })}
            className={`mt-1 ${fieldCls} num font-mono`}
          />
        </label>
        <label className="flex items-center gap-2 pt-6 text-[13px] text-brand-ink">
          <input
            type="checkbox"
            checked={draft.is_published}
            onChange={(e) => onPatch({ is_published: e.target.checked })}
            className="h-4 w-4 accent-brand-primary"
          />
          Published (visible on /help)
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !draft.name.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-primary px-3.5 text-[13px] font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-mute hover:bg-brand-light disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}
