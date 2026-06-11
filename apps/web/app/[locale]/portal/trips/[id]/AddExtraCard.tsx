"use client";

import { Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";

import { addGuestBookingAddonAction } from "./addon-actions";

type Option = {
  id: string;
  name: string;
  unitPrice: number;
  description: string | null;
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
  const [busyId, setBusyId] = useState<string | null>(null);

  if (options.length === 0) return null;

  function add(id: string) {
    setBusyId(id);
    start(async () => {
      const r = await addGuestBookingAddonAction({
        bookingId,
        addonId: id,
        quantity: 1,
      });
      setBusyId(null);
      if (r.ok) {
        toast.success("Added to your trip — your host will confirm payment.");
        router.refresh();
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
            <span className="num text-[13px] font-semibold text-brand-ink">
              {formatMoney(o.unitPrice, currency)}
            </span>
            <button
              type="button"
              onClick={() => add(o.id)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {busyId === o.id ? "Adding…" : "Add"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
