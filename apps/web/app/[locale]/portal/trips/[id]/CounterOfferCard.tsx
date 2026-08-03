"use client";

import { CalendarRange, Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SubmitSuccess } from "@/components/portal/SubmitSuccess";

import { respondToCounterOfferAction } from "./actions";

export type CounterOffer = {
  requestId: string;
  originalCheckIn: string | null;
  originalCheckOut: string | null;
  counterCheckIn: string;
  counterCheckOut: string;
  hostNote: string | null;
};

const fmt = (iso: string | null): string =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

/**
 * Guest-facing counter-offer: the host declined the requested dates but proposed
 * others (booking_requests.status = 'countered'). Accept applies the suggested
 * dates via the shared date-change core; Decline records it. Both notify the host.
 */
export function CounterOfferCard({
  hostName,
  offer,
}: {
  hostName: string;
  offer: CounterOffer;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<null | "accepted" | "declined">(null);

  function close() {
    setDone(null);
    router.refresh();
  }

  function respond(accept: boolean) {
    start(async () => {
      const res = await respondToCounterOfferAction({
        requestId: offer.requestId,
        accept,
      });
      if (res.ok) setDone(accept ? "accepted" : "declined");
      else toast.error(res.error);
    });
  }

  return (
    <section className="overflow-hidden rounded-card border border-amber-300 bg-amber-50/60 shadow-card">
      {done ? (
        <SubmitSuccess
          title={
            done === "accepted" ? "Dates updated 🎉" : "Suggestion declined"
          }
          primaryHref="/portal/inbox"
          onClose={close}
        >
          {done === "accepted"
            ? `Your trip now runs ${fmt(offer.counterCheckIn)} → ${fmt(
                offer.counterCheckOut,
              )}.`
            : `We let ${hostName} know — message them to find another option.`}
        </SubmitSuccess>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-amber-200 px-5 py-3">
            <span className="flex h-2 w-2 rounded-full bg-amber-500" />
            <span className="font-display text-[14px] font-bold text-amber-900">
              {hostName} suggested different dates
            </span>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-600 ring-1 ring-amber-200">
                <CalendarRange className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-brand-ink">
                  {fmt(offer.counterCheckIn)} → {fmt(offer.counterCheckOut)}
                </div>
                {offer.originalCheckIn && offer.originalCheckOut ? (
                  <div className="mt-0.5 text-[12px] text-brand-mute">
                    You asked for {fmt(offer.originalCheckIn)} →{" "}
                    {fmt(offer.originalCheckOut)}
                  </div>
                ) : null}
              </div>
            </div>
            {offer.hostNote ? (
              <div className="mt-3 rounded-[10px] bg-white px-3 py-2 text-[12.5px] text-brand-ink ring-1 ring-amber-200">
                “{offer.hostNote}”
              </div>
            ) : null}
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => respond(true)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-status-confirmed px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Accept new dates
              </button>
              <button
                type="button"
                onClick={() => respond(false)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-xs font-medium text-brand-ink hover:bg-brand-light disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" /> Decline
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
