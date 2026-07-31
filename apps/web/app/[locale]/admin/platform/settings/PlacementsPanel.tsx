"use client";

import { Link2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { LegalPlacementSlot } from "@/lib/legalDocuments";

import { saveLegalPlacementAction } from "./actions";

export type PlacementSlotInput = {
  slot: string;
  label: string;
  usedAt: string;
};

export type PlacementDocInput = {
  slug: string;
  title: string;
  isPublished: boolean;
};

// Placements = the single-source-of-truth binding layer. Each well-known app slot
// points at the legal document that fills it; changing a dropdown re-binds the
// slot live (the public surface reads the placement at runtime). A slot bound to
// an unpublished doc renders its built-in fallback until that doc is published.
export function PlacementsPanel({
  slots,
  placements,
  docs,
}: {
  slots: ReadonlyArray<PlacementSlotInput>;
  placements: Record<string, string | null>;
  docs: ReadonlyArray<PlacementDocInput>;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-brand-primary" />
        <h3 className="font-display text-sm font-bold text-brand-ink">
          Placements — where each document is used
        </h3>
      </div>
      <p className="mt-1 text-sm text-brand-mute">
        Bind a slot to a published document. The change is live immediately
        wherever the slot is read — no deploy. Leave a slot on <em>None</em> to
        use the built-in fallback copy.
      </p>

      <div className="mt-4 divide-y divide-brand-line">
        {slots.map((s) => (
          <PlacementRow
            key={s.slot}
            slot={s}
            current={placements[s.slot] ?? ""}
            docs={docs}
          />
        ))}
      </div>
    </div>
  );
}

function PlacementRow({
  slot,
  current,
  docs,
}: {
  slot: PlacementSlotInput;
  current: string;
  docs: ReadonlyArray<PlacementDocInput>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();

  const boundDoc = docs.find((d) => d.slug === value);
  const boundToDraft = Boolean(value) && boundDoc && !boundDoc.isPublished;

  function change(next: string) {
    if (pending || next === value) return;
    const prev = value;
    setValue(next);
    start(async () => {
      try {
        await saveLegalPlacementAction({
          slot: slot.slot as LegalPlacementSlot,
          doc_slug: next === "" ? null : next,
        });
        toast.success(`${slot.label} → ${next || "None"}`);
        router.refresh();
      } catch (e) {
        setValue(prev);
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm font-semibold text-brand-ink">
          {slot.label}
        </div>
        <div className="text-[12px] text-brand-mute">{slot.usedAt}</div>
        {boundToDraft ? (
          <div className="mt-0.5 text-[11px] font-medium text-amber-600">
            Bound to a draft — the fallback shows until this document is
            published.
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-brand-mute" />
        ) : null}
        <select
          value={value}
          disabled={pending}
          onChange={(e) => change(e.target.value)}
          className="h-[38px] min-w-[220px] rounded-[10px] border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-primary disabled:opacity-50"
        >
          <option value="">None (use built-in fallback)</option>
          {docs.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.title}
              {d.isPublished ? "" : " (draft)"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
