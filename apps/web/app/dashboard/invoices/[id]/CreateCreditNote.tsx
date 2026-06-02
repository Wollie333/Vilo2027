"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createCreditNoteAction } from "../../credit-notes/actions";

type Props = {
  invoiceId: string;
  invoiceTotal: number;
  currency: string;
};

function fmt(amount: number, currency: string): string {
  const symbol = currency === "ZAR" ? "R " : currency + " ";
  return `${symbol}${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

export function CreateCreditNote({ invoiceId, invoiceTotal, currency }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(invoiceTotal);
  const [reason, setReason] = useState<string>("");
  const [pending, start] = useTransition();

  function submit() {
    if (amount <= 0 || amount > invoiceTotal) {
      toast.error(
        `Amount must be between R 1 and ${fmt(invoiceTotal, currency)}.`,
      );
      return;
    }
    if (reason.trim().length === 0) {
      toast.error("Add a reason for the credit.");
      return;
    }
    start(async () => {
      const r = await createCreditNoteAction({
        invoiceId,
        amount,
        reason: reason.trim(),
      });
      if (r.ok) {
        toast.success("Credit note created.");
        setOpen(false);
        setReason("");
        if (r.data?.id) router.push(`/dashboard/credit-notes/${r.data.id}`);
        else router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
      >
        <RotateCcw className="h-4 w-4" /> Create credit note
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded border border-brand-line bg-brand-light/40 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        New credit note
      </div>
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Amount ({currency})
        </span>
        <input
          type="number"
          min={1}
          max={invoiceTotal}
          step={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        />
        <span className="mt-1 block text-[11px] text-brand-mute">
          Up to {fmt(invoiceTotal, currency)}
        </span>
      </label>
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Reason
        </span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 300))}
          placeholder="e.g. Goodwill credit for late check-in"
          className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Create credit note
        </button>
      </div>
    </div>
  );
}
