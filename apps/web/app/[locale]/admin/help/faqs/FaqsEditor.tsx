"use client";

import { AlertCircle, Plus, Save, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

import { useBrandName } from "@/components/brand/BrandProvider";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { modal } from "@/components/ui/modal-host";
import type {
  HelpAudience,
  HelpCategoryRow,
  HelpFaqRow,
} from "@/lib/help/types";

import { HelpReorderList } from "../_components/HelpReorderList";
import { deleteHelpFaq, reorderHelpFaqs, saveHelpFaq } from "./actions";

type Row = Pick<
  HelpFaqRow,
  | "id"
  | "question"
  | "answer_html"
  | "category_id"
  | "audience"
  | "is_featured"
  | "sort_order"
  | "is_published"
> & { __dirty?: boolean; __new?: boolean };

type Props = {
  rows: Row[];
  categories: Pick<HelpCategoryRow, "id" | "name">[];
};

export function FaqsEditor({ rows, categories }: Props) {
  const brandName = useBrandName();
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
        question: "",
        answer_html: "<p></p>",
        category_id: null,
        audience: "both",
        is_featured: false,
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
      const res = await saveHelpFaq({
        id: row.__new ? undefined : row.id,
        question: row.question,
        answerHtml: row.answer_html,
        categoryId: row.category_id,
        audience: row.audience,
        isFeatured: row.is_featured,
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

  function handleReorder(next: Row[]) {
    setList(next);
    setError(null);
    const ids = next.filter((r) => !r.__new).map((r) => r.id);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await reorderHelpFaqs(ids);
      if (!res.ok) setError(res.error);
    });
  }

  async function removeRow(row: Row) {
    if (row.__new) {
      setList((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }
    const reason = await modal.prompt({
      title: "Delete this FAQ?",
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you deleting this?",
      minLength: 5,
      confirmLabel: "Delete FAQ",
      intent: "destructive",
    });
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteHelpFaq({ id: row.id, reason });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setList((prev) => prev.filter((r) => r.id !== row.id));
    });
  }

  // Drag-reorder once every row is saved (a half-added row has no db id yet).
  const canReorder = !list.some((r) => r.__new);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {list.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white px-5 py-10 text-center text-sm text-brand-mute">
          No FAQs yet — add one to begin.
        </div>
      ) : canReorder ? (
        <div className="space-y-3">
          <HelpReorderList items={list} onReorder={handleReorder}>
            {(r, _i, handle) => (
              <FaqCard
                r={r}
                handle={handle}
                brandName={brandName}
                categories={categories}
                pending={pending}
                update={update}
                saveRow={saveRow}
                removeRow={removeRow}
              />
            )}
          </HelpReorderList>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <FaqCard
              key={r.id}
              r={r}
              brandName={brandName}
              categories={categories}
              pending={pending}
              update={update}
              saveRow={saveRow}
              removeRow={removeRow}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded border border-dashed border-brand-primary px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-accent/40"
      >
        <Plus className="h-4 w-4" /> Add FAQ
      </button>
    </div>
  );
}

function FaqCard({
  r,
  handle,
  brandName,
  categories,
  pending,
  update,
  saveRow,
  removeRow,
}: {
  r: Row;
  handle?: ReactNode;
  brandName: string;
  categories: Pick<HelpCategoryRow, "id" | "name">[];
  pending: boolean;
  update: (id: string, patch: Partial<Row>) => void;
  saveRow: (row: Row) => void;
  removeRow: (row: Row) => void;
}) {
  return (
    <div
      className={`rounded-card border bg-white p-4 ${r.__dirty ? "border-amber-300 bg-amber-50/40" : "border-brand-line"}`}
    >
      {handle ? (
        <div className="mb-2 flex items-center gap-1 text-[11px] text-brand-mute">
          {handle}
          <span>Drag to reorder</span>
        </div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <div className="space-y-2">
          <input
            value={r.question}
            onChange={(e) => update(r.id, { question: e.target.value })}
            placeholder={`How long does ${brandName} take to pay out?`}
            className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink focus:border-brand-primary focus:outline-none"
          />
          <RichTextEditor
            value={r.answer_html}
            onChange={(html) => update(r.id, { answer_html: html })}
            placeholder="Payouts release 24 hours after check-in…"
          />
        </div>
        <div className="space-y-2 text-sm">
          <SelectField label="Category">
            <select
              value={r.category_id ?? ""}
              onChange={(e) =>
                update(r.id, { category_id: e.target.value || null })
              }
              className="w-full rounded border border-brand-line bg-white px-2 py-1 text-sm"
            >
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </SelectField>
          <SelectField label="Audience">
            <select
              value={r.audience}
              onChange={(e) =>
                update(r.id, { audience: e.target.value as HelpAudience })
              }
              className="w-full rounded border border-brand-line bg-white px-2 py-1 text-sm capitalize"
            >
              <option value="host">host</option>
              <option value="guest">guest</option>
              <option value="both">both</option>
            </select>
          </SelectField>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={r.is_featured}
              onChange={(e) => update(r.id, { is_featured: e.target.checked })}
              className="rounded border-brand-line"
            />{" "}
            Featured on help home
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={r.is_published}
              onChange={(e) => update(r.id, { is_published: e.target.checked })}
              className="rounded border-brand-line"
            />{" "}
            Published
          </label>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              disabled={pending || !r.__dirty || !r.question.trim()}
              onClick={() => saveRow(r)}
              className="inline-flex items-center gap-1 rounded bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
            >
              <Save className="h-3 w-3" /> Save
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => removeRow(r)}
              className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
