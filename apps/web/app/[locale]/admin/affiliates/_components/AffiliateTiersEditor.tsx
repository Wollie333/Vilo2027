"use client";

import { Plus, Save, Trash2, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteAffiliateTierAction,
  upsertAffiliateTierAction,
} from "../actions";

export type TierRow = {
  id: string;
  name: string;
  minEarnings: number;
  bonusPercent: number;
};

// Admin editor for the affiliate tier ladder. Each tier adds its bonus % on top
// of the per-product base commission once an affiliate's lifetime cleared
// earnings reach the threshold.
export function AffiliateTiersEditor({ tiers }: { tiers: TierRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<TierRow[]>(tiers);
  const [pending, startTransition] = useTransition();

  const setField = (id: string, key: keyof TierRow, value: string | number) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      { id: `new-${Date.now()}`, name: "", minEarnings: 0, bonusPercent: 0 },
    ]);

  const save = (r: TierRow) =>
    startTransition(async () => {
      const res = await upsertAffiliateTierAction({
        id: r.id.startsWith("new-") ? undefined : r.id,
        name: r.name,
        minEarnings: r.minEarnings,
        bonusPercent: r.bonusPercent,
      });
      if (res.ok) {
        toast.success("Tier saved");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  const remove = (r: TierRow) => {
    if (r.id.startsWith("new-")) {
      setRows((rs) => rs.filter((x) => x.id !== r.id));
      return;
    }
    startTransition(async () => {
      const res = await deleteAffiliateTierAction(r.id);
      if (res.ok) {
        toast.success("Tier removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="am-card p-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-brand-primary" />
        <div className="smallcaps">Tiers &amp; bonus rates</div>
      </div>
      <p className="mt-1 text-[12.5px] text-brand-mute">
        A tier adds its bonus % on top of each product&apos;s base commission
        once an affiliate&apos;s lifetime cleared earnings reach the threshold.
        The per-product rate is always the base.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-brand-line text-left text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              <th className="py-2 pr-3">Tier name</th>
              <th className="py-2 pr-3">Unlock at (earned)</th>
              <th className="py-2 pr-3">Bonus %</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-brand-line last:border-0"
              >
                <td className="py-2 pr-3">
                  <input
                    value={r.name}
                    onChange={(e) => setField(r.id, "name", e.target.value)}
                    placeholder="Silver"
                    className="fld h-9"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min={0}
                    value={r.minEarnings}
                    onChange={(e) =>
                      setField(r.id, "minEarnings", Number(e.target.value) || 0)
                    }
                    className="fld mono h-9 w-32"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min={0}
                    value={r.bonusPercent}
                    onChange={(e) =>
                      setField(
                        r.id,
                        "bonusPercent",
                        Number(e.target.value) || 0,
                      )
                    }
                    className="fld mono h-9 w-24"
                  />
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => save(r)}
                      disabled={pending}
                      className="btn-pri h-9"
                    >
                      <Save className="h-3.5 w-3.5" /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      disabled={pending}
                      className="btn-ghost h-9 hover:text-rose-600"
                      title="Remove tier"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={addRow} className="btn-ghost mt-3">
        <Plus className="h-3.5 w-3.5" /> Add tier
      </button>
    </div>
  );
}
