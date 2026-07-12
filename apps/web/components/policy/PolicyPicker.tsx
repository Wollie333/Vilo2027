"use client";

import { Check, Eye, Lock, Pencil, Plus } from "lucide-react";
import { forwardRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { setListingPolicyAction } from "@/app/[locale]/dashboard/policies/actions";
import { PolicyEditorSheet } from "@/app/[locale]/dashboard/policies/PolicyEditorSheet";
import type { PolicyCard } from "@/app/[locale]/dashboard/policies/PolicyManager";
import type { PolicyType } from "@/app/[locale]/dashboard/policies/schemas";
import {
  PolicyDialog,
  type PolicyDialogData,
} from "@/components/policy/PolicyDialog";

function summarise(p: PolicyCard): string {
  if (p.type === "cancellation") {
    if (p.isNonRefundable) return "Non-refundable";
    const n = p.rules.length;
    return `${n} refund rule${n === 1 ? "" : "s"}`;
  }
  if (p.type === "check_in_out") {
    return `In ${p.checkInTime?.slice(0, 5) ?? "—"} · Out ${
      p.checkOutTime?.slice(0, 5) ?? "—"
    }`;
  }
  return "Rules document";
}

function toDialogData(p: PolicyCard): PolicyDialogData {
  return {
    type: p.type,
    name: p.name,
    summary: p.summary,
    isNonRefundable: p.isNonRefundable,
    rules: p.rules,
    checkInTime: p.checkInTime,
    checkOutTime: p.checkOutTime,
    bodyHtml: p.bodyHtml,
  };
}

// Single source of truth for choosing a listing's policy of one kind. The host
// picks one of their policies (locked presets + their own) as the listing-wide
// default, or creates a new one — which is written to the same `policies` table
// the /dashboard/policies manager reads, so it shows up in both places.
export function PolicyPicker({
  listingId,
  type,
  policies,
  assignedPolicyId,
  onChanged,
}: {
  listingId: string;
  type: PolicyType;
  policies: PolicyCard[];
  assignedPolicyId: string | null;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const [editor, setEditor] = useState<{
    open: boolean;
    policy: PolicyCard | null;
  }>({ open: false, policy: null });
  // Optimistic selection so the picked (or newly created) policy turns green
  // ("active & selected") immediately, before the server refresh lands.
  const [optimisticId, setOptimisticId] = useState<string | null>(null);

  const mine = policies.filter((p) => p.type === type);
  const activeId = optimisticId ?? assignedPolicyId;

  function select(policyId: string) {
    setOptimisticId(policyId); // green right away
    start(async () => {
      const result = await setListingPolicyAction(
        listingId,
        type,
        null,
        policyId,
      );
      if (result.ok) {
        toast.success("Set as the listing default.");
        onChanged();
      } else {
        setOptimisticId(null); // revert on failure
        toast.error(result.error);
      }
    });
  }

  // After the sheet saves: a freshly created policy is immediately assigned to
  // this listing as the default (matches "create → set as default") and shown
  // as active/green at once. An edit just refreshes.
  function onSheetSaved(created?: { id: string }) {
    if (!created?.id) {
      onChanged();
      return;
    }
    setOptimisticId(created.id); // green right away
    setListingPolicyAction(listingId, type, null, created.id).then((r) => {
      if (!r.ok) {
        setOptimisticId(null);
        toast.error(r.error);
      }
      onChanged();
    });
  }

  return (
    <div className="space-y-2.5">
      {mine.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-brand-light/40 px-4 py-5 text-center text-[13px] text-brand-mute">
          Nothing here yet — create one below to use it.
        </div>
      ) : (
        mine.map((p) => {
          const selected = activeId === p.id;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-card border p-3.5 transition ${
                selected
                  ? "border-brand-primary bg-brand-accent/40 shadow-card"
                  : "border-brand-line bg-white hover:border-brand-primary/40"
              }`}
            >
              <button
                type="button"
                onClick={() => select(p.id)}
                disabled={pending || selected}
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-line"
                  }`}
                >
                  {selected ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-display text-sm font-semibold text-brand-ink">
                      {p.name}
                    </span>
                    {p.locked ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                        <Lock className="h-3 w-3" /> Preset
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-brand-mute">
                    {summarise(p)}
                    {p.summary ? ` · ${p.summary}` : ""}
                  </span>
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <PolicyDialog
                  data={toDialogData(p)}
                  trigger={
                    <IconBtn label="View">
                      <Eye className="h-4 w-4" />
                    </IconBtn>
                  }
                />
                {!p.locked ? (
                  <button
                    type="button"
                    onClick={() => setEditor({ open: true, policy: p })}
                    aria-label="Edit"
                    title="Edit"
                    className="flex h-8 w-8 items-center justify-center rounded text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })
      )}

      <button
        type="button"
        onClick={() => setEditor({ open: true, policy: null })}
        className="flex w-full items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-brand-line bg-brand-light/40 py-3 text-sm font-semibold text-brand-mute transition hover:border-brand-primary/60 hover:text-brand-primary"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> Create your own
      </button>

      <PolicyEditorSheet
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        type={type}
        policy={editor.policy}
        onSaved={onSheetSaved}
      />
    </div>
  );
}

// forwardRef so it works as the Radix DialogTrigger `asChild` child.
const IconBtn = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    children: React.ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ label, children, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={label}
    title={label}
    className="flex h-8 w-8 items-center justify-center rounded text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
    {...rest}
  >
    {children}
  </button>
));
IconBtn.displayName = "IconBtn";
