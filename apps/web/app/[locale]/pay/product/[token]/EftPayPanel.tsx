"use client";

import { Building2, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { recordProductEftAction } from "./actions";

type Banking = {
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  branchCode: string | null;
  reference: string;
};

// "Pay with EFT" — clicking records a PENDING charge on the Wielo ledger (so the
// admin can track the awaited transfer) and THEN reveals the bank details. Until
// the button is clicked the details stay hidden.
export function EftPayPanel({
  token,
  banking,
  issuerName,
  secondary = false,
}: {
  token: string;
  banking: Banking;
  issuerName: string;
  secondary?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [pending, start] = useTransition();

  function payByEft() {
    start(async () => {
      const r = await recordProductEftAction(token);
      if (r.ok) {
        setRevealed(true);
      } else {
        toast.error(r.error);
      }
    });
  }

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={payByEft}
        disabled={pending}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition disabled:opacity-60 ${
          secondary
            ? "border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
            : "bg-brand-primary text-white hover:bg-brand-secondary"
        }`}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Building2 className="h-4 w-4" />
        )}
        {pending ? "Preparing…" : "Pay with EFT"}
      </button>
    );
  }

  return (
    <div className="rounded-card border border-brand-line bg-white">
      <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3 font-display font-semibold text-brand-ink">
        <Building2 className="h-4 w-4 text-brand-mute" />
        Pay by EFT bank transfer
      </div>
      <dl className="divide-y divide-brand-line text-sm">
        {[
          ["Bank", banking.bankName],
          ["Account name", banking.accountName],
          ["Account number", banking.accountNumber],
          ["Branch code", banking.branchCode],
          ["Use as reference", banking.reference],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between px-5 py-2.5"
          >
            <dt className="text-brand-mute">{label}</dt>
            <dd className="text-right font-medium text-brand-ink">
              {value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>
      <p className="px-5 py-3 text-xs text-brand-mute">
        Your payment is now pending. Once your transfer reflects, {issuerName}{" "}
        confirms it and your invoice appears here automatically. Use the
        reference above so we can match it.
      </p>
    </div>
  );
}
