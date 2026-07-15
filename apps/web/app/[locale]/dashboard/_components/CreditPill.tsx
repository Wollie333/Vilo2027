"use client";

import { Coins, Plus } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export type CreditLedgerRow = {
  id: string;
  delta: number;
  balanceAfter: number;
  kind: string;
  reason: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  grant: "Granted",
  purchase: "Purchased",
  debit: "Used",
  refund: "Refunded",
  adjustment: "Adjusted",
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Header credit-balance pill for hosts — shows the quote-credit balance; a click
// opens a summary (balance + recent movements) with a Top-up CTA that routes to
// the credit-package store (bought through the normal product purchase flow).
export function CreditPill({
  balance,
  ledger,
}: {
  balance: number;
  ledger: CreditLedgerRow[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Your Wielo Credits"
        aria-label={`${balance} quote credits`}
        className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-light"
      >
        <Coins className="h-4 w-4 text-brand-primary" />
        <span className="tabular-nums">{balance}</span>
        <span className="hidden text-brand-mute sm:inline">credits</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wielo Credits</DialogTitle>
          </DialogHeader>

          <div className="rounded-card border border-brand-line bg-brand-light/50 p-4">
            <div className="flex items-center gap-2 text-sm text-brand-mute">
              <Coins className="h-4 w-4 text-brand-primary" />
              Quote credits
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums text-brand-ink">
              {balance}
            </p>
            <p className="mt-1 text-xs text-brand-mute">
              Credits are used when you send a quote. Top up any time.
            </p>
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-mute">
              Recent activity
            </h3>
            {ledger.length === 0 ? (
              <p className="text-sm text-brand-mute">No credit activity yet.</p>
            ) : (
              <ul className="divide-y divide-brand-line rounded-card border border-brand-line">
                {ledger.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-brand-ink">
                        {KIND_LABEL[r.kind] ?? r.kind}
                      </p>
                      <p className="truncate text-xs text-brand-mute">
                        {r.reason ?? fmtWhen(r.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${r.delta >= 0 ? "text-green-600" : "text-brand-ink"}`}
                    >
                      {r.delta >= 0 ? "+" : ""}
                      {r.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button asChild className="mt-4 w-full gap-1.5">
            <Link href="/dashboard/credits" onClick={() => setOpen(false)}>
              <Plus className="h-4 w-4" />
              Top up credits
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
