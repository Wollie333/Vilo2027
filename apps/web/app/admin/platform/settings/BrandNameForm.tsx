"use client";

import { Loader2, Save, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setBrandNameAction } from "./actions";

export function BrandNameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = name.trim() !== initial.trim() && name.trim().length > 0;

  function save() {
    if (pending || !dirty) return;
    start(async () => {
      try {
        const r = await setBrandNameAction({ name: name.trim() });
        toast.success(`Brand name set to “${r.name}”`);
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not save the brand name.",
        );
      }
    });
  }

  return (
    <div className="max-w-lg rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-brand-primary" />
        <h2 className="font-display text-base font-bold text-brand-ink">
          Brand name
        </h2>
      </div>
      <p className="mt-1 text-sm text-brand-mute">
        The display name shown across the whole app — navigation, page titles,
        emails. Use this while the real brand is being decided; changing it
        updates every instance of the name.
      </p>
      <div className="mt-4 flex items-end gap-3">
        <label className="flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Name
          </span>
          <input
            type="text"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vilo"
            className="mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
          />
        </label>
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
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
