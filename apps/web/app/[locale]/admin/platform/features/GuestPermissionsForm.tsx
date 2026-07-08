"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { GuestPermission } from "@/lib/guests/permissions";

import { saveGuestPermissions } from "./actions";

export function GuestPermissionsForm({
  catalog,
  initial,
}: {
  catalog: GuestPermission[];
  initial: Record<string, boolean>;
}) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, boolean>>(initial);
  const [pending, start] = useTransition();

  const dirty = catalog.some(
    (p) => (state[p.key] ?? true) !== (initial[p.key] ?? true),
  );

  function toggle(key: string) {
    setState((s) => ({ ...s, [key]: !(s[key] ?? true) }));
  }

  function save() {
    if (pending || !dirty) return;
    start(async () => {
      const res = await saveGuestPermissions(state);
      if (res.ok) {
        toast.success("Guest permissions saved.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-mute">
        These apply to <span className="font-medium">every guest</span> (guests
        have no plan). Turn a capability off to restrict it platform-wide —
        gates read this live. Looking-For posting <em>limits</em> (per
        day/month) are set in{" "}
        <span className="font-medium">Looking For → Quotas</span>.
      </p>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <ul className="divide-y divide-brand-line">
          {catalog.map((p) => {
            const on = state[p.key] ?? true;
            return (
              <li key={p.key} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-brand-ink">
                    {p.label}
                  </div>
                  <div className="mt-0.5 text-[12px] text-brand-mute">
                    {p.description}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={p.label}
                  onClick={() => toggle(p.key)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    on ? "bg-brand-primary" : "bg-brand-line"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      on ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={pending || !dirty}
        className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {pending ? "Saving…" : "Save guest permissions"}
      </button>
    </div>
  );
}
