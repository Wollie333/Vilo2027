"use client";

import { AlertCircle, Plus, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { HELP_ICON_CHOICES, resolveHelpIcon } from "@/lib/help/icon-map";
import {
  type HelpStatusComponentStatus,
  type HelpStatusRow,
  parseSparkValues,
} from "@/lib/help/types";

import { deleteHelpStatus, saveHelpStatus } from "./actions";

type Row = Omit<HelpStatusRow, "spark_values"> & {
  spark_values: number[];
  __dirty?: boolean;
  __new?: boolean;
};

function normalise(rows: HelpStatusRow[]): Row[] {
  return rows.map((r) => ({
    ...r,
    spark_values: parseSparkValues(r.spark_values),
  }));
}

export function StatusEditor({ rows }: { rows: HelpStatusRow[] }) {
  const [list, setList] = useState<Row[]>(() => normalise(rows));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(id: string, patch: Partial<Row>) {
    setList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch, __dirty: true } : r)),
    );
  }

  function updateSpark(id: string, idx: number, value: number) {
    update(id, {
      spark_values: list
        .find((r) => r.id === id)!
        .spark_values.map((v, i) =>
          i === idx ? Math.max(0, Math.min(100, value)) : v,
        ),
    });
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
        name: "",
        icon: "activity",
        uptime_pct: 100,
        status: "normal",
        note: "100% · 30d",
        spark_values: [95, 100, 90, 100, 95, 100, 90],
        sort_order: 100 + prev.length * 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        __dirty: true,
        __new: true,
      },
    ]);
  }

  function saveRow(row: Row) {
    setError(null);
    startTransition(async () => {
      const res = await saveHelpStatus({
        id: row.__new ? undefined : row.id,
        name: row.name,
        icon: row.icon,
        uptimePct: Number(row.uptime_pct),
        status: row.status as HelpStatusComponentStatus,
        note: row.note ?? undefined,
        sparkValues: row.spark_values,
        sortOrder: row.sort_order,
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
    startTransition(async () => {
      const res = await deleteHelpStatus({ id: row.id, reason });
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

      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white px-5 py-10 text-center text-sm text-brand-mute">
            No status components yet.
          </div>
        ) : null}
        {list.map((r) => {
          const Icon = resolveHelpIcon(r.icon);
          return (
            <div
              key={r.id}
              className={`rounded-card border bg-white p-4 ${r.__dirty ? "border-amber-300 bg-amber-50/40" : "border-brand-line"}`}
            >
              <div className="grid gap-3 lg:grid-cols-[auto_1fr_220px]">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-light">
                  <Icon className="h-5 w-5 text-brand-secondary" />
                </div>
                <div className="space-y-2">
                  <input
                    value={r.name}
                    onChange={(e) => update(r.id, { name: e.target.value })}
                    placeholder="Channel sync"
                    className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink focus:border-brand-primary focus:outline-none"
                  />
                  <input
                    value={r.note ?? ""}
                    onChange={(e) => update(r.id, { note: e.target.value })}
                    placeholder="99.98% · 30d"
                    className="w-full rounded border border-brand-line bg-white px-3 py-2 text-[12.5px] text-brand-mute focus:border-brand-primary focus:outline-none"
                  />
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                      Sparkline (7 values, 0–100)
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                      {r.spark_values.map((v, i) => (
                        <input
                          key={i}
                          type="number"
                          min={0}
                          max={100}
                          value={v}
                          onChange={(e) =>
                            updateSpark(r.id, i, Number(e.target.value))
                          }
                          className="num rounded border border-brand-line bg-white px-1 py-1 text-center font-mono text-[11px]"
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <SelectField label="Icon">
                    <select
                      value={r.icon}
                      onChange={(e) => update(r.id, { icon: e.target.value })}
                      className="w-full rounded border border-brand-line bg-white px-2 py-1 text-sm"
                    >
                      {HELP_ICON_CHOICES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </SelectField>
                  <SelectField label="Status">
                    <select
                      value={r.status}
                      onChange={(e) =>
                        update(r.id, {
                          status: e.target.value as HelpStatusComponentStatus,
                        })
                      }
                      className="w-full rounded border border-brand-line bg-white px-2 py-1 text-sm capitalize"
                    >
                      <option value="normal">normal</option>
                      <option value="degraded">degraded</option>
                      <option value="incident">incident</option>
                      <option value="maintenance">maintenance</option>
                    </select>
                  </SelectField>
                  <SelectField label="Uptime %">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={r.uptime_pct}
                      onChange={(e) =>
                        update(r.id, { uptime_pct: Number(e.target.value) })
                      }
                      className="num w-full rounded border border-brand-line bg-white px-2 py-1 font-mono text-sm"
                    />
                  </SelectField>
                  <SelectField label="Sort">
                    <input
                      type="number"
                      value={r.sort_order}
                      onChange={(e) =>
                        update(r.id, { sort_order: Number(e.target.value) })
                      }
                      className="num w-full rounded border border-brand-line bg-white px-2 py-1 font-mono text-sm"
                    />
                  </SelectField>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      disabled={pending || !r.__dirty || !r.name.trim()}
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
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded border border-dashed border-brand-primary px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-accent/40"
      >
        <Plus className="h-4 w-4" /> Add component
      </button>
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
