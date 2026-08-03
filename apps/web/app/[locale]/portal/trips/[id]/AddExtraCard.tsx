"use client";

import { Loader2, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubmitSuccess } from "@/components/portal/SubmitSuccess";
import { formatMoney } from "@/lib/format";

import { addGuestBookingAddonAction } from "./addon-actions";

type Option = {
  id: string;
  name: string;
  unitPrice: number;
  description: string | null;
  /** What the guest is actually billed for this stay (guests × nights). */
  effectiveTotal: number;
  /** Basis note when the total differs from the unit price, e.g. "per person / night". */
  basis: string | null;
};

export function AddExtraCard({
  bookingId,
  currency,
  options,
}: {
  bookingId: string;
  currency: string;
  options: Option[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState<Option | null>(null);
  const [sent, setSent] = useState(false);

  if (options.length === 0) return null;

  // Close the confirm/success dialog, reset it, then refresh so the new charge
  // shows on the balance. Refresh runs on close so it never blocks success.
  function close() {
    setConfirming(null);
    setSent(false);
    router.refresh();
  }

  function confirmAdd() {
    if (!confirming) return;
    const id = confirming.id;
    start(async () => {
      const r = await addGuestBookingAddonAction({
        bookingId,
        addonId: id,
        quantity: 1,
      });
      if (r.ok) {
        setSent(true);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-brand-line px-6 py-4">
        <div>
          <div className="font-display text-[15px] font-bold text-brand-ink">
            Add an extra to your trip
          </div>
          <div className="mt-0.5 text-[12px] text-brand-mute">
            Added to your balance for your host to confirm
          </div>
        </div>
        <Sparkles className="h-5 w-5 text-brand-primary" />
      </div>
      <ul className="divide-y divide-brand-line">
        {options.map((o) => (
          <li key={o.id} className="flex items-center gap-3 px-6 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-brand-ink">
                {o.name}
              </div>
              {o.description ? (
                <div className="mt-0.5 truncate text-[12px] text-brand-mute">
                  {o.description}
                </div>
              ) : null}
            </div>
            <span className="shrink-0 text-right">
              <span className="num block text-[13px] font-semibold text-brand-ink">
                {formatMoney(o.effectiveTotal, currency)}
              </span>
              {o.basis ? (
                <span className="block text-[11px] text-brand-mute">
                  {formatMoney(o.unitPrice, currency)} {o.basis}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => setConfirming(o)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!confirming}
        onOpenChange={(v) => {
          if (!v && !pending) close();
        }}
      >
        <DialogContent className="max-w-sm gap-0 rounded-card border-brand-line bg-white p-0">
          {sent ? (
            <SubmitSuccess
              title={
                confirming
                  ? `${confirming.name} added to your trip`
                  : "Added to your trip"
              }
              primaryHref="/portal/inbox"
              onClose={close}
            >
              It&apos;s on your booking balance — your host will confirm
              payment.
            </SubmitSuccess>
          ) : (
            <>
              <DialogHeader className="border-b border-brand-line px-5 py-4 text-left">
                <DialogTitle className="flex items-center gap-2 text-brand-ink">
                  <Sparkles className="h-4 w-4 text-brand-primary" />
                  Add this extra?
                </DialogTitle>
                <DialogDescription className="text-brand-mute">
                  This is a charge — it&apos;s added to your booking balance for
                  your host to collect.
                </DialogDescription>
              </DialogHeader>
              {confirming ? (
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between rounded-[10px] bg-brand-light/60 px-3 py-3">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-brand-ink">
                        {confirming.name}
                      </div>
                      {confirming.basis ? (
                        <div className="text-[11.5px] text-brand-mute">
                          {formatMoney(confirming.unitPrice, currency)}{" "}
                          {confirming.basis}
                        </div>
                      ) : null}
                    </div>
                    <div className="num shrink-0 font-display text-[16px] font-extrabold text-brand-ink">
                      {formatMoney(confirming.effectiveTotal, currency)}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-2 border-t border-brand-line px-5 py-3">
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  disabled={pending}
                  className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmAdd}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Confirm & add
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
