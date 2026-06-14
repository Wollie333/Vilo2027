"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { upsertPlanFeatureAction } from "./actions";

export type MatrixPlan = { key: string; name: string };
export type MatrixFeature = { key: string; description: string };
export type CellState = { is_enabled: boolean; limit_value: number | null };

type Props = {
  plans: MatrixPlan[];
  features: MatrixFeature[];
  // keyed `${plan}:${feature}`
  cells: Record<string, CellState>;
};

// Numeric features carry a cap in limit_value (NULL = unlimited).
function isLimitFeature(key: string): boolean {
  return /_limit$|_seats$/.test(key);
}

function cellKey(plan: string, feature: string): string {
  return `${plan}:${feature}`;
}

export function FeatureMatrix({ plans, features, cells: initial }: Props) {
  const [cells, setCells] = useState<Record<string, CellState>>(initial);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function get(plan: string, feature: string): CellState {
    return (
      cells[cellKey(plan, feature)] ?? { is_enabled: false, limit_value: null }
    );
  }

  function save(plan: string, feature: string, next: CellState) {
    const k = cellKey(plan, feature);
    const prev = cells[k];
    setCells((c) => ({ ...c, [k]: next }));
    setSavingKey(k);
    startTransition(async () => {
      try {
        await upsertPlanFeatureAction({
          plan,
          featureKey: feature,
          isEnabled: next.is_enabled,
          limitValue: next.limit_value,
        });
      } catch {
        // revert on failure
        setCells((c) => ({
          ...c,
          [k]: prev ?? { is_enabled: false, limit_value: null },
        }));
        toast.error("Couldn't save that change.");
      } finally {
        setSavingKey((s) => (s === k ? null : s));
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-card border border-brand-line bg-white shadow-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-line bg-brand-light/40">
            <th className="sticky left-0 z-10 bg-brand-light/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Feature
            </th>
            {plans.map((p) => (
              <th
                key={p.key}
                className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-brand-mute"
              >
                {p.name}
                <div className="font-mono text-[10px] normal-case text-brand-mute/70">
                  {p.key}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-line">
          {features.map((f) => {
            const numeric = isLimitFeature(f.key);
            return (
              <tr key={f.key} className="hover:bg-brand-light/30">
                <td className="sticky left-0 z-10 bg-white px-4 py-3">
                  <div className="font-mono text-[12px] font-medium text-brand-ink">
                    {f.key}
                  </div>
                  <div className="text-[11.5px] text-brand-mute">
                    {f.description}
                  </div>
                </td>
                {plans.map((p) => {
                  const state = get(p.key, f.key);
                  const k = cellKey(p.key, f.key);
                  const busy = savingKey === k;
                  return (
                    <td
                      key={p.key}
                      className="px-4 py-3 text-center align-middle"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="checkbox"
                          checked={state.is_enabled}
                          disabled={busy}
                          onChange={(e) =>
                            save(p.key, f.key, {
                              ...state,
                              is_enabled: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
                          aria-label={`${f.key} on ${p.name}`}
                        />
                        {numeric && state.is_enabled ? (
                          <input
                            type="number"
                            min={0}
                            value={state.limit_value ?? ""}
                            disabled={busy}
                            placeholder="∞"
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              setCells((c) => ({
                                ...c,
                                [k]: {
                                  ...state,
                                  limit_value: v === "" ? null : Number(v),
                                },
                              }));
                            }}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              save(p.key, f.key, {
                                ...state,
                                limit_value: v === "" ? null : Number(v),
                              });
                            }}
                            className="w-16 rounded-md border border-brand-line px-2 py-1 text-center font-mono text-[12px] focus:border-brand-primary focus:outline-none"
                            aria-label={`${f.key} limit on ${p.name}`}
                          />
                        ) : null}
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-mute" />
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
