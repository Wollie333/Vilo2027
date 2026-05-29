"use client";

import {
  CalendarClock,
  Copy,
  Eye,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  ScrollText,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { forwardRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  PolicyDialog,
  type PolicyDialogData,
} from "@/components/policy/PolicyDialog";
import { Button } from "@/components/ui/button";

import { deletePolicyAction, duplicatePolicyAction } from "./actions";
import { PolicyEditorSheet } from "./PolicyEditorSheet";
import { POLICY_TYPES, type PolicyType } from "./schemas";

export type PolicyCard = {
  id: string;
  type: PolicyType;
  name: string;
  summary: string | null;
  preset: string | null;
  locked: boolean;
  isNonRefundable: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  rules: { days_before: number; refund_percent: number; label: string }[];
  bodyHtml: string | null;
};

const SECTION_META: Record<PolicyType, { icon: LucideIcon; blurb: string }> = {
  cancellation: {
    icon: RotateCcw,
    blurb:
      "How much guests get refunded when they cancel. The three presets are locked — duplicate one to customise.",
  },
  check_in_out: {
    icon: CalendarClock,
    blurb: "Check-in and check-out times you can reuse across listings.",
  },
  house_rules: {
    icon: ScrollText,
    blurb: "The rules guests agree to when they book.",
  },
};

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

function cardMeta(p: PolicyCard): string {
  if (p.type === "cancellation") {
    if (p.isNonRefundable) return "Non-refundable";
    const n = p.rules.length;
    return `${n} refund rule${n === 1 ? "" : "s"}`;
  }
  if (p.type === "check_in_out") {
    return `In ${p.checkInTime?.slice(0, 5) ?? "—"} · Out ${p.checkOutTime?.slice(0, 5) ?? "—"}`;
  }
  return "Rules document";
}

export function PolicyManager({ initial }: { initial: PolicyCard[] }) {
  const router = useRouter();
  const [editor, setEditor] = useState<{
    open: boolean;
    type: PolicyType;
    policy: PolicyCard | null;
  }>({ open: false, type: "cancellation", policy: null });

  function openCreate(type: PolicyType) {
    setEditor({ open: true, type, policy: null });
  }
  function openEdit(policy: PolicyCard) {
    setEditor({ open: true, type: policy.type, policy });
  }

  return (
    <div className="space-y-6">
      {POLICY_TYPES.map((t) => (
        <Section
          key={t.value}
          type={t.value}
          title={t.label}
          policies={initial.filter((p) => p.type === t.value)}
          onCreate={() => openCreate(t.value)}
          onEdit={openEdit}
          onChanged={() => router.refresh()}
        />
      ))}

      <PolicyEditorSheet
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        type={editor.type}
        policy={editor.policy}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function Section({
  type,
  title,
  policies,
  onCreate,
  onEdit,
  onChanged,
}: {
  type: PolicyType;
  title: string;
  policies: PolicyCard[];
  onCreate: () => void;
  onEdit: (p: PolicyCard) => void;
  onChanged: () => void;
}) {
  const meta = SECTION_META[type];
  const Icon = meta.icon;

  return (
    <section className="rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-start justify-between gap-4 border-b border-brand-line px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-brand-ink">
              {title}
            </h2>
            <p className="mt-0.5 max-w-md text-xs text-brand-mute">
              {meta.blurb}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCreate}
          className="shrink-0 gap-1.5"
        >
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      <div className="p-5">
        {policies.length === 0 ? (
          <div className="rounded border border-dashed border-brand-line bg-brand-light/40 px-4 py-6 text-center text-sm text-brand-mute">
            Nothing here yet. Create one to assign it to your listings.
          </div>
        ) : (
          <div className="space-y-2.5">
            {policies.map((p) => (
              <PolicyRow
                key={p.id}
                policy={p}
                onEdit={() => onEdit(p)}
                onChanged={onChanged}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PolicyRow({
  policy,
  onEdit,
  onChanged,
}: {
  policy: PolicyCard;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();

  function duplicate() {
    start(async () => {
      const result = await duplicatePolicyAction(policy.id);
      if (result.ok) {
        toast.success("Duplicated");
        onChanged();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    if (!window.confirm(`Delete "${policy.name}"?`)) return;
    start(async () => {
      const result = await deletePolicyAction(policy.id);
      if (result.ok) {
        toast.success("Deleted");
        onChanged();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-card border border-brand-line px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-brand-ink">
            {policy.name}
          </span>
          {policy.locked ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              <Lock className="h-3 w-3" /> Preset
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 truncate text-xs text-brand-mute">
          {cardMeta(policy)}
          {policy.summary ? ` · ${policy.summary}` : ""}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <PolicyDialog
          data={toDialogData(policy)}
          trigger={
            <IconBtn label="View">
              <Eye className="h-4 w-4" />
            </IconBtn>
          }
        />
        {policy.locked ? (
          <IconBtn label="Duplicate" onClick={duplicate} disabled={pending}>
            <Copy className="h-4 w-4" />
          </IconBtn>
        ) : (
          <>
            <IconBtn label="Edit" onClick={onEdit} disabled={pending}>
              <Pencil className="h-4 w-4" />
            </IconBtn>
            <IconBtn label="Duplicate" onClick={duplicate} disabled={pending}>
              <Copy className="h-4 w-4" />
            </IconBtn>
            <IconBtn label="Delete" onClick={remove} disabled={pending} danger>
              <Trash2 className="h-4 w-4" />
            </IconBtn>
          </>
        )}
      </div>
    </div>
  );
}

// forwardRef so it works as a Radix DialogTrigger `asChild` child (the View
// trigger) — Radix injects onClick + ref here.
const IconBtn = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    danger?: boolean;
    children: React.ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ label, onClick, disabled, danger, children, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`flex h-8 w-8 items-center justify-center rounded transition-colors disabled:opacity-40 ${
      danger
        ? "text-brand-mute hover:bg-red-50 hover:text-status-cancelled"
        : "text-brand-mute hover:bg-brand-light hover:text-brand-ink"
    }`}
    {...rest}
  >
    {children}
  </button>
));
IconBtn.displayName = "IconBtn";
