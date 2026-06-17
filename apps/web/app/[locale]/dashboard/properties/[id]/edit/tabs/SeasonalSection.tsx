"use client";

import { CalendarRange, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";

import {
  createSeasonalRuleForListingAction,
  deleteSeasonalRuleForListingAction,
  toggleSeasonalRuleForListingAction,
  updateSeasonalRuleForListingAction,
  type InlineSeasonalRule,
} from "../../../../seasonal-pricing/actions";
import type { EditorSeasonalRule } from "../Editor";

type Draft = {
  label: string;
  start_date: string;
  end_date: string;
  adjustment_type: "absolute" | "percent";
  adjustment_value: string;
  min_nights: string;
  priority: string;
  is_active: boolean;
};

const EMPTY: Draft = {
  label: "",
  start_date: "",
  end_date: "",
  adjustment_type: "absolute",
  adjustment_value: "",
  min_nights: "",
  priority: "0",
  is_active: true,
};

function toDraft(r: EditorSeasonalRule): Draft {
  return {
    label: r.label,
    start_date: r.startDate,
    end_date: r.endDate,
    adjustment_type: r.adjustmentType,
    adjustment_value: String(r.adjustmentValue),
    min_nights: r.minNights == null ? "" : String(r.minNights),
    priority: String(r.priority),
    is_active: r.isActive,
  };
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SeasonalSection({
  listingId,
  currency,
  initial,
}: {
  listingId: string;
  currency: string;
  initial: EditorSeasonalRule[];
}) {
  const [rules, setRules] = useState<EditorSeasonalRule[]>(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [pending, start] = useTransition();

  const openNew = () => {
    setDraft(EMPTY);
    setEditingId("new");
  };
  const openEdit = (r: EditorSeasonalRule) => {
    setDraft(toDraft(r));
    setEditingId(r.id);
  };
  const cancel = () => setEditingId(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  const save = () => {
    if (!draft.label.trim()) return toast.error("Give the season a name.");
    if (!draft.start_date || !draft.end_date)
      return toast.error("Pick a start and end date.");
    const input = {
      label: draft.label.trim(),
      start_date: draft.start_date,
      end_date: draft.end_date,
      adjustment_type: draft.adjustment_type,
      adjustment_value: Number(draft.adjustment_value) || 0,
      currency,
      min_nights:
        draft.min_nights.trim() === "" ? null : Number(draft.min_nights),
      priority: Number(draft.priority) || 0,
      is_active: draft.is_active,
    };
    start(async () => {
      const res =
        editingId && editingId !== "new"
          ? await updateSeasonalRuleForListingAction(
              listingId,
              editingId,
              input,
            )
          : await createSeasonalRuleForListingAction(listingId, input);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const rule = res.data!.rule;
      setRules((prev) => {
        const without = prev.filter((r) => r.id !== rule.id);
        return [...without, fromInline(rule)].sort((a, b) =>
          a.startDate < b.startDate ? -1 : 1,
        );
      });
      toast.success(editingId === "new" ? "Season added." : "Season saved.");
      setEditingId(null);
    });
  };

  const toggle = (r: EditorSeasonalRule) =>
    start(async () => {
      const res = await toggleSeasonalRuleForListingAction(
        listingId,
        r.id,
        !r.isActive,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRules((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, isActive: !x.isActive } : x)),
      );
    });

  const remove = (r: EditorSeasonalRule) => {
    if (!window.confirm(`Delete the “${r.label}” season?`)) return;
    start(async () => {
      const res = await deleteSeasonalRuleForListingAction(listingId, r.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRules((prev) => prev.filter((x) => x.id !== r.id));
      if (editingId === r.id) setEditingId(null);
    });
  };

  return (
    <div className="rounded-card border border-brand-line bg-brand-light/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-brand-dark">
            <CalendarRange className="h-4 w-4 text-brand-mute" />
            Seasonal pricing{" "}
            <span className="font-normal text-brand-mute">(optional)</span>
          </div>
          <p className="mt-0.5 text-xs text-brand-mute">
            Override the nightly rate for date ranges (peak / off-peak). Higher
            priority wins when seasons overlap.
          </p>
        </div>
        {editingId === null ? (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-brand-primary px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-secondary"
          >
            <Plus className="h-3.5 w-3.5" /> Add season
          </button>
        ) : null}
      </div>

      {/* Editor form */}
      {editingId !== null ? (
        <div className="mt-3 rounded-card border border-brand-line bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Season name">
              <Input
                value={draft.label}
                onChange={(e) => set("label", e.target.value)}
                placeholder="Festive peak"
              />
            </Field>
            <Field label="Priority (higher wins)">
              <Input
                type="number"
                value={draft.priority}
                onChange={(e) => set("priority", e.target.value)}
              />
            </Field>
            <Field label="Start date">
              <Input
                type="date"
                value={draft.start_date}
                onChange={(e) => set("start_date", e.target.value)}
              />
            </Field>
            <Field label="End date">
              <Input
                type="date"
                value={draft.end_date}
                onChange={(e) => set("end_date", e.target.value)}
              />
            </Field>
            <Field label="Adjustment">
              <select
                value={draft.adjustment_type}
                onChange={(e) =>
                  set(
                    "adjustment_type",
                    e.target.value as "absolute" | "percent",
                  )
                }
                className="block h-10 w-full rounded-md border border-brand-line bg-white px-3 text-sm focus:border-brand-primary focus:outline-none"
              >
                <option value="absolute">Set nightly price</option>
                <option value="percent">Adjust by percent</option>
              </select>
            </Field>
            <Field
              label={
                draft.adjustment_type === "absolute"
                  ? `Nightly price (${currency})`
                  : "Percent (+/-)"
              }
            >
              <Input
                type="number"
                value={draft.adjustment_value}
                onChange={(e) => set("adjustment_value", e.target.value)}
                placeholder={
                  draft.adjustment_type === "absolute" ? "1800" : "25"
                }
              />
            </Field>
            <Field label="Min nights this season (optional)">
              <Input
                type="number"
                value={draft.min_nights}
                onChange={(e) => set("min_nights", e.target.value)}
                placeholder="e.g. 3"
              />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-[13px] text-brand-ink">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
                className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
              />
              Active
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink transition hover:bg-brand-light"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save season"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* List */}
      {rules.length > 0 ? (
        <div className="mt-3 divide-y divide-brand-line rounded-card border border-brand-line bg-white">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-brand-ink">
                    {r.label}
                  </span>
                  {!r.isActive ? (
                    <span className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-mute">
                      inactive
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
                  {fmtDate(r.startDate)} → {fmtDate(r.endDate)} ·{" "}
                  {r.adjustmentType === "absolute"
                    ? formatMoney(r.adjustmentValue, r.currency) + " / night"
                    : `${r.adjustmentValue > 0 ? "+" : ""}${r.adjustmentValue}%`}
                  {r.minNights ? ` · min ${r.minNights} nights` : ""}
                  {` · priority ${r.priority}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggle(r)}
                disabled={pending}
                title={r.isActive ? "Deactivate" : "Activate"}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-brand-line text-brand-mute transition hover:bg-brand-light disabled:opacity-50"
              >
                <Power className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => openEdit(r)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-brand-line text-brand-ink transition hover:bg-brand-light"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(r)}
                disabled={pending}
                title="Delete"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-red-200 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : editingId === null ? (
        <p className="mt-3 text-xs text-brand-mute">
          No seasonal rules yet — the base price applies all year.
        </p>
      ) : null}
    </div>
  );
}

function fromInline(r: InlineSeasonalRule): EditorSeasonalRule {
  return {
    id: r.id,
    label: r.label,
    startDate: r.startDate,
    endDate: r.endDate,
    adjustmentType: r.adjustmentType,
    adjustmentValue: r.adjustmentValue,
    currency: r.currency,
    minNights: r.minNights,
    priority: r.priority,
    isActive: r.isActive,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-semibold text-brand-dark">
        {label}
      </span>
      {children}
    </label>
  );
}
